#!/usr/bin/env bash
# GlitchTip (Fehler-Monitoring für 4inOne) lokal in Docker — eigener Ordner, getrennt von der App.
#
#   ./monitoring/glitchtip.sh init     Geheimnisse in monitoring/.env anlegen (fehlende Werte, nichts wird überschrieben)
#   ./monitoring/glitchtip.sh up       starten und warten, bis es läuft → http://localhost:8001
#   ./monitoring/glitchtip.sh status   Container prüfen
#   ./monitoring/glitchtip.sh logs     Protokoll (z. B. für die Alarm-Mails ohne Mailserver)
#   ./monitoring/glitchtip.sh down     anhalten (Daten bleiben)
#
# Danach einmalig: Konto anlegen, Organisation + Projekt erstellen, DSN in backend/.env eintragen — docs/MONITORING.md.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DIR/.env"
COMPOSE=(docker compose --project-directory "$DIR" -f "$DIR/compose.yml")

ok() { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }
value() { [[ -f "$ENV_FILE" ]] && grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true; }
need_docker() { docker info >/dev/null 2>&1 || die "Docker läuft nicht — bitte Docker Desktop starten."; }

cmd_init() {
  touch "$ENV_FILE"
  [[ -z "$(value GLITCHTIP_SECRET_KEY)" ]] && printf 'GLITCHTIP_SECRET_KEY=%s\n' "$(openssl rand -hex 32)" >>"$ENV_FILE"
  [[ -z "$(value GLITCHTIP_DB_PASSWORD)" ]] && printf 'GLITCHTIP_DB_PASSWORD=%s\n' "$(openssl rand -hex 24)" >>"$ENV_FILE"
  [[ -z "$(value GLITCHTIP_PORT)" ]] && printf 'GLITCHTIP_PORT=8001\nGLITCHTIP_DOMAIN=http://localhost:8001\n' >>"$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok "monitoring/.env bereit (Schlüssel zufällig erzeugt, nirgends ausgegeben, in .gitignore)."
}

cmd_up() {
  need_docker
  [[ -n "$(value GLITCHTIP_SECRET_KEY)" ]] || die "Erst: ./monitoring/glitchtip.sh init"
  "${COMPOSE[@]}" up -d --wait
  ok "GlitchTip läuft: $(value GLITCHTIP_DOMAIN)"
}

case "${1:-}" in
  init) cmd_init ;;
  up) cmd_up ;;
  status) need_docker; "${COMPOSE[@]}" ps ;;
  logs) need_docker; "${COMPOSE[@]}" logs --tail=200 -f web ;;
  down) need_docker; "${COMPOSE[@]}" stop; ok "Angehalten — die Daten bleiben erhalten." ;;
  *) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
