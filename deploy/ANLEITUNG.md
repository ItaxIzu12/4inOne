# 4inOne live stellen — Schritt für Schritt von null

Für einen eigenen Linux-Server (Ubuntu 24.04 LTS) mit nginx. Jeder Schritt baut auf dem vorigen auf. Befehle mit
`sudo` brauchen Administratorrechte, alle anderen laufen als Benutzer `deploy`.

> **Ehrlicher Stand (25.10.2026):** Alle Dateien in `deploy/` sind vorbereitet und auf Syntax geprüft, aber noch
> nicht auf einem echten Server gelaufen. Spiel den Ablauf deshalb zuerst auf einer Testumgebung durch
> (z. B. `staging.4inone.de`) und nimm erst danach die richtige Domain.

## Überblick

```
Besucher ──HTTPS──▶ nginx ──┬─▶ /srv/4inone-web      (Angular, statisch, öffentliche Seiten vorgerendert)
                            └─▶ /api/ ─▶ gunicorn/Django (127.0.0.1:8000) ─┬─▶ PostgreSQL
                                                                        └─▶ Redis
```

| Ort auf dem Server | Inhalt |
|---|---|
| `/srv/4inone` | der Code (git clone), inkl. `backend/.env` |
| `/srv/4inone-web` | die gebaute Seite (wird bei jedem Update ersetzt) |
| `/srv/4inone-data/private_media` | hochgeladene Dateien der Nutzer |
| `/srv/4inone-data/backups` | verschlüsselte Backups (zusätzlich an einem anderen Ort!) |

Fertige Dateien in diesem Ordner:

| Datei | Zweck |
|---|---|
| `nginx/4inone.conf`, `nginx/snippets/*` | Webserver, HTTPS, Sicherheits-Header |
| `systemd/4inone.service` | Django als Dienst |
| `systemd/4inone-prune.*` | täglich alte Besucherzähler löschen |
| `systemd/4inone-backup.*` | tägliches Backup |
| `scripts/backup.sh` | Backup (Datenbank + Dateien, verschlüsselt) |
| `scripts/update.sh` | Update einspielen |

---

## 0. Bevor es losgeht

- [ ] **Domain** gekauft. Zwei DNS-Einträge zeigen auf die IP des Servers: `A` (IPv4), und `AAAA` (IPv6), falls
      vorhanden.
- [ ] **Server** mit Ubuntu 24.04, Rechenzentrum in der EU, Auftragsverarbeitungsvertrag (AVV) mit dem Anbieter
      abgeschlossen. Anfangs reichen 2 CPU und 4 GB RAM.
- [ ] **E-Mail-Versand (SMTP)** bei einem EU-Anbieter, mit Zugangsdaten. Die Absender-Domain ist mit SPF und DKIM
      eingerichtet, sonst landen Mails im Spam.
- [ ] **Rechtstexte** für Impressum, Datenschutz und Nutzungsbedingungen liegen vor (siehe Schritt 11).
- [ ] **Passwort-Manager** bereit: Alle Geheimnisse (SECRET_KEY, Datenbank-Passwort, Backup-Schlüssel) kommen dort
      hinein und nirgends sonst.
- [ ] **Lokal einmal ausgeführt und committet:** `cd frontend && npm run seo -- https://4inone.de`. Das trägt die
      Domain in `robots.txt`, `sitemap.xml` und das Teilen-Bild ein. Bitte nicht auf dem Server ausführen: Das Skript
      ändert Dateien im Repository, und das nächste Update würde dann abbrechen.

## 1. Server absichern

Als `root` per SSH anmelden (beim allerersten Mal):

```bash
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy:deploy /home/deploy/.ssh
```

Neu als `deploy` anmelden und prüfen, dass es klappt. **Erst dann** Passwort-Login und Root-Login abschalten. In
`/etc/ssh/sshd_config` stehen dafür `PasswordAuthentication no` und `PermitRootLogin no`. Danach:

