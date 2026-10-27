#!/usr/bin/env bash
# 4inOne — Update einspielen: neuen Stand holen, prüfen, Datenbank anpassen, Seite neu bauen, Dienst neu starten.
# Als Benutzer `deploy` auf dem Server ausführen:  /srv/4inone/deploy/scripts/update.sh
# Bricht beim ersten Fehler ab; die laufende Seite bleibt dann unverändert, bis der Fehler behoben ist.
set -euo pipefail

APP_DIR=${APP_DIR:-/srv/4inone}
WEB_ROOT=${WEB_ROOT:-/srv/4inone-web}
BRANCH=${BRANCH:-main}
cd "$APP_DIR"

echo "== 1/6 Neuer Stand von $BRANCH"
git fetch origin "$BRANCH"
git merge --ff-only "origin/$BRANCH"   # nur vorspulen: lokale Änderungen auf dem Server führen zum Abbruch

echo "== 2/6 Backend-Pakete"
backend/.venv/bin/pip install --quiet -r backend/requirements.txt
if [[ -x backend/.venv/bin/pip-audit ]]; then
  backend/.venv/bin/pip-audit -r backend/requirements.txt || echo "WARNUNG: pip-audit meldet Befunde (siehe oben)." >&2
else
  echo "Hinweis: pip-audit nicht installiert (backend/.venv/bin/pip install pip-audit) — Sicherheitsprüfung übersprungen."
fi

echo "== 3/6 Backup vor der Datenbank-Änderung"
"$APP_DIR/deploy/scripts/backup.sh"

echo "== 4/6 Datenbank und Prüfung"
cd backend
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py check --deploy   # Fehler brechen ab; Warnungen beim ersten Mal einzeln prüfen
cd ..

echo "== 5/6 Frontend bauen"
cd frontend
npm ci --no-audit --no-fund
npm audit --omit=dev || echo "WARNUNG: npm audit meldet Befunde (siehe oben)." >&2
npx ng build
cd ..
# Erst alle Dateien außer HTML (alte chunk-Dateien bleiben liegen: wer die Seite gerade offen hat, lädt sie noch),
# dann die HTML-Dateien — so zeigt kein HTML auf eine Datei, die noch fehlt.
rsync -a --exclude '*.html' frontend/dist/frontend/browser/ "$WEB_ROOT/"
rsync -a --include '*/' --include '*.html' --exclude '*' frontend/dist/frontend/browser/ "$WEB_ROOT/"

echo "== 6/6 Django neu starten"
sudo systemctl restart 4inone
sleep 2
systemctl is-active --quiet 4inone && echo "Fertig: 4inone läuft." || { echo "4inone startet nicht: journalctl -u 4inone -n 50" >&2; exit 1; }
