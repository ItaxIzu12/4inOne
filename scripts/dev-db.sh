#!/usr/bin/env bash
# Lumiknot — lokale PostgreSQL-Datenbank (Docker) verwalten.
#
#   ./scripts/dev-db.sh init           Zugangsdaten in backend/.env ergänzen (fehlende Werte, nichts wird überschrieben)
#   ./scripts/dev-db.sh up             PostgreSQL + Redis starten und warten, bis sie bereit sind
#   ./scripts/dev-db.sh migrate        Django-Migrationen auf PostgreSQL ausführen
#   ./scripts/dev-db.sh import-sqlite  EINMALIG: alle Daten aus backend/db.sqlite3 übernehmen und Zeilen vergleichen
#   ./scripts/dev-db.sh status         Container und Verbindung prüfen
#   ./scripts/dev-db.sh psql           SQL-Konsole öffnen
#   ./scripts/dev-db.sh dump           Sicherung nach backups/ (in .gitignore)
#   ./scripts/dev-db.sh down           Container anhalten (Daten bleiben)
#   ./scripts/dev-db.sh reset          Datenbank LÖSCHEN und leer neu anlegen (fragt nach)
#
# Enthält keine Geheimnisse und gehört ins Repository. Geheim ist nur backend/.env (in .gitignore).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env"
PY="$ROOT/backend/.venv/bin/python"
MANAGE=("$PY" "$ROOT/backend/manage.py")
COMPOSE=(compose_run)

