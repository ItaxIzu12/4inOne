"""Prüfung hochgeladener Dateien (docs/SECURITY.md „File uploads“): Größe,
Typ am INHALT (Magic Bytes) statt am Dateinamen, bereinigter Anzeigename,
Speicher-Kontingent pro Person. Erlaubt sind nur Formate, die der Browser
nicht als aktive Inhalte ausführt (kein HTML/SVG)."""

import io
import re
import unicodedata
import zipfile

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB je Datei
QUOTA = 500 * 1024 * 1024  # 500 MB je Person

# Typ → (Endungen, darf im Browser angezeigt werden)
ALLOWED = {
    'application/pdf': ({'pdf'}, True),
    'image/png': ({'png'}, True),
    'image/jpeg': ({'jpg', 'jpeg'}, True),
    'image/webp': ({'webp'}, True),
    'image/gif': ({'gif'}, True),
    'text/plain': ({'txt'}, False),
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ({'docx'}, False),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ({'xlsx'}, False),
}
INLINE_TYPES = {t for t, (_, inline) in ALLOWED.items() if inline}

# Anhänge an Notizen (31.10.2026, Test für Fotos bei Gerät/Vertrag): nur Fotos und PDF, höchstens 10 je Notiz.
NOTE_TYPES = {'application/pdf', 'image/png', 'image/jpeg', 'image/webp'}
MAX_NOTE_FILES = 10

# Bilder werden neu gespeichert: ohne EXIF (GPS-Standort, Kamera, Aufnahmezeit), richtig gedreht, höchstens
# 4096 px an der langen Seite. Riesige Pixelmaße werden vor dem Dekodieren abgelehnt (Dekompressionsbomben).
REENCODE = {'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WEBP'}
MAX_PIXELS = 40_000_000
MAX_SIDE = 4096


def clean_image(upload, content_type: str) -> bytes | None:
    """Das Bild ohne Metadaten neu kodieren. None = kein gültiges Bild (oder zu groß)."""
    fmt = REENCODE[content_type]
    try:
        upload.seek(0)
        with Image.open(upload) as source:
            if source.format != fmt or source.width * source.height > MAX_PIXELS:
                return None
            source.load()
            image = ImageOps.exif_transpose(source)
            image.thumbnail((MAX_SIDE, MAX_SIDE))
            if fmt == 'JPEG' and image.mode not in ('RGB', 'L'):
                image = image.convert('RGB')
            out = io.BytesIO()
            # Ohne exif=/pnginfo=/icc_profile= schreibt Pillow keine Metadaten mit.
            options = {'quality': 88, 'optimize': True} if fmt in ('JPEG', 'WEBP') else {'optimize': True}
            image.save(out, fmt, **options)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        return None
    finally:
        upload.seek(0)
    return out.getvalue()


def sniff(head: bytes, upload) -> str | None:
    """Erkennt den Typ am Dateianfang; None = nicht erlaubt."""
    if head.startswith(b'%PDF-'):
        return 'application/pdf'
    if head.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if head.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return 'image/webp'
    if head[:6] in (b'GIF87a', b'GIF89a'):
        return 'image/gif'
    if head.startswith(b'PK\x03\x04'):
        # Office-Dokumente sind ZIP-Archive mit fester Struktur
        try:
            upload.seek(0)
            with zipfile.ZipFile(upload) as archive:
                names = set(archive.namelist())
        except zipfile.BadZipFile:
            return None
        finally:
            upload.seek(0)
        if 'word/document.xml' in names:
            return ALLOWED_KEYS['docx']
        if 'xl/workbook.xml' in names:
            return ALLOWED_KEYS['xlsx']
        return None
    if b'\x00' not in head:
        try:
            head.decode('utf-8')
        except UnicodeDecodeError:
            return None
        # Kein Markup: sonst könnte „Text“ im Browser als HTML gelesen werden
        if re.search(rb'<\s*(html|script|svg|!doctype)', head, re.IGNORECASE):
            return None
        return 'text/plain'
    return None


ALLOWED_KEYS = {
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}


def clean_name(raw: str) -> str:
    """Anzeigename ohne Pfad, Steuerzeichen und Header-Sonderzeichen."""
    name = raw.replace('\\', '/').rsplit('/', 1)[-1]
    name = unicodedata.normalize('NFC', name)
    name = ''.join(ch for ch in name if unicodedata.category(ch)[0] != 'C')
    name = re.sub(r'["<>|*?:;]', '_', name).strip(' .')
    return (name or 'Datei')[:160]


def matches_extension(name: str, content_type: str) -> bool:
    extension = name.rsplit('.', 1)[-1].lower() if '.' in name else ''
    return extension in ALLOWED[content_type][0]


class UploadRejected(ValueError):
    """Hochladen abgelehnt — die Meldung ist für Nutzer:innen gedacht."""


def prepare_upload(upload, allowed: set[str] | None = None) -> tuple[str, str, object]:
    """Gemeinsame Prüfung für alle Uploads (Notizen, Haushaltsordner): Größe, Typ am Inhalt, passende Endung,
    bereinigter Name; Fotos ohne Metadaten neu kodiert. Liefert (content_type, name, Inhalt zum Speichern)."""
    from django.core.files.base import ContentFile

    if upload is None:
        raise UploadRejected('Bitte eine Datei auswählen.')
    if upload.size > MAX_FILE_SIZE:
        raise UploadRejected('Die Datei ist größer als 10 MB.')
    head = upload.read(2048)
    upload.seek(0)
    content_type = sniff(head, upload)
    name = clean_name(upload.name or '')
    if content_type is None or not matches_extension(name, content_type):
        raise UploadRejected('Dieser Dateityp wird nicht unterstützt. Erlaubt sind PDF, Bilder (PNG, JPG, WebP, GIF), Text, Word und Excel.')
    if allowed is not None and content_type not in allowed:
        raise UploadRejected('Hier lassen sich Fotos (JPG, PNG, WebP) und PDF anhängen.')
    if content_type in REENCODE:
        cleaned = clean_image(upload, content_type)
        if cleaned is None:
            raise UploadRejected('Das Bild lässt sich nicht lesen oder ist zu groß (höchstens 40 Megapixel).')
        return content_type, name, ContentFile(cleaned)
    return content_type, name, upload
