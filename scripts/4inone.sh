#!/usr/bin/env bash
# 4inOne lokal starten und stoppen — ein Befehl für alles.
#
#   ./scripts/4inone.sh            startet Datenbank (Docker), Backend (Django) und Frontend (Angular), öffnet den Browser
#   ./scripts/4inone.sh stop       hält alles wieder an (Daten bleiben erhalten)
#   ./scripts/4inone.sh status     zeigt, was gerade läuft
#   ./scripts/4inone.sh start --mit-monitoring   zusätzlich GlitchTip (Fehler-Monitoring, docs/MONITORING.md)
#
# Protokolle (Projektwurzel): .run/backend.log und .run/frontend.log (in .gitignore). Fehlen Migrationen, fragt das Skript nach.
set -euo pipefail

# liegt in scripts/ — die Projektwurzel ist eine Ebene darüber
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN="$ROOT/.run"
PY="$ROOT/backend/.venv/bin/python"
BACKEND_PORT=8000
FRONTEND_PORT=4200

say() { printf '\033[1;34m›\033[0m %s\n' "$*"; }
ok() { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# „nichts gefunden“ ist kein Fehler (sonst bräche set -e/pipefail das Skript ab, sobald ein Port frei ist)
listening() { lsof -nP -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -n1 || true; }
wait_port() { for _ in $(seq 1 "$2"); do [[ -n "$(listening "$1")" ]] && return 0; sleep 1; done; return 1; }

# Prozess samt Kindern (ng serve startet esbuild & Co.) — erst sanft, nach 5 s hart
kill_tree() {
  local pid="$1" kids
  kids="$(pgrep -P "$pid" 2>/dev/null || true)"
  for kid in $kids; do kill_tree "$kid"; done
  kill -TERM "$pid" 2>/dev/null || true
}
stop_pid() {
  local pid="$1"
  kill_tree "$pid"
  for _ in 1 2 3 4 5; do kill -0 "$pid" 2>/dev/null || return 0; sleep 1; done
  kill -KILL "$pid" 2>/dev/null || true
}

# Gehört der Prozess zu DIESEM Projekt? (Arbeitsordner oder Befehl liegt in 4inOne) — fremde Programme bleiben unberührt
ours() {
  local pid="$1" cmd cwd
  cmd="$(ps -o command= -p "$pid" 2>/dev/null || true)"
  cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
  [[ "$cwd" == "$ROOT"* || "$cmd" == *"$ROOT"* ]]
}

stop_service() {
  local name="$1" port="$2" pidfile="$RUN/$1.pid" pid
  if [[ -f "$pidfile" ]]; then
    pid="$(cat "$pidfile")"
    kill -0 "$pid" 2>/dev/null && stop_pid "$pid"
    rm -f "$pidfile"
  fi
  # auch von Hand (oder aus der Claude-Vorschau) gestartete Server auf dem Port — aber nur, wenn sie zu 4inOne gehören
  pid="$(listening "$port")"
  if [[ -n "$pid" ]]; then
    if ours "$pid"; then stop_pid "$pid"; else warn "Port $port belegt ein anderes Programm — nicht angefasst."; return; fi
  fi
  ok "$name angehalten."
}

start_service() {
  local name="$1" port="$2" dir="$3"; shift 3
  if [[ -n "$(listening "$port")" ]]; then
    if ours "$(listening "$port")"; then ok "$name läuft bereits."; return; fi
    die "Port $port ist von einem anderen Programm belegt."
  fi
  # exec: der Server ersetzt die Zwischen-Shell — kein Restprozess hält die Ausgabe offen, und die PID ist die des Servers
  (cd "$dir" && exec nohup "$@" >"$RUN/$name.log" 2>&1 </dev/null) &
  echo $! >"$RUN/$name.pid"
}

# Docker Desktop bei Bedarf selbst starten (z. B. nach einem Neustart des Macs) und warten, bis es bereit ist
ensure_docker() {
  docker info >/dev/null 2>&1 && return 0
  if [[ "$(uname)" == "Darwin" ]] && open -a Docker 2>/dev/null; then
    say "Docker Desktop wird gestartet …"
    for _ in $(seq 1 90); do docker info >/dev/null 2>&1 && { ok "Docker läuft."; return 0; }; sleep 2; done
  fi
  die "Docker läuft nicht — bitte Docker Desktop starten und noch einmal versuchen."
}

cmd_start() {
  local monitoring="${1:-}"
  ensure_docker
  [[ -x "$PY" ]] || die "backend/.venv fehlt: cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt"
  [[ -d "$ROOT/frontend/node_modules" ]] || die "frontend/node_modules fehlt: cd frontend && npm ci"
  mkdir -p "$RUN"

  say "Datenbank …"
  "$ROOT/scripts/dev-db.sh" up >/dev/null 2>&1 || die "Datenbank startet nicht — ./scripts/dev-db.sh up zeigt den Grund."
  ok "PostgreSQL und Redis laufen."

  if [[ "$monitoring" == "--mit-monitoring" ]]; then
    say "GlitchTip …"
    "$ROOT/monitoring/glitchtip.sh" up >/dev/null 2>&1 && ok "GlitchTip läuft: http://localhost:8001"
  fi

  # Offene Migrationen: nicht still einspielen, sondern fragen
  local pending
  local migrations
  migrations="$(cd "$ROOT/backend" && "$PY" manage.py showmigrations 2>&1)" \
    || die "Django kann die Datenbank nicht lesen — Ausgabe: ${migrations##*$'\n'}"
  pending="$(printf '%s\n' "$migrations" | awk '/^[a-z_]+$/{app=$1} /\[ \]/{print "  " app "/" $NF}' || true)"
  if [[ -n "$pending" ]]; then
    warn "Nicht eingespielte Migrationen:"
    echo "$pending"
    answer=""
    read -r -p "Jetzt einspielen? [j/N] " answer || true
    if [[ "$answer" =~ ^[jJyY]$ ]]; then
      (cd "$ROOT/backend" && "$PY" manage.py migrate --noinput) && ok "Migrationen eingespielt."
    else
      warn "Ohne die Migrationen funktioniert nicht alles (z. B. die Anmeldung)."
    fi
  fi

  say "Backend und Frontend …"
  start_service backend "$BACKEND_PORT" "$ROOT/backend" "$PY" manage.py runserver "127.0.0.1:$BACKEND_PORT"
  start_service frontend "$FRONTEND_PORT" "$ROOT/frontend" npx ng serve --port "$FRONTEND_PORT"
  wait_port "$BACKEND_PORT" 30 || die "Backend startet nicht — siehe .run/backend.log"
  ok "Backend läuft: http://localhost:$BACKEND_PORT/api/"
  wait_port "$FRONTEND_PORT" 120 || die "Frontend startet nicht — siehe .run/frontend.log"
  ok "Frontend läuft: http://localhost:$FRONTEND_PORT"

  open "http://localhost:$FRONTEND_PORT" 2>/dev/null || true
  echo
  echo "  4inOne läuft. Beenden mit: ./scripts/4inone.sh stop"
}

cmd_stop() {
  stop_service frontend "$FRONTEND_PORT"
  stop_service backend "$BACKEND_PORT"
  "$ROOT/scripts/dev-db.sh" down >/dev/null 2>&1 && ok "Datenbank angehalten (Daten bleiben erhalten)."
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^4inone-monitoring-'; then
    "$ROOT/monitoring/glitchtip.sh" down >/dev/null && ok "GlitchTip angehalten."
  fi
}

cmd_status() {
  for entry in "Frontend:$FRONTEND_PORT" "Backend:$BACKEND_PORT"; do
    name="${entry%%:*}"; port="${entry##*:}"
    if [[ -n "$(listening "$port")" ]]; then ok "$name läuft (http://localhost:$port)"; else echo "  $name: aus"; fi
  done
  docker ps --format '  {{.Names}}: {{.Status}}' 2>/dev/null | grep -E '4inone' || echo "  Datenbank: aus"
}

case "${1:-start}" in
  start) cmd_start "${2:-}" ;;
  stop) cmd_stop ;;
  status) cmd_status ;;
  *) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