say() { printf '\033[1;34m›\033[0m %s\n' "$*"; }
ok() { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# Wert aus backend/.env lesen, ohne die Datei zu „sourcen“ (Werte dürfen Sonderzeichen enthalten)
env_value() { [[ -f "$ENV_FILE" ]] && grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true; }
set_env() {
  # nur ergänzen, wenn der Schlüssel fehlt oder leer ist — nie einen vorhandenen Wert überschreiben
  if [[ -z "$(env_value "$1")" ]]; then
    if grep -qE "^$1=" "$ENV_FILE"; then
      local tmp; tmp="$(mktemp)"
      awk -v k="$1" -v v="$2" 'BEGIN{FS=OFS="="} $1==k{$0=k"="v} {print}' "$ENV_FILE" >"$tmp" && cat "$tmp" >"$ENV_FILE" && rm -f "$tmp"
    else
      printf '%s=%s\n' "$1" "$2" >>"$ENV_FILE"
    fi
    return 0
  fi
  return 1
}

# Docker bekommt nur die drei Postgres-Werte, nicht die ganze backend/.env (Compose würde sonst jedes „$“ in
# anderen Werten, etwa im SECRET_KEY, als Variable deuten).
compose_run() {
  POSTGRES_USER="$(env_value POSTGRES_USER)" POSTGRES_PASSWORD="$(env_value POSTGRES_PASSWORD)" \
    POSTGRES_DB="$(env_value POSTGRES_DB)" POSTGRES_PORT="$(env_value POSTGRES_PORT)" \
    docker compose --project-directory "$ROOT" -f "$ROOT/docker-compose.yml" "$@"
}
need_docker() { docker info >/dev/null 2>&1 || die "Docker läuft nicht — bitte Docker Desktop starten."; }
need_python() { [[ -x "$PY" ]] || die "backend/.venv fehlt — erst: cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt"; }
need_env() {
  [[ -n "$(env_value POSTGRES_PASSWORD)" && "$(env_value DATABASE_URL)" == postgres* ]] \
    || die "backend/.env hat noch keine PostgreSQL-Zugangsdaten — erst: ./scripts/dev-db.sh init"
}
psql_in() { "${COMPOSE[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -q -U "$(env_value POSTGRES_USER)" -d "$(env_value POSTGRES_DB)" "$@"; }

# ./.env im Projektordner: liest Docker Compose von selbst — damit auch `docker compose stop/up/ps` direkt funktioniert.
# Enthält NUR die Postgres-Werte (aus backend/.env abgeleitet, in .gitignore) und wird bei init/up neu geschrieben.
COMPOSE_ENV="$ROOT/.env"
COMPOSE_ENV_MARK='# Automatisch erzeugt von ./scripts/dev-db.sh'
write_compose_env() {
  if [[ -f "$COMPOSE_ENV" ]] && ! grep -qF "$COMPOSE_ENV_MARK" "$COMPOSE_ENV"; then
    die "./.env gibt es schon und stammt nicht von diesem Skript — bitte prüfen, nichts überschrieben."
  fi
  local port; port="$(env_value POSTGRES_PORT)"
  {
    printf '%s — nicht bearbeiten, Quelle ist backend/.env.\n' "$COMPOSE_ENV_MARK"
    printf '# Nur für Docker Compose (Postgres-Container). Nie committen (.gitignore).\n'
    printf 'POSTGRES_USER=%s\nPOSTGRES_PASSWORD=%s\nPOSTGRES_DB=%s\n' \
      "$(env_value POSTGRES_USER)" "$(env_value POSTGRES_PASSWORD)" "$(env_value POSTGRES_DB)"
    [[ -n "$port" ]] && printf 'POSTGRES_PORT=%s\n' "$port"
  } >"$COMPOSE_ENV"
  chmod 600 "$COMPOSE_ENV"
}

cmd_init() {
  [[ -f "$ENV_FILE" ]] || die "backend/.env fehlt — Vorlage: cp .env.example backend/.env (und SECRET_KEY eintragen)"
  [[ -n "$(tail -c1 "$ENV_FILE")" ]] && printf '\n' >>"$ENV_FILE"   # letzte Zeile abschließen
  local changed=0 port password
  if ! grep -q 'PostgreSQL (Docker, ./scripts/dev-db.sh)' "$ENV_FILE"; then
    printf '\n# --- PostgreSQL (Docker, ./scripts/dev-db.sh) ---\n' >>"$ENV_FILE"
  fi
  set_env POSTGRES_USER fourinone && changed=1
  set_env POSTGRES_DB fourinone && changed=1
  # Hex-Passwort: braucht in der DATABASE_URL keine Kodierung
  password="$(env_value POSTGRES_PASSWORD)"
  if [[ -z "$password" ]]; then
    password="$(openssl rand -hex 24)"
    set_env POSTGRES_PASSWORD "$password" && changed=1
  fi
  port="$(env_value POSTGRES_PORT)"; port="${port:-5432}"
  if set_env DATABASE_URL "postgres://$(env_value POSTGRES_USER):${password}@localhost:${port}/$(env_value POSTGRES_DB)"; then
    changed=1
  elif [[ "$(env_value DATABASE_URL)" != postgres* ]]; then
    die "DATABASE_URL in backend/.env zeigt nicht auf PostgreSQL — bitte die Zeile entfernen und init erneut ausführen."
  fi
  chmod 600 "$ENV_FILE"
  write_compose_env
  if [[ $changed == 1 ]]; then ok "backend/.env ergänzt (Passwort zufällig erzeugt, nirgends ausgegeben)."; else ok "backend/.env ist schon vollständig."; fi
}

cmd_up() {
  need_docker; need_env
  write_compose_env
  say "Starte PostgreSQL und Redis …"
  "${COMPOSE[@]}" up -d --wait
  ok "PostgreSQL läuft auf 127.0.0.1:$(env_value POSTGRES_PORT | grep . || echo 5432), Redis auf 127.0.0.1:6379."
}

cmd_migrate() {
  need_python; need_env
  "${MANAGE[@]}" migrate --noinput
}

cmd_status() {
  need_docker
  "${COMPOSE[@]}" ps
  if [[ -f "$ENV_FILE" ]] && need_env 2>/dev/null; then
    psql_in -tAc "select 'PostgreSQL ' || current_setting('server_version') || ', Datenbank ' || current_database() || ', ' || pg_size_pretty(pg_database_size(current_database()))" \
      && need_python && "${MANAGE[@]}" shell -v 0 --no-imports -c "from django.db import connection as c; print('Django nutzt:', c.vendor, c.settings_dict['NAME'])"
  fi
}

cmd_psql() { need_docker; need_env; "${COMPOSE[@]}" exec postgres psql -U "$(env_value POSTGRES_USER)" -d "$(env_value POSTGRES_DB)"; }

cmd_dump() {
  need_docker; need_env
  mkdir -p "$ROOT/backups"
  local file; file="$ROOT/backups/4inone-$(date +%Y%m%d-%H%M%S).dump"
  "${COMPOSE[@]}" exec -T postgres pg_dump -U "$(env_value POSTGRES_USER)" -d "$(env_value POSTGRES_DB)" --format=custom --no-owner >"$file"
  chmod 600 "$file"
  ok "Sicherung: ${file#"$ROOT"/}  (zurückspielen: pg_restore --clean --if-exists --no-owner …)"
}

cmd_down() { need_docker; "${COMPOSE[@]}" stop; ok "Angehalten — die Daten bleiben im Volume erhalten."; }

cmd_reset() {
  need_docker; need_env
  printf 'Das LÖSCHT alle Daten der lokalen PostgreSQL-Datenbank „%s“ unwiderruflich.\n' "$(env_value POSTGRES_DB)"
  read -r -p 'Zum Bestätigen „löschen“ eintippen: ' answer
  [[ "$answer" == "löschen" ]] || die "Abgebrochen, nichts geändert."
  "${COMPOSE[@]}" rm -sf postgres
  docker volume rm "4inone_postgres_data" >/dev/null
  cmd_up
  cmd_migrate
  ok "Leere Datenbank mit allen Tabellen angelegt."
}

# Einmalige Übernahme SQLite → PostgreSQL:
# 1) Sicherung der SQLite-Datei  2) dumpdata aus SQLite  3) migrate auf PostgreSQL  4) loaddata
# 5) Zähler (Sequenzen) nachziehen  6) Zeilen je Tabelle vergleichen
cmd_import_sqlite() {
  need_docker; need_python; need_env
  local sqlite="$ROOT/backend/db.sqlite3"
  [[ -f "$sqlite" ]] || die "backend/db.sqlite3 nicht gefunden."
  cmd_up >/dev/null
  cmd_migrate >/dev/null
  local existing
  existing="$(psql_in -tAc 'select count(*) from auth_user' 2>/dev/null || echo 0)"
  [[ "$existing" == "0" ]] || die "PostgreSQL enthält schon $existing Konten — Übernahme nur in eine leere Datenbank (sonst: ./scripts/dev-db.sh reset)."

  mkdir -p "$ROOT/backups"
  local stamp work; stamp="$(date +%Y%m%d-%H%M%S)"; work="$(mktemp -d)"
  trap 'rm -rf "$work"' RETURN
  cp "$sqlite" "$ROOT/backups/db-vor-postgres-$stamp.sqlite3"
  chmod 600 "$ROOT/backups/db-vor-postgres-$stamp.sqlite3"
  ok "SQLite gesichert: backups/db-vor-postgres-$stamp.sqlite3"

  say "Exportiere aus SQLite …"
  # DATABASE_URL leer → settings.py fällt auf SQLite zurück (Umgebung schlägt backend/.env).
  # contenttypes/permissions legt migrate selbst an; Sitzungen sind flüchtig.
  # --all: auch weich gelöschte Zeilen (z. B. Transaction.all_objects) — sonst fehlen sie und Verweise brechen.
  DATABASE_URL= "${MANAGE[@]}" dumpdata --all --natural-foreign --indent 0 \
    -e contenttypes -e auth.permission -e sessions >"$work/data.json"

  say "Importiere nach PostgreSQL …"
  "${MANAGE[@]}" loaddata "$work/data.json"

  say "Ziehe die ID-Zähler nach …"
  local apps
  apps="$("${MANAGE[@]}" shell -v 0 --no-imports -c "from django.apps import apps; print(' '.join(a.label for a in apps.get_app_configs() if a.get_models()))")"
  # shellcheck disable=SC2086
  "${MANAGE[@]}" sqlsequencereset $apps 2>/dev/null | psql_in >/dev/null

  say "Vergleiche Zeilen je Tabelle …"
  local count_py='
import json
from django.apps import apps
print(json.dumps({m._meta.label: m._base_manager.count() for m in apps.get_models() if m._meta.managed and not m._meta.proxy}))
'
  DATABASE_URL= "${MANAGE[@]}" shell -v 0 --no-imports -c "$count_py" >"$work/sqlite.json"
  "${MANAGE[@]}" shell -v 0 --no-imports -c "$count_py" >"$work/postgres.json"
  "$PY" - "$work/sqlite.json" "$work/postgres.json" <<'PY'
import json, sys
a, b = (json.load(open(p)) for p in sys.argv[1:3])
skip = {'contenttypes.ContentType', 'auth.Permission', 'sessions.Session'}
bad = [(k, a.get(k, 0), b.get(k, 0)) for k in sorted(set(a) | set(b)) if k not in skip and a.get(k, 0) != b.get(k, 0)]
total = sum(v for k, v in a.items() if k not in skip)
if bad:
    print('Abweichungen (Tabelle: SQLite → PostgreSQL):')
    for k, x, y in bad:
        print(f'  {k}: {x} → {y}')
    sys.exit(1)
print(f'Alle {total} Zeilen in {len([k for k in a if k not in skip])} Tabellen stimmen überein.')
PY
  ok "Übernahme fertig. db.sqlite3 bleibt unverändert liegen (wird nicht mehr benutzt)."
}

case "${1:-}" in
  init) cmd_init ;;
  up) cmd_up ;;
  migrate) cmd_migrate ;;
  import-sqlite) cmd_import_sqlite ;;
  status) cmd_status ;;
  psql) cmd_psql ;;
  dump) cmd_dump ;;
  down) cmd_down ;;
  reset) cmd_reset ;;
  *) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
