# 4inOne mit Docker Compose betreiben (GEEKOM GT1 Mega)

Stand 24.11.2026 · Ergänzt den Weg ohne Container (`deploy/ANLEITUNG.md`), ersetzt ihn nicht.
Hintergrund und Ressourcenbudget: `docs/ARCHITECTURE.md` § 7.

## Überblick

```text
Heimnetz ──HTTPS──▶ web (nginx: Angular + Weiterleitung)  ──▶ backend (Django/gunicorn, 2 Worker)
                                                                  ├──▶ postgres (eigene Datenbank, nur 4inOne)
                                                                  └──▶ redis (nur Cache, ohne Platte)
Daten auf dem Gerät: /srv/4inone-data/{postgres,private_media,certs,backups}
Zeitpläne: systemd-Timer auf dem Gerät → deploy/docker/run-task.sh → `docker compose exec`
```

| Dienst | Speichergrenze | gemessen im Leerlauf (Probelauf 24.11.2026) |
|---|---:|---:|
| web | 64 MB | 13 MB |
| backend | 512 MB | 154 MB |
| postgres | 512 MB | 55 MB |
| redis | 96 MB | 10 MB |

Nur `web` hat Ports nach außen. Datenbank und Redis sind von außen nicht erreichbar. Das Backend läuft ohne Root,
mit schreibgeschütztem Dateisystem (nur `/data/private_media` und `/tmp` beschreibbar).

Vor dem Einspielen geänderter Betriebsdateien: `deploy/ci/check-deploy.sh` (läuft auch in CI, Job `deploy`).

## 1. Einmalig vorbereiten

```bash
sudo apt install -y docker.io docker-compose-v2 age git rsync
sudo adduser --disabled-password --gecos "" deploy && sudo usermod -aG docker deploy
sudo mkdir -p /srv/4inone-data/{postgres,private_media,certs,backups} && sudo chown -R deploy: /srv/4inone-data
sudo -u deploy git clone <dein-repository> /srv/4inone
```

Das Verzeichnis `private_media` muss für den Container-Benutzer (UID 10001) beschreibbar sein:

```bash
sudo chown 10001:10001 /srv/4inone-data/private_media
```

## 2. Einstellungen

Zwei Dateien, beide `chmod 600`, beide **nie** ins Repository:

1. `/srv/4inone-data/docker.env` aus `deploy/docker/env.example`: Datenverzeichnis, Datenbank-Zugang, Adresse,
   Admin-Pfad, Ports.
2. `/srv/4inone-data/backend.env` aus `.env.example`: die Django-Einstellungen wie beim Weg ohne Container
   (`SECRET_KEY`, `DEBUG=False`, `ALLOWED_HOSTS`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, Mailserver …).
   **Nicht** eintragen: `DATABASE_URL`, `REDIS_URL`, `PRIVATE_MEDIA_ROOT`, `BEHIND_PROXY`, `RATE_LIMIT_CACHE`,
   `ADMIN_URL_PATH`. Diese setzt `compose.yml` selbst passend zum Aufbau.

KI bleibt aus (`AI_ENABLED` nicht setzen). 4inOne läuft vollständig ohne den Personal AI Core
(`docs/AI_INTEGRATION.md`).

## 3. Zertifikat

nginx erwartet `/srv/4inone-data/certs/fullchain.pem` und `privkey.pem`. Je nach Erreichbarkeit:

- **Nur im Heimnetz:** eigene kleine Zertifizierungsstelle mit `mkcert`, Stammzertifikat auf den eigenen Geräten
  installieren: `mkcert -cert-file fullchain.pem -key-file privkey.pem 4inone.fritz.box`
- **Eigene Domain:** Let's Encrypt per DNS-Challenge (z. B. `certbot certonly --manual --preferred-challenges dns`),
  Dateien nach `certs/` kopieren und beim Erneuern `docker compose … restart web`.
- **Hinter Tailscale oder einem eigenen Proxy:** `BIND_ADDRESS=127.0.0.1` setzen und das Zertifikat dort beenden.

Die Sicherheits-Header verlangen HTTPS (HSTS, `upgrade-insecure-requests`). Reines HTTP ist nicht vorgesehen.

## 4. Starten

```bash
cd /srv/4inone
alias c='docker compose -f deploy/docker/compose.yml --env-file /srv/4inone-data/docker.env'
c build
c up -d postgres redis
c run --rm backend python manage.py migrate
c run --rm backend python manage.py createcachetable
c run --rm backend python manage.py check --deploy     # muss ohne Fehler durchlaufen (z. B. Mailserver nötig)
c up -d
c ps                                                   # alle Dienste „healthy“ bzw. „Up“
```

Prüfen: `https://<SERVER_NAME>/` zeigt die Startseite; `curl -I https://<SERVER_NAME>/` zeigt
`content-security-policy` und `strict-transport-security`.

## 5. Zeitpläne und Backup

```bash
cat > /srv/4inone-data/backup.env <<'EOF'
AGE_RECIPIENT=age1...dein-oeffentlicher-schluessel...
BACKUP_REMOTE=backup@zweiter-ort:4inone/
EOF
chmod 600 /srv/4inone-data/backup.env
sudo cp deploy/docker/systemd/4inone-docker@.service deploy/docker/systemd/4inone-docker-*.timer /etc/systemd/system/
sudo systemd-analyze verify /etc/systemd/system/4inone-docker@.service /etc/systemd/system/4inone-docker-*.timer
sudo systemctl daemon-reload
sudo systemctl enable --now 4inone-docker-{backup,cleanup,prune,reminders,calendars}.timer
systemctl list-timers | grep 4inone-docker
sudo systemctl start 4inone-docker@backup.service && journalctl -u 4inone-docker@backup -n 20 --no-pager
```

Gleiche Zeiten wie ohne Container: Backup 02:45, Aufräumen 03:15 und 03:30, Erinnerungen 07:00, Kalender-Abos stündlich.
Das Backup (`run-task.sh backup`) sichert die Datenbank per `pg_dump` im Postgres-Container und `private_media`,
verschlüsselt mit `age` und kopiert es an `BACKUP_REMOTE`. Ein Backup nur auf derselben SSD schützt nicht vor deren
Ausfall.

**Zurückspielen** (einmal ausprobieren, bevor man es braucht):

```bash
age -d -i 4inone-backup.key 4inone_DATUM.tar.age | tar -xf - -C /tmp/restore
c stop backend web
c exec -T postgres sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /tmp/restore/db.dump
tar -xf /tmp/restore/private_media.tar -C /srv/4inone-data/
c up -d
```

## 6. Updates

```bash
cd /srv/4inone && git pull
sudo systemctl start 4inone-docker@backup.service       # vorher sichern
c build && c run --rm backend python manage.py migrate && c up -d
c run --rm backend python manage.py check --deploy
```

Migrationen sind in 4inOne nur additiv (`docs/DECISIONS.md` D19). Trotzdem vor jedem Update sichern.

## Grenzen

- Kein automatisches Zertifikat-Erneuern im Container. Das hängt vom gewählten Weg in Schritt 3 ab.
- GlitchTip (`monitoring/`) ist nicht Teil dieses Stacks; bei Bedarf separat starten (~1 GB RAM).
- Der Personal AI Core läuft als eigener Stack mit eigener Datenbank und wird später über ein eigenes Docker-Netz
  angebunden (`docs/AI_INTEGRATION.md`).
