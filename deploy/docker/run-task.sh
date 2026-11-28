#!/usr/bin/env bash
# Lumiknot (Docker-Betrieb) — wiederkehrende Aufgaben, gestartet von den systemd-Timern in deploy/docker/systemd/.
# Gleiche Aufgaben und Zeiten wie im systemd-Weg (deploy/systemd/); der Test backend/core/test_deploy_schedule.py
# prüft, dass hier jeder Wartungsbefehl vorkommt.
#
#   run-task.sh backup | cleanup | prune | reminders | calendars
#
# Einstellungen aus /srv/4inone-data/docker.env (siehe deploy/docker/env.example), für das Backup zusätzlich
# AGE_RECIPIENT (und optional BACKUP_REMOTE, KEEP_DAYS) aus /srv/4inone-data/backup.env.
set -euo pipefail
umask 077

APP_DIR=${APP_DIR:-/srv/4inone}
COMPOSE_ENV=${COMPOSE_ENV:-/srv/4inone-data/docker.env}
[[ -f "$COMPOSE_ENV" ]] || { echo "$COMPOSE_ENV fehlt (Vorlage: deploy/docker/env.example)." >&2; exit 1; }
# Werte lesen, ohne die Datei als Shell-Skript auszuführen
env_value() { grep -E "^$1=" "$COMPOSE_ENV" | tail -n1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }

compose() { docker compose -f "$APP_DIR/deploy/docker/compose.yml" --env-file "$COMPOSE_ENV" "$@"; }
manage() { compose exec -T backend python manage.py "$@"; }

backup() {
  local data_dir keep remote recipient stamp work target
  data_dir=$(env_value DATA_DIR)
  [[ -f "$data_dir/backup.env" ]] && source "$data_dir/backup.env"
  recipient=${AGE_RECIPIENT:-}
  keep=${KEEP_DAYS:-14}
  remote=${BACKUP_REMOTE:-}
  [[ -n "$recipient" ]] || { echo "AGE_RECIPIENT fehlt — ohne Verschlüsselung wird nichts gesichert." >&2; exit 1; }
  command -v age >/dev/null || { echo "age fehlt: sudo apt install age" >&2; exit 1; }

  stamp=$(date +%Y-%m-%d_%H%M)
  mkdir -p "$data_dir/backups"
  work=$(mktemp -d)
  trap 'rm -rf "$work"' RETURN
  # pg_dump läuft IM Postgres-Container (gleiche Hauptversion); das Passwort verlässt den Container nicht.
  compose exec -T postgres sh -c 'pg_dump --format=custom --no-owner -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$work/db.dump"
  [[ -s "$work/db.dump" ]] || { echo "Datenbank-Sicherung ist leer." >&2; exit 1; }
  if [[ -d "$data_dir/private_media" ]]; then
    tar -C "$data_dir" -cf "$work/private_media.tar" private_media
  fi
  target="$data_dir/backups/4inone_$stamp.tar.age"
  tar -C "$work" -cf - . | age -r "$recipient" -o "$target"
  echo "Backup geschrieben: $target ($(du -h "$target" | cut -f1))"
  find "$data_dir/backups" -name '4inone_*.tar.age' -mtime +"$keep" -delete
  if [[ -n "$remote" ]]; then
    rsync -a "$target" "$remote"
  else
    echo "WARNUNG: BACKUP_REMOTE ist leer — ein Backup auf demselben Gerät schützt nicht vor dessen Ausfall." >&2
  fi
}

case "${1:-}" in
  backup)    backup ;;
  cleanup)   manage cleanup_expired; manage prune_connections ;;
  prune)     manage prune_website; manage prune_auth_events ;;
  reminders) manage send_reminder_emails ;;
  calendars) manage refresh_calendar_subscriptions ;;
  *) echo "Aufruf: $0 backup|cleanup|prune|reminders|calendars" >&2; exit 2 ;;
esac
