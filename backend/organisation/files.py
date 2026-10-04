"""Prüfung hochgeladener Dateien (docs/SECURITY.md „File uploads“): Größe,
Typ am INHALT (Magic Bytes) statt am Dateinamen, bereinigter Anzeigename,
Speicher-Kontingent pro Person. Erlaubt sind nur Formate, die der Browser
nicht als aktive Inhalte ausführt (kein HTML/SVG)."""

import re
import unicodedata
import zipfile

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