```bash
sudo systemctl restart ssh
```

Firewall: nur SSH, HTTP und HTTPS sind von außen erreichbar.

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

Automatische Sicherheitsupdates:

```bash
sudo apt update && sudo apt install -y unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades
```

## 2. Software installieren

```bash
sudo apt install -y nginx certbot python3-certbot-nginx postgresql redis-server git rsync age python3.13 python3.13-venv
```

Node 24 brauchst du nur zum Bauen der Seite. Installiere es über das offizielle Paket von nodejs.org (Version 24),
nicht über das ältere Ubuntu-Paket. Prüfen:

```bash
python3.13 --version && node --version && psql --version
```

Falls `python3.13` in den Ubuntu-Paketquellen fehlt, eine Python-3.13-Installation des Server-Anbieters oder
`pyenv` nehmen. Lokal läuft das Projekt mit 3.13.

PostgreSQL und Redis lauschen nach der Installation nur auf `localhost`. Das bleibt so.

## 3. Datenbank anlegen

```bash
sudo -u postgres psql -c "CREATE USER fourinone WITH PASSWORD 'HIER-LANGES-ZUFALLSPASSWORT';"
sudo -u postgres psql -c "CREATE DATABASE fourinone OWNER fourinone;"
```

Das Passwort erzeugst du mit `openssl rand -base64 32` und legst es im Passwort-Manager ab.

## 4. Ordner und Code

```bash
sudo mkdir -p /srv/4inone /srv/4inone-web /srv/4inone-data/private_media /srv/4inone-data/backups
sudo chown -R deploy:deploy /srv/4inone /srv/4inone-web /srv/4inone-data
chmod 700 /srv/4inone-data
git clone https://github.com/ItaxIzu12/4inOne.git /srv/4inone
```

Ist das Repository privat, legst du auf dem Server einen eigenen SSH-Schlüssel an und hinterlegst ihn bei GitHub
als Deploy Key (nur Lesen).

## 5. Backend einrichten

```bash
cd /srv/4inone/backend
python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt pip-audit
cp ../.env.example .env && chmod 600 .env
```

`backend/.env` bearbeiten (`nano .env`). Die Werte für Produktion:

```ini
DEBUG=False
SECRET_KEY=                      # neu erzeugen, siehe Kommentar in der Datei — NIE den lokalen nehmen
ALLOWED_HOSTS=4inone.de
ADMIN_URL_PATH=                  # zufällig, z. B. python3 -c "import secrets; print(secrets.token_urlsafe(12))"

DATABASE_URL=postgres://fourinone:PASSWORT@localhost:5432/fourinone
REDIS_URL=redis://localhost:6379/0
RATE_LIMIT_CACHE=database

FRONTEND_URL=https://4inone.de
CORS_ALLOWED_ORIGINS=https://4inone.de
CSRF_TRUSTED_ORIGINS=https://4inone.de

BEHIND_PROXY=True
PRIVATE_MEDIA_ROOT=/srv/4inone-data/private_media

EMAIL_HOST=smtp.dein-anbieter.example
EMAIL_PORT=587
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=4inOne <hallo@4inone.de>
```

Sonderzeichen im Datenbank-Passwort müssen in der `DATABASE_URL` kodiert werden, z. B. `@` als `%40`. Am einfachsten
nimmst du ein Passwort nur aus Buchstaben und Ziffern.

Danach einmalig:

```bash
.venv/bin/python manage.py migrate
.venv/bin/python manage.py createcachetable
.venv/bin/python manage.py createsuperuser
.venv/bin/python manage.py check --deploy
```

`check --deploy` darf **keine Fehler** melden. Warnungen liest du einzeln und behebst sie oder begründest sie.

Django als Dienst einrichten:

```bash
sudo cp /srv/4inone/deploy/systemd/4inone.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now 4inone
systemctl status 4inone
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/api/v1/auth/csrf/
```

