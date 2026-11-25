#!/usr/bin/env bash
# 4inOne — Betriebsdateien prüfen, bevor sie auf einen Server kommen (docs/ARCHITECTURE.md § 10.3 B, 25.11.2026).
#
# Läuft in CI (.github/workflows/tests.yml › Job „deploy“) und lokal auf Linux mit Docker:
#   deploy/ci/check-deploy.sh            # alles
#   deploy/ci/check-deploy.sh nginx      # nur einzelne Prüfungen: shell | nginx | compose | systemd
#
# Prüft:
#   shell    shellcheck für die Betriebsskripte
#   nginx    `nginx -t` für deploy/nginx/4inone.conf (systemd-Weg) und die Docker-Vorlage (mit eingesetzten Werten)
#   compose  `docker compose config` für deploy/docker/compose.yml mit den Werten aus env.example
#   systemd  `systemd-analyze verify` für alle Units und Timer beider Wege
# Es werden keine Geheimnisse gebraucht: Zertifikate sind selbst signierte Wegwerf-Zertifikate.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
NGINX_IMAGE=${NGINX_IMAGE:-nginx:1.28-alpine}   # gleiche Version wie deploy/docker/web.Dockerfile
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

step() { printf '\n== %s\n' "$1"; }

check_shell() {
  step 'shellcheck'
  shellcheck -S warning "$ROOT"/deploy/scripts/*.sh "$ROOT"/deploy/docker/run-task.sh "$ROOT"/deploy/ci/check-deploy.sh
  echo 'ok'
}

make_cert() {
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj '/CN=4inone.test' \
    -keyout "$1/privkey.pem" -out "$1/fullchain.pem" 2>/dev/null
}

check_nginx() {
  step 'nginx -t: deploy/nginx/4inone.conf (systemd-Weg)'
  mkdir -p "$WORK/le"
  make_cert "$WORK/le"
  # „backend“ bzw. 127.0.0.1 müssen beim Test auflösbar sein; die Seite selbst muss nicht existieren
  docker run --rm --add-host backend:127.0.0.1 \
    -v "$ROOT/deploy/nginx/4inone.conf:/etc/nginx/conf.d/default.conf:ro" \
    -v "$ROOT/deploy/nginx/snippets:/etc/nginx/snippets:ro" \
    -v "$WORK/le:/etc/letsencrypt/live/4inone.example:ro" \
    --entrypoint nginx "$NGINX_IMAGE" -t

  step 'nginx -t: deploy/docker/nginx/4inone.conf.template (Docker-Weg)'
  mkdir -p "$WORK/certs" "$WORK/snippets"
  make_cert "$WORK/certs"
  cp "$ROOT/deploy/docker/nginx/proxy.conf" "$WORK/snippets/4inone-proxy.conf"
  cp "$ROOT/deploy/nginx/snippets/4inone-security-headers.conf" "$WORK/snippets/"
  # Platzhalter einsetzen wie das nginx-Image beim Start (nur diese beiden; nginx-Variablen bleiben)
  sed -e 's/${SERVER_NAME}/4inone.test/g' -e 's/${ADMIN_URL_PATH}/verwaltung-test/g' \
    "$ROOT/deploy/docker/nginx/4inone.conf.template" > "$WORK/docker.conf"
  if grep -q '\${' "$WORK/docker.conf"; then
    echo 'Unbekannter Platzhalter in der Docker-Vorlage:' >&2; grep -n '\${' "$WORK/docker.conf" >&2; exit 1
  fi
  docker run --rm --add-host backend:127.0.0.1 \
    -v "$WORK/docker.conf:/etc/nginx/conf.d/default.conf:ro" \
    -v "$WORK/snippets:/etc/nginx/snippets:ro" \
    -v "$WORK/certs:/etc/nginx/certs:ro" \
    --entrypoint nginx "$NGINX_IMAGE" -t
}

check_compose() {
  step 'docker compose config: deploy/docker/compose.yml'
  # Werte aus env.example, leere Pflichtwerte mit Wegwerf-Inhalt füllen
  sed -e 's/^POSTGRES_PASSWORD=$/POSTGRES_PASSWORD=ci0only0not0a0secret/' \
      -e 's/^ADMIN_URL_PATH=$/ADMIN_URL_PATH=verwaltung-test/' \
      -e "s#^DATA_DIR=.*#DATA_DIR=$WORK/data#" \
      -e "s#^ENV_FILE=.*#ENV_FILE=$WORK/backend.env#" \
      "$ROOT/deploy/docker/env.example" > "$WORK/docker.env"
  : > "$WORK/backend.env"
  docker compose -f "$ROOT/deploy/docker/compose.yml" --env-file "$WORK/docker.env" config -q
  echo 'ok'
}

check_systemd() {
  step 'systemd-analyze verify: deploy/systemd und deploy/docker/systemd'
  local units="$WORK/units" prefix="$WORK/root" exe rel bad=0
  # Jedes aufgerufene Programm muss es geben: Skripte im Repository (ausführbar), aus der venv nur python/gunicorn.
  # (systemd-analyze prüft das nicht für jede ExecStart-Zeile.)
  while read -r exe; do
    rel=${exe#/srv/4inone/}
    case "$rel" in
      backend/.venv/bin/python | backend/.venv/bin/gunicorn) ;;
      backend/.venv/*) echo "Unbekanntes Programm in der venv: $exe" >&2; bad=1 ;;
      *) [[ -x "$ROOT/$rel" ]] || { echo "Fehlt oder nicht ausführbar im Repository: $exe" >&2; bad=1; } ;;
    esac
  done < <(grep -h '^ExecStart=' "$ROOT"/deploy/systemd/*.service "$ROOT"/deploy/docker/systemd/*.service \
             | sed -e 's/^ExecStart=[-@:+!]*//' -e 's/ .*//' | grep '^/srv/4inone/' | sort -u)
  [[ $bad -eq 0 ]] || exit 1
  mkdir -p "$units"
  # Die Units zeigen auf /srv/4inone…, das es hier nicht gibt: Pfade in ein Wegwerf-Verzeichnis umlenken und die
  # aufgerufenen Programme als leere Skripte anlegen (verify prüft, dass sie existieren und ausführbar sind).
  for file in "$ROOT"/deploy/systemd/* "$ROOT"/deploy/docker/systemd/*; do
    sed "s#/srv/4inone#$prefix/srv/4inone#g" "$file" > "$units/$(basename "$file")"
  done
  for exe in backend/.venv/bin/python backend/.venv/bin/gunicorn deploy/scripts/backup.sh deploy/docker/run-task.sh; do
    mkdir -p "$(dirname "$prefix/srv/4inone/$exe")"
    printf '#!/bin/sh\n' > "$prefix/srv/4inone/$exe"
    chmod +x "$prefix/srv/4inone/$exe"
  done
  mkdir -p "$prefix/srv/4inone-data" "$prefix/srv/4inone/backend"
  # Vorlage als Instanz prüfen; docker.service als Ersatz, falls auf dem Prüfrechner kein Docker-Dienst existiert
  cp "$units/4inone-docker@.service" "$units/4inone-docker@backup.service"
  printf '[Unit]\nDescription=Ersatz für die Prüfung\n[Service]\nExecStart=/bin/true\n' > "$units/docker.service"
  local list=()
  for file in "$units"/4inone*.service "$units"/4inone*.timer; do
    [[ "$file" == *@.service ]] || list+=("$file")   # die Vorlage selbst nicht (nur als Instanz prüfbar)
  done
  SYSTEMD_UNIT_PATH="$units:" systemd-analyze verify --man=no "${list[@]}"
  echo "ok (${#list[@]} Dateien)"
}

steps=("$@")
[[ ${#steps[@]} -gt 0 ]] || steps=(shell nginx compose systemd)
for name in "${steps[@]}"; do
  case "$name" in
    shell) check_shell ;;
    nginx) check_nginx ;;
    compose) check_compose ;;
    systemd) check_systemd ;;
    *) echo "Unbekannte Prüfung: $name (shell | nginx | compose | systemd)" >&2; exit 2 ;;
  esac
done
printf '\nBetriebsdateien: alle Prüfungen bestanden.\n'
