# Notiz 25.10.2026: Offene Punkte der Landingpage V4

Zusammenfassung zum Aufheben: was umgesetzt ist, wie es funktioniert und was vor dem Livegang noch zu tun bleibt.
Die laufend gepflegte Checkliste ist [`docs/GO_LIVE.md`](GO_LIVE.md); diese Notiz ist der Stand vom 25.10.2026.

**Teststand:** 430 Unit-Tests und 300 e2e-Tests grün, der Produktions-Build rendert 5 Seiten vor.
**Migration:** keine. **Commit:** keiner (noch nicht committet).

---

## 1. Vorrendern der öffentlichen Seiten

**Was:** `/`, `/impressum`, `/datenschutz`, `/nutzungsbedingungen` und `/barrierefreiheit` werden beim Build als
fertiges HTML erzeugt. Alles andere (Demo, App, Login …) läuft wie bisher nur im Browser (`index.csr.html`).

**Warum:** Inhalt sofort sichtbar (schneller auf dem Handy), lesbar für Suchmaschinen und ohne JavaScript.

**Wie:**
- Pakete: `@angular/ssr@22.2.3`, `@angular/platform-server@22.2.3` (`npm audit`: 0 Befunde).
- `angular.json`: `"server": "src/main.server.ts"`, `"outputMode": "static"`. Es läuft **kein Node-Server** im
  Betrieb, nur statische Dateien.
- Neue Dateien: `src/main.server.ts`, `src/app/app.config.server.ts`, `src/app/app.routes.server.ts` (welche Seiten
  vorgerendert werden).
- `app.config.ts`:
  - `provideClientHydration(withNoIncrementalHydration())`. Die inkrementelle Hydration (Standard in Angular 22)
    bringt Event-Replay mit. Event-Replay legt Inline-Skripte ins HTML, die die strenge CSP blockieren würde.
    Nachteil: Ein Klick in den ersten Millisekunden vor dem Laden geht verloren.
  - Besucherzählung und Anmelde-Prüfung laufen nur im Browser, nicht beim Vorrendern.
- `core/api.config.ts`: kein Zugriff auf `window` beim Vorrendern.

### Startseite `/`: Besucher bekommen die Landingpage, Angemeldete das Dashboard

- Beim Anmelden setzt die App das Hinweis-Cookie **`4io_signed_in=1`** (`core/auth/auth.service.ts` ›
  `SIGNED_IN_HINT`).
  - Es enthält kein Geheimnis und keine Kennung und gibt keine Rechte.
  - Es läuft nach 7 Tagen ab (so lange wie die Anmeldung) und wird beim Abmelden gelöscht.
- nginx liefert unter `/` mit diesem Cookie die App (`index.csr.html`), ohne es die vorgerenderte Landingpage.
- **Sonderfall:** Jemand ist angemeldet, hat das Cookie aber noch nicht (z. B. direkt nach dem Update).
  - Dann wird die Seite einmal neu geladen, höchstens einmal pro Sitzung, damit keine Schleife entsteht.
  - Dieser Fall ist nur im Code abgesichert und wurde nicht angemeldet durchgespielt.

## 2. Hero-Überschrift auf schmalen Handys

- Die Schriftgröße passt sich an die Breite an: `clamp(1.6875rem, 0.2rem + 7.4vw, 2rem)` in `landing-end.scss`,
  also 27 px bei 320 px Breite und 32 px ab 390 px.
- Gemessen bei 320, 340, 360, 375 und 390 px: immer **4 Zeilen** (vorher 5 bei 320 px), Demo-Knopf im ersten Bild.
- Der Text der Überschrift ist unverändert.

## 3. Screenreader

- **Geprüft:** Barrierefreiheitsbaum mit Playwright (`ariaSnapshot`) für Landingpage und Rechtsseiten.
  - Sprunglink vorhanden, Abschnitte benannt und in Leserichtung.
  - Überschriften H1 → H2 → H3 ohne Sprung.
  - Navigationen im Fuß benannt, Bilder beschrieben.
- **Behoben:** Die Probe hatte zwei Live-Regionen (Zähler und ganzes Ergebnis), es wäre also doppelt und lang
  vorgelesen worden.
  - Jetzt gibt es **eine** feste, unsichtbare Statuszeile (`role="status"`) mit einem kurzen Satz pro Entscheidung.
  - Beispiele: „„Reisekasse Berlin“ verknüpft. Verknüpft mit 1 Eintrag.“ und „Beispiel zurückgesetzt.“