Der `curl`-Befehl muss `200` liefern. Läuft der Dienst nicht, zeigt dir das Protokoll den Grund:

```bash
journalctl -u 4inone -n 50
```

## 6. Frontend bauen

```bash
cd /srv/4inone/frontend
npm ci
npx ng build
rsync -a dist/frontend/browser/ /srv/4inone-web/
ls /srv/4inone-web
```

In der Liste müssen `index.html` (vorgerenderte Landingpage), `index.csr.html` (App) und die Ordner `impressum`,
`datenschutz`, `nutzungsbedingungen` und `barrierefreiheit` stehen.

## 7. nginx und HTTPS

```bash
sudo cp /srv/4inone/deploy/nginx/snippets/*.conf /etc/nginx/snippets/
sudo cp /srv/4inone/deploy/nginx/4inone.conf /etc/nginx/sites-available/4inone.conf
sudo nano /etc/nginx/sites-available/4inone.conf
```

Im Editor ersetzt du zwei Dinge:
- `4inone.example` überall durch `4inone.de`, auch in den Zertifikatspfaden;
- `DJANGO_ADMIN` durch deinen `ADMIN_URL_PATH` (ohne Schrägstriche).

Zertifikat holen. Die Konfiguration verweist schon auf das Zertifikat, deshalb holst du es zuerst mit kurz
angehaltenem nginx:

```bash
sudo systemctl stop nginx
sudo certbot certonly --standalone -d 4inone.de
sudo systemctl start nginx
```

Seite einschalten:

```bash
sudo ln -s /etc/nginx/sites-available/4inone.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Das Zertifikat erneuert certbot automatisch. Damit nginx das neue Zertifikat auch lädt:

```bash
echo 'systemctl reload nginx' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh && sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo certbot renew --dry-run
```

## 8. Tägliche Aufgaben und Backups

**Backup-Schlüssel**: Auf **deinem eigenen Rechner**, nicht auf dem Server, erzeugst du:

```bash
age-keygen -o 4inone-backup.key
```

Die Datei `4inone-backup.key` ist der private Schlüssel. Du legst sie in den Passwort-Manager und zusätzlich offline
ab. Ohne sie lässt sich kein Backup öffnen. Die angezeigte Zeile `public key: age1…` trägst du auf dem Server ein:

```bash
cat > /srv/4inone-data/backup.env <<'EOF'
AGE_RECIPIENT=age1...dein-oeffentlicher-schluessel...
BACKUP_REMOTE=backup@speicher.example:4inone/
EOF
chmod 600 /srv/4inone-data/backup.env
```

`BACKUP_REMOTE` ist ein **anderer** Ort, z. B. eine Storage Box beim Hoster oder ein zweiter Server, erreichbar
per SSH-Schlüssel. Ein Backup nur auf demselben Server schützt nicht vor einem Ausfall des Servers.

Einmal von Hand testen:

```bash
/srv/4inone/deploy/scripts/backup.sh
```

Dann beide Zeitpläne einschalten (Backup 02:45 Uhr, Aufräumen 03:30 Uhr):

```bash
sudo cp /srv/4inone/deploy/systemd/4inone-{backup,prune}.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now 4inone-backup.timer 4inone-prune.timer
systemctl list-timers | grep 4inone
```

### Backup zurückspielen (einmal ausprobieren, bevor du es brauchst!)

Am besten auf einem Testserver:

```bash
age -d -i 4inone-backup.key 4inone_DATUM.tar.age | tar -xf - -C /tmp/restore
sudo systemctl stop 4inone
pg_restore --clean --if-exists --no-owner -d "postgres://fourinone:PASSWORT@localhost:5432/fourinone" /tmp/restore/db.dump
tar -xf /tmp/restore/private_media.tar -C /srv/4inone-data/
sudo systemctl start 4inone
```

## 9. Updates einspielen

Damit das Update-Skript Django neu starten darf, ohne nach dem Passwort zu fragen, braucht es einmalig eine Regel.
`sudo visudo -f /etc/sudoers.d/4inone` öffnen und diese eine Zeile eintragen:

```
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart 4inone
```

Danach geht jedes Update so (es macht vorher automatisch ein Backup):

```bash
/srv/4inone/deploy/scripts/update.sh
```

Das Skript holt den neuen Stand (nur vorspulen), installiert die Pakete, prüft auf bekannte Sicherheitslücken,
sichert die Daten, führt die Migrationen und `check --deploy` aus, baut die Seite, kopiert sie und startet Django neu.
Es bricht beim ersten Fehler ab.

## 10. Nach dem Start prüfen

- [ ] `http://4inone.de` leitet auf `https://` um, und die Landingpage erscheint.
- [ ] `curl -I https://4inone.de/` zeigt `content-security-policy`, `strict-transport-security`,
      `x-content-type-options` und `x-frame-options`. securityheaders.com ergibt mindestens A.
