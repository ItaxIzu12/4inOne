"""Bordkarte (Schritt 1, docs/BORDKARTE_KONZEPT.md, 22.11.2026).

Lumiknot erzeugt nie einen eigenen Code: Es zeigt den ECHTEN Code der Airline, den die Person aus ihrer Bordkarte
importiert (Wallet-Datei .pkpass oder Screenshot, ausgelesen im Browser). Hier liegen
- das Lesen des IATA-Standards BCBP (Bar Coded Boarding Pass, Pflichtteil: Name, Buchungscode, Strecke, Flug, Datum,
  Sitz, Sequenz),
- das Lesen einer Wallet-Datei (.pkpass = ZIP mit pass.json),
- das Lesen des Codes aus einem Screenshot oder einer PDF-Bordkarte (zxing-cpp; PDF-Seiten gerastert mit pypdfium2) –
  nur für Browser ohne eigenen BarcodeDetector (Safari, Firefox) und für PDFs; Bild und PDF werden nur im Speicher
  gelesen und nie abgelegt,
- die Verschlüsselung des Codes: Buchungscode + Name erlauben bei vielen Airlines das Umbuchen, deshalb liegt der Code
  nur verschlüsselt in der Datenbank. Schlüssel: settings.BOARDING_PASS_KEYS (der erste verschlüsselt), sonst aus
  SECRET_KEY abgeleitet; entschlüsselt wird auch mit allen älteren Schlüsseln und SECRET_KEY_FALLBACKS, damit ein
  Schlüsselwechsel gespeicherte Karten nicht unlesbar macht.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import re
import zipfile
from dataclasses import dataclass, field
from datetime import date, timedelta

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings
from django.utils import timezone

MAX_MESSAGE = 2000
MAX_PKPASS_BYTES = 5 * 1024 * 1024
MAX_PASS_JSON_BYTES = 512 * 1024
MAX_SCAN_BYTES = 10 * 1024 * 1024  # Screenshot oder PDF
MAX_SCAN_PIXELS = 40_000_000  # größere Bilder sind kein Screenshot, sondern ein Risiko (Dekompressionsbombe)
MAX_SCAN_SIDE = 4000  # länger wird verkleinert; reicht für jeden Bordkarten-Code
MAX_PDF_PAGES = 3
FORMATS = ('QR', 'AZTEC', 'PDF417', 'CODE128')
PKPASS_FORMATS = {
    'PKBarcodeFormatQR': 'QR', 'PKBarcodeFormatAztec': 'AZTEC', 'PKBarcodeFormatPDF417': 'PDF417',
    'PKBarcodeFormatCode128': 'CODE128',
}


class BoardingPassError(Exception):
    """Verständliche Meldung für die Person."""


# --------------------------------------------------------------------------- Verschlüsselung


def _key(secret: str) -> Fernet:
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(f'4inone-bordkarte:{secret}'.encode()).digest()))


def _fernet() -> MultiFernet:
    """Der erste Schlüssel verschlüsselt; entschlüsselt wird mit allen (eigene Bordkarten-Schlüssel, dann SECRET_KEY und
    seine Fallbacks)."""
    secrets = [*getattr(settings, 'BOARDING_PASS_KEYS', []), settings.SECRET_KEY, *getattr(settings, 'SECRET_KEY_FALLBACKS', [])]
    unique = list(dict.fromkeys(s for s in secrets if s))
    return MultiFernet([_key(s) for s in unique])


def encrypt(message: str) -> str:
    return _fernet().encrypt(message.encode('utf-8')).decode('ascii')


def decrypt(token: str) -> str | None:
    try:
        return _fernet().decrypt(token.encode('ascii')).decode('utf-8')
    except (InvalidToken, ValueError):
        return None


# --------------------------------------------------------------------------- BCBP (IATA Resolution 792)


@dataclass
class PassData:
    passenger_name: str = ''
    pnr: str = ''
    from_code: str = ''
    to_code: str = ''
    carrier: str = ''
    flight_number: str = ''
    flight_date: date | None = None
    compartment: str = ''
    seat: str = ''
    sequence: str = ''
    # nur aus Wallet-Dateien
    from_name: str = ''
    to_name: str = ''
    airline_name: str = ''
    boarding_time: str = ''
    departure_time: str = ''
    gate: str = ''
    group: str = ''
    extra: dict = field(default_factory=dict)


def _julian_to_date(day_of_year: int, today: date | None = None) -> date | None:
    """Tag im Jahr (1–366) → Datum. Das Jahr steht nicht im Code: gewählt wird das, bei dem der Tag am nächsten an
    heute liegt (Bordkarten gibt es kurz vor dem Flug, also höchstens wenige Wochen zurück oder voraus)."""
    if not 1 <= day_of_year <= 366:
        return None
    today = today or timezone.localdate()
    candidates = []
    for year in (today.year - 1, today.year, today.year + 1):
        try:
            candidates.append(date(year, 1, 1) + timedelta(days=day_of_year - 1))
        except OverflowError:
            continue
    candidates = [d for d in candidates if d.year in (today.year - 1, today.year, today.year + 1)]
    return min(candidates, key=lambda d: abs((d - today).days)) if candidates else None


def _name(raw: str) -> str:
    """„MUSTERMANN/SOPHIE MS“ → „Sophie Mustermann“ (Anrede am Ende weglassen)."""
    raw = raw.strip()
    if '/' not in raw:
        return raw.title()
    last, first = raw.split('/', 1)
    first = re.sub(r'\s+(MR|MRS|MS|MISS|MSTR|DR)$', '', first.strip())
    return f'{first.title()} {last.title()}'.strip()


def parse_bcbp(message: str, today: date | None = None) -> PassData | None:
    """Pflichtteil eines BCBP-Codes (beginnt mit „M“ und der Anzahl der Flüge); None, wenn es keiner ist."""
    if not message or len(message) < 58 or message[0] != 'M' or not message[1].isdigit():
        return None
    try:
        flight_digits = message[39:44].strip().lstrip('0') or '0'
        day = int(message[44:47]) if message[44:47].strip().isdigit() else 0
        seat = message[48:52].strip().lstrip('0')
        sequence = message[52:57].strip().lstrip('0')
    except (ValueError, IndexError):
        return None
    data = PassData(
        passenger_name=_name(message[2:22]),
        pnr=message[23:30].strip(),
        from_code=message[30:33].strip(),
        to_code=message[33:36].strip(),
        carrier=message[36:39].strip(),
        flight_number=f'{message[36:39].strip()} {flight_digits}'.strip(),
        flight_date=_julian_to_date(day, today) if day else None,
        compartment=message[47:48].strip(),
        seat=seat,
        sequence=sequence,
    )
    if not (re.fullmatch(r'[A-Z]{3}', data.from_code) and re.fullmatch(r'[A-Z]{3}', data.to_code)):
        return None
    return data


def masked_pnr(pnr: str) -> str:
    return f'{pnr[:2]}••••' if pnr else ''


# --------------------------------------------------------------------------- Wallet-Datei (.pkpass)


def _field_value(fields: list, *needles: str) -> tuple[str, str]:
    """(Wert, Beschriftung) des ersten Felds, dessen Schlüssel oder Beschriftung eines der Wörter enthält."""
    for f in fields:
        if not isinstance(f, dict):
            continue
        hay = f'{f.get("key", "")} {f.get("label", "")}'.lower()
        if any(n in hay for n in needles):
            return str(f.get('value', '')).strip(), str(f.get('label', '')).strip()
    return '', ''


def parse_pkpass(data: bytes, today: date | None = None) -> tuple[str, str, PassData]:
    """(Format, Code-Inhalt, Angaben) aus einer Wallet-Datei. Liest nur pass.json – Bilder und Signatur nicht."""
    if len(data) > MAX_PKPASS_BYTES:
        raise BoardingPassError('Die Datei ist zu groß (höchstens 5 MB).')
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
        info = archive.getinfo('pass.json')
        if info.file_size > MAX_PASS_JSON_BYTES:
            raise BoardingPassError('Die Wallet-Datei ist ungewöhnlich groß und wird nicht gelesen.')
        payload = json.loads(archive.read(info).decode('utf-8-sig'))
    except BoardingPassError:
        raise
    except (zipfile.BadZipFile, KeyError, ValueError, UnicodeDecodeError):
        raise BoardingPassError('Das ist keine lesbare Wallet-Datei (.pkpass).')
    barcodes = payload.get('barcodes') or ([payload['barcode']] if isinstance(payload.get('barcode'), dict) else [])
    barcode = next((b for b in barcodes if isinstance(b, dict) and b.get('message')), None)
    if not barcode:
        raise BoardingPassError('In der Wallet-Datei ist kein Code enthalten.')
    fmt = PKPASS_FORMATS.get(barcode.get('format', ''), '')
    message = str(barcode['message'])[:MAX_MESSAGE]
    if not fmt:
        raise BoardingPassError('Dieses Code-Format wird noch nicht unterstützt.')

    data_ = parse_bcbp(message, today) or PassData()
    style = payload.get('boardingPass') or {}
    all_fields = []
    for group in ('headerFields', 'primaryFields', 'secondaryFields', 'auxiliaryFields', 'backFields'):
        all_fields += style.get(group) or []
    primary = [f for f in style.get('primaryFields') or [] if isinstance(f, dict)]
    if len(primary) >= 2:
        data_.from_code = data_.from_code or str(primary[0].get('value', ''))[:3].upper()
        data_.to_code = data_.to_code or str(primary[1].get('value', ''))[:3].upper()
        data_.from_name = str(primary[0].get('label', '')).strip()[:60]
        data_.to_name = str(primary[1].get('label', '')).strip()[:60]
    data_.airline_name = str(payload.get('organizationName', '')).strip()[:60]
    data_.gate = _field_value(all_fields, 'gate', 'flugsteig')[0][:10]
    data_.boarding_time = _field_value(all_fields, 'boarding', 'einstieg')[0][:20]
    data_.departure_time = _field_value(all_fields, 'depart', 'abflug', 'departure')[0][:20]
    data_.group = _field_value(all_fields, 'group', 'zone', 'gruppe')[0][:10]
    if not data_.seat:
        data_.seat = _field_value(all_fields, 'seat', 'sitz')[0][:6]
    if not data_.flight_number:
        data_.flight_number = _field_value(all_fields, 'flight', 'flug')[0][:12]
    if not data_.passenger_name:
        data_.passenger_name = _field_value(all_fields, 'passenger', 'name', 'passagier')[0][:60]
    return fmt, message, data_


# --------------------------------------------------------------------------- Screenshot und PDF


ZXING_FORMATS = {'QRCode': 'QR', 'Aztec': 'AZTEC', 'AztecCode': 'AZTEC', 'PDF417': 'PDF417', 'CompactPDF417': 'PDF417', 'Code128': 'CODE128'}


def _images_from_pdf(data: bytes):
    import pypdfium2 as pdfium  # erst hier laden: nur für PDF-Bordkarten nötig

    try:
        pdf = pdfium.PdfDocument(data)
    except pdfium.PdfiumError:
        raise BoardingPassError('Das PDF lässt sich nicht öffnen (beschädigt oder mit Passwort geschützt).')
    try:
        for index in range(min(len(pdf), MAX_PDF_PAGES)):
            page = pdf[index]
            width, height = page.get_size()
            scale = min(4.0, MAX_SCAN_SIDE / max(width, height, 1))  # ~ 288 dpi, höchstens 4000 px
            yield page.render(scale=scale).to_pil()
    finally:
        pdf.close()


def _image_from_bytes(data: bytes):
    from PIL import Image, ImageOps, UnidentifiedImageError

    try:
        with Image.open(io.BytesIO(data)) as probe:
            if probe.width * probe.height > MAX_SCAN_PIXELS:
                raise BoardingPassError('Das Bild ist zu groß. Nimm einen normalen Screenshot der Bordkarte.')
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
        image.load()
    except BoardingPassError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError):
        raise BoardingPassError('Das ist kein lesbares Bild. Nimm einen Screenshot (PNG oder JPG) oder die Wallet-Datei.')
    image = image.convert('RGB')
    if max(image.size) > MAX_SCAN_SIDE:
        image.thumbnail((MAX_SCAN_SIDE, MAX_SCAN_SIDE))
    return image


def read_code(data: bytes) -> tuple[str, str]:
    """(Format, Code-Inhalt) aus einem Screenshot oder einer PDF-Bordkarte. Bild und PDF werden nur hier im Speicher
    gelesen und nicht gespeichert."""
    import zxingcpp

    if len(data) > MAX_SCAN_BYTES:
        raise BoardingPassError('Die Datei ist zu groß (höchstens 10 MB).')
    is_pdf = data[:5] == b'%PDF-'
    images = _images_from_pdf(data) if is_pdf else [_image_from_bytes(data)]
    wanted = (zxingcpp.BarcodeFormat.QRCode, zxingcpp.BarcodeFormat.Aztec, zxingcpp.BarcodeFormat.PDF417, zxingcpp.BarcodeFormat.Code128)
    for image in images:
        for barcode in zxingcpp.read_barcodes(image, formats=wanted):
            fmt = ZXING_FORMATS.get(barcode.format.name)
            if fmt and barcode.valid and barcode.text:
                return fmt, barcode.text[:MAX_MESSAGE]
    where = 'Im PDF' if is_pdf else 'Im Bild'
    raise BoardingPassError(f'{where} wurde kein Code gefunden. Nimm eine scharfe Aufnahme, auf der der ganze Code zu sehen ist – oder die Wallet-Datei.')