- **Offen:** ein Test mit einem echten Screenreader (VoiceOver auf iPhone/Mac, NVDA unter Windows).

## 4. Webserver und Sicherheit (nginx)

Dateien in [`deploy/nginx/`](../deploy/nginx/):

| Datei | Zweck |
|---|---|
| `4inone.conf` | Server-Block: HTTPS, Startseiten-Weiche, vorgerenderte Seiten, `/api/` und Admin an Django, Caching |
| `snippets/4inone-security-headers.conf` | CSP, HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP |
| `snippets/4inone-proxy.conf` | Weiterleitung an gunicorn `127.0.0.1:8000`, echte Besucher-IP (nicht fälschbar) |

**Wichtige Punkte:**
- Die CSP erlaubt Skripte nur von der eigenen Adresse (`script-src 'self'`), und Daten werden nur von der eigenen
  Adresse geladen (`connect-src 'self'`). Liegt die API auf einer anderen Domain, muss diese ergänzt werden.
- Die Sicherheits-Header sind als eigene Datei in **jeder** `location` eingebunden. Grund: nginx verwirft die Header
  des server-Blocks, sobald eine `location` eigene setzt.
- HTML wird mit `no-cache` ausgeliefert. Dateien mit Hash im Namen (`main-`, `chunk-`, `styles-XXXX`) werden ein
  Jahr lang `immutable` gecacht.
- Uploads sind bis 12 MB erlaubt (eine Datei in Organisation darf 10 MB groß sein).
- Unbekannte Adressen zeigen die 404-Seite mit `noindex`, aber mit HTTP-Status 200.

**Nicht mit echtem nginx getestet**, weil nginx lokal nicht installiert ist. Das Verhalten wurde mit einem kleinen
Node-Server mit denselben Regeln nachgestellt und im Browser geprüft.

## 5. Rechtsseiten

- Der Hinweis lautet jetzt: „**Platzhaltertext** — noch nicht rechtsverbindlich. Er wird vor dem Start rechtlich
  geprüft und ersetzt.“ Er nennt keine internen Dateinamen mehr; ein Test sichert das ab.
- Im Impressum-Platzhalter steht jetzt „§ 5 DDG“ statt „§ 5 TMG“.

---

## Noch zu tun vor dem Livegang

- [ ] In `deploy/nginx/4inone.conf` die Platzhalter ersetzen:
  - `4inone.example` → eigene Domain (auch in den Zertifikatspfaden),
  - Ort des Builds ist `/srv/4inone-web` (siehe `deploy/ANLEITUNG.md`),
  - `DJANGO_ADMIN` → Wert von `ADMIN_URL_PATH`.
- [ ] Die zwei Snippets nach `/etc/nginx/snippets/` kopieren, dann `nginx -t` und neu laden.
- [ ] Django mit `BEHIND_PROXY=True` starten (genau ein Proxy davor).
- [ ] Nach dem Start prüfen: `curl -I https://<domain>/` und z. B. securityheaders.com.
- [ ] Echte Rechtstexte einsetzen. Die Datenschutzerklärung muss das Hinweis-Cookie `4io_signed_in` als technisch
      notwendig nennen. Danach den Platzhalter-Hinweis entfernen.
- [ ] Optional: den Django-Admin mit CSS ausliefern (`STATIC_ROOT` setzen, `collectstatic`, `location /static/`).
- [ ] Test mit echtem Screenreader (VoiceOver, NVDA).
- [ ] Optional: echte HTTP-404-Antworten. Das bräuchte eine Liste der bekannten Pfade in nginx oder serverseitiges
      Rendern.

## Lokal nachprüfen

```bash
cd frontend && npx ng build
```

Danach `dist/frontend/browser/` ansehen: Es enthält `index.html` (vorgerendert), `index.csr.html` (App) und je einen
Ordner pro Rechtsseite.

```bash
cd frontend && npx ng test --watch=false
```

```bash
cd frontend && npx playwright test
```

Der e2e-Test „öffentliche Seiten kommen fertig gerendert, ohne Inline-Skript und ohne persönliche Daten“ in
`e2e/landing-journey.spec.ts` schlägt fehl, falls die Hydration-Einstellung oder `inlineCritical` später geändert wird.
