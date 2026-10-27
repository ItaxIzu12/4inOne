# Go-Live-Checkliste (Stand 25.10.2026)

Was technisch vorbereitet ist und was vor dem Livegang noch **von dir** kommen muss.
Die Einrichtung des Servers Schritt für Schritt (von null): [`deploy/ANLEITUNG.md`](../deploy/ANLEITUNG.md).

## Muss vor dem Livegang erledigt sein

1. **Impressum, Datenschutzerklärung, Nutzungsbedingungen** — derzeit Platzhalter (`frontend/src/app/features/
   impressum|datenschutz|nutzungsbedingungen`). Impressum mit Name, Anschrift, E-Mail (§ 5 DDG). Die
   Datenschutzerklärung muss u. a. nennen:
   - Konto und Anmeldung (E-Mail, Name, Passwort-Hash, Sitzungen, Zwei-Faktor),
   - die Inhalte in Finanzen, Haushalt, Organisation, Reisen und hochgeladene Dateien,
   - **Besucherzählung**: nur Tageszähler je öffentlicher Seite und Gerätegröße (Handy/Computer), keine Cookies, keine
     IP-Adresse, keine Kennung; „Do Not Track“/„Global Privacy Control“ werden beachtet; Löschung nach
     `PAGEVIEW_RETENTION_DAYS` (Standard 730 Tage),
   - technisch notwendige Cookies (`refresh_token`, `csrftoken`, dazu der Hinweis `4io_signed_in=1`: kein Geheimnis,
     keine Kennung, nur „angemeldet: ja“, damit der Webserver unter `/` die App statt der Landingpage ausliefert;
     läuft nach 7 Tagen ab bzw. wird beim Abmelden gelöscht) und die eine Browser-Einstellung im Einkaufsmodus.
   Danach den Platzhalter-Hinweis in `shared/legal-page/legal-page.html` entfernen.
2. **Domain eintragen:** `cd frontend && npm run seo -- https://deine-domain.de` — erzeugt `sitemap.xml`, ergänzt
   `robots.txt` und setzt die vollen Adressen für das Teilen-Bild.
3. **Server-Umgebung** (`.env`, siehe `.env.example`; `manage.py check --deploy` muss ohne Fehler laufen):
   `DEBUG=False`, eigener `SECRET_KEY`, `ALLOWED_HOSTS`, `DATABASE_URL` (PostgreSQL), `EMAIL_HOST`/… (echter
   Mailserver), `RATE_LIMIT_CACHE=database` + einmal `manage.py createcachetable`,
   `PRIVATE_MEDIA_ROOT` auf ein gesichertes Volume, `ADMIN_URL_PATH` auf einen eigenen Wert, `BEHIND_PROXY=True`
   nur hinter genau einem vertrauenswürdigen Proxy.
4. **Täglicher Cron-Job:** `python manage.py prune_website` (löscht abgelaufene Zähler der Besucherzählung).
5. **Webserver (nginx):** fertige Konfiguration in `deploy/nginx/` — `4inone.conf` plus zwei Snippets nach
   `/etc/nginx/snippets/`. Darin vor dem Einsatz Domain, Pfad zu `frontend/dist/frontend/browser` und den Admin-Pfad
   (`ADMIN_URL_PATH`) eintragen, dann `nginx -t`. Sie regelt:
   - **Vorgerenderte Seiten:** `/`, `/impressum`, `/datenschutz`, `/nutzungsbedingungen`, `/barrierefreiheit` liegen als
     fertiges HTML im Build (`app.routes.server.ts`); alle anderen Adressen bekommen `index.csr.html` (die App).
   - **Startseite `/`:** mit Cookie `4io_signed_in=1` die App (Dashboard), sonst die vorgerenderte Landingpage
     (`Vary: Cookie`). Wer angemeldet ist, aber den Hinweis noch nicht hat (z. B. direkt nach dem Update), wird einmal
     neu geladen (`app.config.ts`).
   - `/api/` und der Admin-Pfad an gunicorn auf `127.0.0.1:8000`, `X-Forwarded-For` nur mit der echten Gegenstelle;
     Django dazu mit `BEHIND_PROXY=True`. Uploads bis 12 MB.
   - HTML mit `Cache-Control: no-cache`, gehashte Dateien (`main-/chunk-/styles-XXXX`) ein Jahr `immutable`.
   - Unbekannte Adressen zeigen die 404-Seite mit `noindex`, aber HTTP-Status 200 (die App kennt ihre Routen erst im
     Browser).
   Lokal nicht mit echtem nginx getestet (auf dem Entwicklungsrechner nicht installiert); das Verhalten wurde mit einem
   kleinen Node-Server nachgestellt (gleiche Weiche, gleiche Header) und im Browser geprüft.
6. **Sicherheits-Header für die Angular-Seite** — stehen in `deploy/nginx/snippets/4inone-security-headers.conf`
   (in jeder `location` eingebunden, weil nginx sonst die Header des server-Blocks verwirft): CSP mit
   `script-src 'self'` und `connect-src 'self'`, HSTS, `nosniff`, `X-Frame-Options: DENY`/`frame-ancestors 'none'`,
   `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`. Getestet am 25.10.2026 mit dem
   Produktions-Build (vorgerenderte Landingpage, Rechtsseiten, Demo, Login): kein CSP-Verstoß. Damit das so bleibt:
   `inlineCritical: false` (`angular.json`) und Hydration ohne Event-Replay (`withNoIncrementalHydration()` in
   `app.config.ts`) — beides würde sonst Inline-Skripte ins HTML legen. Ein e2e-Test prüft das
   (`landing-journey.spec.ts`). Liegt die API auf einer anderen Domain, diese in `connect-src` ergänzen.
7. **Django-Admin-Gestaltung:** es gibt noch kein `STATIC_ROOT`/`collectstatic` — der Admin läuft, aber ohne CSS.
   Bei Bedarf `STATIC_ROOT` setzen, `collectstatic` ausführen und in nginx `location /static/` darauf zeigen lassen.

## Bereits erledigt

- Platzhalter-Hinweis auf den Rechtsseiten nennt keine internen Dateien mehr (25.10.2026).
- Kein Cookie-Banner nötig: nur technisch notwendige Cookies, Schrift selbst gehostet, kein Tracking von Dritten.
- Seitentitel und Meta-Beschreibung je öffentlicher Seite, Teilen-Bild (Open Graph / Twitter), Favicon,
  Apple-Touch-Icon, Manifest-Icons, `robots.txt`, 404-Seite. Ein Kontaktformular gibt es bewusst nicht (entfernt 21.10.2026); Kontaktweg ist die E-Mail im Impressum.
- Sicherheits-Updates: Django 6.1.1, PyJWT 2.15.0; `pip-audit` und `npm audit` ohne Befund.

## Besucherzahlen ansehen

Im Django-Admin unter „Öffentliche Website › Seitenaufrufe“ (Filter nach Seite, Gerät, Tag).