- [ ] Die Browser-Konsole (F12) zeigt keine roten CSP-Fehler, auf der Landingpage, in der Demo und beim Login.
- [ ] Registrieren, Bestätigungs-Mail kommt an, Anmelden, unter `/` erscheint das Dashboard. Nach dem Abmelden ist
      wieder die Landingpage zu sehen.
- [ ] Passwort-Reset: Die Mail kommt an, und der Link funktioniert.
- [ ] Organisation: Eine Datei hochladen und wieder herunterladen.
- [ ] Zwei-Faktor-Anmeldung einrichten und testen.
- [ ] `https://4inone.de/admin/` zeigt **keinen** Admin. Unter `https://4inone.de/DEIN-ADMIN-PFAD/` erscheint die
      Anmeldung.
- [ ] Am Handy: Die Seite lädt schnell, und der Demo-Knopf ist ohne Scrollen sichtbar.

## 11. Rechtliches vor dem öffentlichen Start

- [ ] Impressum mit Name, Anschrift und E-Mail (§ 5 DDG).
- [ ] Datenschutzerklärung. Sie nennt u. a.:
  - Konto, Inhalte und hochgeladene Dateien;
  - die cookielose Besucherzählung;
  - die technisch notwendigen Cookies `refresh_token`, `csrftoken` und `4io_signed_in` (nur „angemeldet: ja“,
    7 Tage);
  - Hoster und E-Mail-Anbieter als Auftragsverarbeiter.
- [ ] Nutzungsbedingungen.
- [ ] Danach den Platzhalter-Hinweis in `frontend/src/app/shared/legal-page/legal-page.html` entfernen, committen und
      ein Update einspielen.

Details und weitere Punkte stehen in [`docs/GO_LIVE.md`](../docs/GO_LIVE.md).

## Typische Fehler

| Anzeichen | Ursache |
|---|---|
| Endlose Umleitung, „zu viele Weiterleitungen“ | `BEHIND_PROXY=True` fehlt in `.env` |
| Anmeldung klappt, nach dem Neuladen bist du wieder abgemeldet | Seite läuft nicht über HTTPS (Cookies sind `Secure`) oder `CSRF_TRUSTED_ORIGINS` passt nicht zur Domain |
| `502 Bad Gateway` | Django läuft nicht. Ursache steht in `journalctl -u 4inone -n 50` |
| Seite ohne Gestaltung, Konsole meldet CSP | Build mit geänderter `angular.json` (`inlineCritical`) oder Hydration mit Event-Replay. Der e2e-Test `landing-journey.spec.ts` warnt davor |
| Admin ohne CSS | erwartet, solange es kein `collectstatic` gibt (`docs/GO_LIVE.md` Punkt 7) |
| Mails kommen nicht an | SMTP-Zugangsdaten, oder SPF/DKIM der Absender-Domain fehlen |
| Daten weg nach Neuinstallation | `DATABASE_URL` fehlte: Django lief still auf SQLite |
