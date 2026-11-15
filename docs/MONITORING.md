# Fehler-Monitoring und Admin-Panel (seit 15.11.2026)

**Was du davon hast:** Stürzt in 4inOne etwas ab oder fällt eine Anmeldung auf (falsches Passwort, Sperre nach zu
vielen Versuchen, falscher Zwei-Faktor-Code), meldet GlitchTip das — mit Codezeile und Häufigkeit, per Mail, sobald
ein Mailserver eingetragen ist. Im **Admin-Panel** (`/admin`) siehst du alle Anmeldungen, Fehlversuche, Sperren und die
offenen Fehler auf einen Blick.

## Aufbau — drei getrennte Teile, eine Verbindung

| Teil | Ordner | Aufgabe |
|---|---|---|
| **GlitchTip** (Open Source, Sentry-kompatibel) | `monitoring/` (Projektwurzel) | eigener Dienst in Docker mit eigener Datenbank: sammelt Fehler, gruppiert, alarmiert |
| **Anbindung im Backend** | `backend/monitoring/` | Sentry-SDK mit Datenschutz-Filter, Anmelde-Ereignisse, Admin-API, Tunnel |
| **Anbindung im Frontend + Admin-Seite** | `frontend/src/app/core/monitoring/`, `features/admin/` | Fehler aus dem Browser (SDK erst bei Bedarf nachgeladen), Admin-Panel |

```
Browser ──Fehler──▶ 4inOne-Backend /api/v1/monitoring/tunnel/ ──▶ GlitchTip (127.0.0.1:8001)
Backend ──Fehler + auffällige Anmeldungen (Sentry-SDK)────────────▶ GlitchTip
Admin-Panel ◀── /api/v1/admin/… (Ereignisse aus der 4inOne-DB, offene Fehler über die GlitchTip-API)
```

Der Browser schickt nie direkt an GlitchTip, sondern über den **Tunnel** im eigenen Backend: so bleibt die
Content-Security-Policy bei `connect-src 'self'`, und Werbeblocker fangen nichts ab.

## Einrichtung (lokal, einmalig)

1. GlitchTip starten:
   ```bash
   ./monitoring/glitchtip.sh init
   ./monitoring/glitchtip.sh up
   ```
   → <http://localhost:8001>. Die Schlüssel stehen in `monitoring/.env` (zufällig erzeugt, in `.gitignore`).
2. In GlitchTip **ein Konto anlegen** (nur das erste Konto darf sich selbst registrieren), dann eine
   **Organisation** (z. B. `4inone`) und ein **Projekt** (Plattform „Django“) erstellen.
3. Projekt › Einstellungen › **Client Keys** › DSN kopieren und in `backend/.env` eintragen:
   ```
   SENTRY_DSN=http://<schlüssel>@localhost:8001/1
   GLITCHTIP_URL=http://localhost:8001
   GLITCHTIP_ORG=4inone
   ```
4. Optional für die Fehlerliste im Admin-Panel: GlitchTip › Profil › **Auth Tokens**, nur Leserechte
   (`org:read`, `project:read`, `event:read`) → `GLITCHTIP_API_TOKEN=…` in `backend/.env`.
5. Migrationen (`python manage.py migrate`: `core/0018_usersession_mfa_verified`, `monitoring/0001_initial`) und Django
   neu starten.
6. **Admin-Zugang** für dein Konto vergeben — geht nur über die Kommandozeile, nie über die App:
   ```bash
   cd backend && .venv/bin/python manage.py monitoring_admin deine@adresse.de
   ```
   Dann in 4inOne **Zwei-Faktor einrichten**, einmal ab- und mit Code wieder anmelden → Kontomenü › „Admin-Panel“.
   Entziehen: `monitoring_admin deine@adresse.de --remove`.
7. Alarm-Mails: in GlitchTip unter Projekt › **Alerts** einrichten. Ohne Mailserver landen Mails nur im Protokoll
   (`./monitoring/glitchtip.sh logs`); echter Versand mit `GLITCHTIP_EMAIL_URL=smtp://…` in `monitoring/.env`.

## Was gemeldet wird

| Ereignis | Admin-Panel | GlitchTip |
|---|---|---|
| Unbehandelter Fehler (Backend, Browser) | Liste „Offene Fehler“ (mit API-Token) | ✅ Fehler mit Codezeile |
| Anmeldung fehlgeschlagen | ✅ | ✅ Warnung, gruppiert („Anmeldung fehlgeschlagen“ mit Zähler) |
| Gesperrt nach zu vielen Versuchen (axes) | ✅ | ✅ Fehler |
| Zwei-Faktor-Code falsch | ✅ | ✅ Warnung |
| Angemeldet, registriert, Passwort-Reset | ✅ | — (bewusst: nur Auffälliges alarmiert) |

