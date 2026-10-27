#!/usr/bin/env bash
# 4inOne — tägliches Backup: Datenbank (pg_dump) + hochgeladene Dateien (PRIVATE_MEDIA_ROOT), verschlüsselt mit `age`.
#
# Verschlüsselt wird mit einem ÖFFENTLICHEN Schlüssel: der Server kann Backups schreiben, aber nicht lesen. Den
# privaten Schlüssel nur offline aufbewahren (Passwort-Manager, USB-Stick) — ohne ihn ist jedes Backup wertlos.
#   Schlüssel einmalig auf DEINEM Rechner erzeugen:  age-keygen -o 4inone-backup.key
#   Die Zeile „public key: age1…“ hier in AGE_RECIPIENT eintragen (oder in /srv/4inone-data/backup.env).
#
# Zurückspielen: siehe deploy/ANLEITUNG.md › „Backup zurückspielen“.
set -euo pipefail
umask 077

APP_DIR=${APP_DIR:-/srv/4inone}
DATA_DIR=${DATA_DIR:-/srv/4inone-data}
BACKUP_DIR=${BACKUP_DIR:-$DATA_DIR/backups}
KEEP_DAYS=${KEEP_DAYS:-14}
AGE_RECIPIENT=${AGE_RECIPIENT:-}
# Anderer Ort für die Kopie, z. B. „backup@speicher.example:4inone/“ (rsync über SSH). Leer = nur lokal (NICHT genug).
BACKUP_REMOTE=${BACKUP_REMOTE:-}
# Eigene Werte ohne dieses Skript zu ändern
[[ -f "$DATA_DIR/backup.env" ]] && source "$DATA_DIR/backup.env"

ENV_FILE="$APP_DIR/backend/.env"
[[ -n "$AGE_RECIPIENT" ]] || { echo "AGE_RECIPIENT fehlt — ohne Verschlüsselung wird nichts gesichert." >&2; exit 1; }
command -v age >/dev/null || { echo "age fehlt: sudo apt install age" >&2; exit 1; }

# Werte aus backend/.env lesen, ohne die Datei als Shell-Skript auszuführen
env_value() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
DATABASE_URL=$(env_value DATABASE_URL)
MEDIA_ROOT=$(env_value PRIVATE_MEDIA_ROOT)
[[ "$DATABASE_URL" == postgres* ]] || { echo "DATABASE_URL ist keine PostgreSQL-Adresse." >&2; exit 1; }

# Passwort per Umgebung an pg_dump, nicht als Argument (sonst sichtbar in `ps`)
eval "$(python3 - "$DATABASE_URL" <<'PY'
import shlex, sys
from urllib.parse import urlparse, unquote
u = urlparse(sys.argv[1])
for k, v in {'PGHOST': u.hostname or 'localhost', 'PGPORT': str(u.port or 5432), 'PGUSER': unquote(u.username or ''),
             'PGPASSWORD': unquote(u.password or ''), 'PGDATABASE': u.path.lstrip('/')}.items():
    print(f'export {k}={shlex.quote(v)}')
PY
)"

STAMP=$(date +%Y-%m-%d_%H%M)
mkdir -p "$BACKUP_DIR"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

pg_dump --format=custom --no-owner --file "$WORK/db.dump"
if [[ -n "$MEDIA_ROOT" && -d "$MEDIA_ROOT" ]]; then
  tar -C "$(dirname "$MEDIA_ROOT")" -cf "$WORK/private_media.tar" "$(basename "$MEDIA_ROOT")"
fi
tar -C "$WORK" -cf - . | age -r "$AGE_RECIPIENT" -o "$BACKUP_DIR/4inone_$STAMP.tar.age"
echo "Backup geschrieben: $BACKUP_DIR/4inone_$STAMP.tar.age ($(du -h "$BACKUP_DIR/4inone_$STAMP.tar.age" | cut -f1))"

# Alte lokale Backups löschen
find "$BACKUP_DIR" -name '4inone_*.tar.age' -mtime +"$KEEP_DAYS" -delete

if [[ -n "$BACKUP_REMOTE" ]]; then
  rsync -a "$BACKUP_DIR/4inone_$STAMP.tar.age" "$BACKUP_REMOTE"
  echo "Kopie an $BACKUP_REMOTE übertragen."
else
  echo "WARNUNG: BACKUP_REMOTE ist leer — das Backup liegt nur auf diesem Server." >&2
fi