## Datenschutz

- **An GlitchTip:** keine E-Mail-Adressen, keine IP, keine Nutzerkennung, keine Anfrage-Inhalte, Cookies, Header
  (außer Content-Type/Accept/User-Agent) oder Query-Strings, keine lokalen Variablen. Doppelt abgesichert: das SDK
  sammelt standardmäßig keine Personendaten, zusätzlich entfernt `scrub_event` (Backend) bzw. `scrubBrowserEvent`
  (Frontend) alles Genannte und ersetzt E-Mail-Adressen in Texten durch „[E-Mail]“. Keine Leistungsmessung.
- **Im Admin-Panel / in der 4inOne-DB (`AuthEvent`):** Art, Zeitpunkt, Konto (falls bekannt), IP **gekürzt**
  (IPv4 /24, IPv6 /48). Eine bei Fehlversuchen eingetippte Adresse wird nie gespeichert. E-Mails im Panel maskiert
  (`s•••@example.com`). Aufbewahrung 90 Tage (`AUTH_EVENT_RETENTION_DAYS`, `manage.py prune_auth_events` täglich
  über `4inone-prune.timer`). Konto gelöscht → Ereignis ohne Personenbezug bis zum Fristende. Im DSGVO-Export unter
  `konto.json › anmelde_ereignisse`.
- **Rechtsgrundlage:** berechtigtes Interesse (Sicherheit, Fehlerbehebung). In der Datenschutzerklärung nennen.
  GlitchTip läuft selbst betrieben — kein Drittanbieter, keine AVV nötig.

## Bedrohungsmodell (STRIDE, cybersecurity-analyst + security-review, 15.11.2026)

| Bedrohung | Maßnahme | Test |
|---|---|---|
| Fremde öffnen das Admin-Panel / setzen sich Admin-Rechte | jede Anfrage: `is_staff` + aktiv + **diese Sitzung mit Zwei-Faktor angemeldet** (`UserSession.mfa_verified`); Rechte nur per `monitoring_admin` | `monitoring/tests.py` (`…two_factor_session`, `admin_rights_only_via_command…`) |
| Tunnel als offener Proxy (SSRF) | Ziel nur aus `SENTRY_DSN`; abweichende Adresse, Port, Schema, Schlüssel oder Projekt → 400; 512 kB, 60/min/IP | `test_tunnel_*` |
| Personendaten in Berichten | Filter im Backend und Browser | `test_scrub_*`, `monitoring.spec.ts` |
| Brute-Force flutet Protokoll/GlitchTip | Login-Limits + axes wie bisher, Gruppierung je Art, 90-Tage-Aufräumen | `test_lockout_*`, `test_old_events_are_pruned` |
| Admin missbraucht das Panel | nur lesend, maskierte Adressen, gekürzte IPs | `test_overview_counts_and_events_list_with_masked_addresses` |
| GlitchTip von außen erreichbar / schwache Geheimnisse | nur 127.0.0.1, Datenbank nicht veröffentlicht, mit Passwort statt „trust“, Registrierung nach dem ersten Konto zu, kein Django-Admin | `monitoring/compose.yml` |

Gefunden und behoben im Review: das Panel prüfte zunächst nur „Konto hat Zwei-Faktor“ — eine Sitzung von vor dem
Einschalten hätte genügt. Jetzt zählt die Sitzung.

## Auf dem Server

- GlitchTip mit derselben `monitoring/compose.yml` betreiben; davor nginx mit TLS auf einer eigenen Subdomain
  (z. B. `fehler.deinedomain.de`), `GLITCHTIP_DOMAIN`/`GLITCHTIP_ALLOWED_HOSTS` in `monitoring/.env` darauf setzen,
  `client_max_body_size 40M`. Zugang zur GlitchTip-Oberfläche zusätzlich beschränken (VPN/IP-Liste oder Basic Auth).
- `SENTRY_DSN` zeigt dann auf diese Adresse; die CSP der App bleibt unverändert (Browser sendet über den Tunnel).
- `SENTRY_ENVIRONMENT=produktion`, optional `SENTRY_RELEASE` (z. B. Git-Commit) für „seit welcher Version“.
- Backups: die GlitchTip-Datenbank ist entbehrlich (Fehlerberichte), muss also nicht ins 4inOne-Backup.
