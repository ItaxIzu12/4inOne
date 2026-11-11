# Testbericht 4inOne – 11.11.2026

Vollständige Prüfung vor dem öffentlichen Test-Upload, danach Korrekturen und Updates auf den neuesten Stand.
Geprüft von Claude mit `/engineering:testing-strategy`, `/cybersecurity-analyst` und `/ui-taste`.
Ausgangsstand: Commit `9743887` (lokal 3 Commits vor GitHub). Ausführliche Erstbewertung: `AUDIT_2026-11-11_GESAMT.md`.

---

## 1. Das Wichtigste auf einen Blick

| | Vorher | Nachher |
|---|---|---|
| Backend-Tests (pytest) | 1123 ✓ · **1 ✗** | **1125 ✓ · 0 ✗** |
| Frontend-Unit-Tests (Vitest) | 482 ✓ | **488 ✓** (6 neue) |
| E2E inkl. Barrierefreiheit (Playwright) | 356 ✓ | **356 ✓** (ohne Laufzeitfehler im Protokoll) |
| Bekannte Sicherheitslücken Backend (pip-audit) | **43** (Pillow 40, DRF 3) | **0** |
| Bekannte Sicherheitslücken Frontend (npm audit) | Laufzeit 0 · Entwicklung 2 | **0** |
| Leere Seite, wenn ein Bereich nicht lädt | ja | **behoben** (Auto-Neuladen + Hinweis) |
| Finanz-Farben passen zu den Bereichsfarben | nein | **ja** |
| Demo-Build für GitHub Pages | ✓ | ✓ (127,6 kB Start) |

**Urteil:** Die **Demo ist bereit** für GitHub Pages. Die **echte App mit Konten** braucht vor einem Server-Betrieb
noch PostgreSQL, einen echten Mailversand und eine CI (siehe Abschnitt 6) – am Code selbst blockiert nichts mehr.

---

## 2. Was getestet wurde

### Automatische Tests
| Ebene | Werkzeug | Umfang | Ergebnis |
|---|---|---|---|
| Backend | pytest + pytest-django | 1125 Tests: Berechtigungen, Fremdzugriffe (117 eigene Tests), Auth/MFA, Uploads, Finanzen, Haushalt, Organisation, Reisen, Verknüpfungen, Migrationen | 1125 ✓ |
| Frontend-Unit | Vitest (`ng test`) | 76 Dateien, 488 Tests: Komponenten, Dienste, Formulare, Fehlermeldungen | 488 ✓ |
| Frontend-E2E | Playwright (Backend simuliert) | 44 Dateien: Abläufe aller Bereiche, Auth-Audit, Demo, Barrierefreiheit | 356 ✓ (parallel und einzeln nacheinander) |
| Build | `ng build`, `npm run build:pages` | Produktion und Demo-Version | fehlerfrei |
| Django | `check`, `makemigrations --check`, `check --deploy` | Konfiguration, fehlende Migrationen, Produktionsreife | sauber · 2 Produktions-Hinweise (Abschnitt 6) |

Alle Backend-Tests liefen gegen eine eigene Test-Datenbank: Die echte `backend/db.sqlite3` war vor und nach allen
Läufen identisch (MD5 `1dd4be6a80fe…`).

### Im Browser (Demo, lokal wie GitHub Pages ausgeliefert)
- Startseite, Demo-Start, Finanzen, Haushalt, Organisation, Reisen – auch als direkter Link (Tiefenlink über `404.html`).
- Desktop 1440 px und Handy 375 px; keine waagrechte Scrollleiste; Tab-Leiste unten.
- Bedienung: Plus-Menü öffnen, Aufgabe leer abschicken (bleibt offen, Feld markiert), Aufgabe anlegen (erscheint in der Liste).
- **Funkloch nachgestellt** (Testserver liefert den Haushalt-Teil mit 503 aus):
  - einmal → App lädt selbst neu, Haushalt erscheint, kein Klick nötig;
  - dauerhaft → Hinweis „Diese Seite konnte nicht geladen werden“ mit „Neu laden“ statt weißer Seite; „Neu laden“ führt zur richtigen Seite.

### Sicherheit (statisch und Konfiguration)
- **Geheimnisse:** gesamte Git-Historie – nie `.env`, Datenbank, Uploads oder Schlüssel eingecheckt.
- **Abhängigkeiten:** pip-audit (Laufzeit + Entwicklung), npm audit (Laufzeit + Entwicklung).
- **Code:** Token-Speicherung, `innerHTML`/`bypassSecurityTrust`, Datei-Upload und -Auslieferung, Querysets (Fremdzugriff),
  alle ohne Anmeldung erreichbaren Endpunkte, CSRF-Ausnahmen.
- **Betrieb:** Django-Settings (DEBUG, HSTS, Cookies, CORS/CSRF, CSP, Rate-Limits, axes), nginx-Header/TLS, systemd-Härtung,
  GitHub-Pages-Workflow (Rechte, Auslöser).

---

## 3. Sicherheitsbewertung

**Stark (so lassen):**
- Access-Token nur im Speicher (15 min), Refresh als Cookie, Rotation + Sperrliste; `localStorage` nur für UI-Vorlieben.
- Argon2, Passwort ≥ 10 Zeichen, django-axes (5 Fehlversuche → 1 h Sperre), MFA (TOTP), Rate-Limits auf allen sensiblen Wegen.
- Jede Abfrage auf die eigene Person beschränkt (`owner=request.user`); fremde IDs → 404.
- Uploads: Typ am Inhalt, 10 MB/Datei, 500 MB/Person, kein HTML/SVG, Bilder neu kodiert ohne EXIF/GPS, Schutz vor
  Dekompressionsbomben; Auslieferung mit `nosniff`, Sandbox-CSP, `no-store`.
- Ohne Anmeldung erreichbar sind nur Auth-Abläufe und ein anonymer Seitenzähler – alle gedrosselt, kein `csrf_exempt`.
- nginx (TLS 1.2+, CSP, HSTS, X-Frame-Options, Permissions-Policy) und systemd (`ProtectSystem=strict`, eigener Nutzer) professionell.

**Behoben in diesem Durchgang:** Pillow 12.3.0 (40 Lücken, verarbeitet Nutzer-Uploads) → 13.0.0;
Django REST Framework 3.18.0 (3 Lücken) → 3.18.3; Entwicklungs-Lücken in vite/launch-editor über `npm update`.

**Offen (Betrieb, nicht Code):** siehe Abschnitt 6.

---

## 4. Korrekturen

### 4.1 Leere Seite, wenn ein Bereich nicht nachgeladen werden kann
Bereiche werden erst beim Öffnen geladen. Brach das ab (Funkloch, neue Version veröffentlicht), blieb beim ersten Aufruf
eine leere weiße Seite – ohne Meldung.
- Neu: `frontend/src/app/core/navigation/chunk-load-recovery.ts` (über `withNavigationErrorHandler` in `app.config.ts`):
  erster Fehler → Zielseite einmal neu laden (höchstens alle 10 s, keine Schleife); zweiter → Hinweis.
- Neu: `frontend/src/app/shared/reload-notice/reload-notice.ts` (`app-reload-notice` in `app.html`): Karte wie die
  Speichern-Rückmeldung (oben mittig), „Neu laden“ + Schließen (je 44 px), `role=alert`.
- Tests: `chunk-load-recovery.spec.ts` (6 Tests: Erkennung in Chrome/Firefox/Safari, Neuladen mit Basis-Pfad,
  keine Schleife, „Neu laden“, ohne Sitzungsspeicher) + manueller Funkloch-Test im Browser (Abschnitt 2).

### 4.2 Finanz-Kategoriefarben passen wieder zu den Bereichsfarben
Die Bereichsfarben waren auf Design-Tokens umgestellt, die Finanz-Kategorien nicht; der Test dafür schlug an.
- `backend/finanzen/category_colors.py`: Reisen `#2e8aef` → `#3d6b9a` (`--travel-fill`), Wohnen `#c2336f` → `#ab445f`
  (`--household-accent`). Das Akzentblau `#36608b` wurde bewusst **nicht** genommen: bei Rot-Grün-Schwäche ΔE 7,9
  zum Mobilität-Indigo (Ziel ≥ 8). Neue Palette nachgerechnet (CIEDE2000, Machado 2009): normal ≥ 17,7, Deuteranopie ≥ 8,9,
  Protanopie ≥ 11,9 – so gut wie vorher.
- `backend/finanzen/migrations/0023_category_colors_area_tokens.py`: färbt nur private Kategorien um, die noch genau die alte
  Automatik-Farbe tragen; eigene Farben und Haushalts-Kategorien bleiben; rückgängig machbar.
- Test liest jetzt die Tokens aus `frontend/src/styles.css`; neue Tests für die Migration (nur alte Farben, umkehrbar).

### 4.3 Verknüpfte Kalendereinträge: ein kaputtes Datum riss alle mit
Beim E2E-Lauf nach den Updates fiel im Server-Protokoll `RangeError: Invalid time value` auf (die Tests blieben grün).
Ursache in `frontend/src/app/features/organisation/organisation.ts` (`derivedEvent`, schon vor den Updates vorhanden):
Kalendereinträge aus Haushalt, Reisen und Finanzen werden per `toISOString()` umgewandelt – ein fehlendes oder
ungültiges Datum warf einen Fehler, und **alle** verknüpften Termine fielen aus.
- Jetzt: Einträge ohne gültiges Datum werden übersprungen, ein ungültiges Enddatum macht den Eintrag eintägig.
- Geprüft: Organisations-Unit-Tests (19 ✓), die auslösenden E2E-Dateien `connections*.spec.ts` (16 ✓) ohne Fehlermeldung.

---

## 5. Updates auf den neuesten Stand

### Backend (`backend/requirements.txt`, `requirements-dev.txt`) – 31 Pakete
| Paket | vorher | jetzt | Hinweis |
|---|---|---|---|
| Django | 6.1.1 | 6.1.3 | Sicherheits-/Fehlerkorrekturen |
| djangorestframework | 3.18.0 | 3.18.3 | schließt 3 Lücken |
| **Pillow** | 12.3.0 | **13.0.0** | Major, schließt 40 Lücken; Upload-Tests grün |
| **django-axes** | 8.3.1 | **9.0.0** | Major; keine neue Migration, Login-Sperre-Tests grün |
| **gunicorn** | 23.0.0 | **27.0.0** | Major (Produktionsserver); Aufruf unverändert |
| django-allauth | 65.19.1 | 65.22.0 | |
| django-otp | 1.7.3 | 1.7.5 | |
| cryptography | 50.0.0 | 50.0.2 | |
| PyJWT · psycopg2-binary · reportlab · asgiref · sqlparse · tzdata | | neueste | |
| pytest | 9.1.1 | 9.2.0 | |
| Entwicklungs-Werkzeuge (pip-audit-Umfeld, u. a. **filelock 3 → 4**) | | neueste | |

### Frontend (`frontend/package.json`)
| Paket | vorher | jetzt |
|---|---|---|
| Angular (alle `@angular/*`) | 22.2.3 | 22.2.5 / CLI & Build 22.2.6 |
| @playwright/test | 1.64.1 | 1.65.0 (Testbrowser Chromium 158 nachgeladen) |
| vitest | 5.0.5 | 5.1.0 |
| **jsdom** | 30.1.3 | **31.0.0** (Major) |
| motion · prettier · tslib | | neueste |
| **TypeScript** | 6.0.3 | **bleibt 6.0.3** – Angular 22.2 verlangt `>=6.0 <6.1`; TypeScript 7 erst mit einer künftigen Angular-Version |

npm blockiert seit Version 11 die Installationsskripte von zwei optionalen Paketen (`fsevents`, `msgpackr-extract`). Beide
sind nur Beschleuniger mit Ausweichlösung; Build und Tests laufen ohne sie.

---

## 6. Offen – vor einem echten Server mit Konten

| Prio | Punkt | Warum |
|---|---|---|
| P1 | **PostgreSQL** statt SQLite (`DATABASE_URL`) | `check --deploy` meldet Fehler; SQLite serialisiert alle Schreibzugriffe |
| P1 | **Echter Mailversand** (SMTP, `EMAIL_HOST` …) | sonst funktionieren E-Mail-Bestätigung und Passwort-Reset nicht |
| P2 | **CI** (GitHub-Workflow: pytest, Vitest, Build bei jedem Push) | rund 1900 Tests laufen sonst nie automatisch – so blieb die Farbabweichung unbemerkt |
| P2 | Full-Stack-E2E (3–5 Kernabläufe gegen echtes Backend) | die Playwright-Suite simuliert das Backend |
| P3 | `RATE_LIMIT_CACHE=database`, `PRIVATE_MEDIA_ROOT` auf Daten-Volume | Warnungen aus `check --deploy` |
| P3 | Dunkelmodus, Kontomenü 44 px, Landing-Hero | UI-Feinschliff |
| — | Datenschutzerklärung/Impressum prüfen | sobald echte Personen echte Daten eintragen |
| — | `pytest`/`pytest-django` stehen in `requirements.txt` (Produktion) | gehören nach `requirements-dev.txt` |

**Migration nötig:** `0023_category_colors_area_tokens` (nur Farbwerte) – einmal `python manage.py migrate` ausführen.

---

## 7. Hochladen

**Stufe A – Demo auf GitHub Pages (bereit):** Beispieldaten, ohne Konten, ohne Backend; öffentlich per Link.
1. Änderungen committen und auf GitHub pushen (lokal sind noch 3 ältere Commits nicht gepusht).
2. GitHub › Settings › Pages › Source: **„GitHub Actions“**.
3. GitHub › Actions › **„Demo auf GitHub Pages“** › Run workflow.
4. Nach 2–3 Minuten: **https://itaxizu12.github.io/4inOne/demo/**

**Stufe B – echte App mit Test-Konten:** eigener Server nach `deploy/ANLEITUNG.md`, erst nach Abschnitt 6.

**Zugang nur mit „Schlüssel“?** GitHub Pages kann das nicht: Die Seite ist statisch, jeder mit dem Link sieht sie – ein
Passwort im JavaScript wäre nur Schein. Für die Demo ist das unkritisch (nur Beispieldaten). Für einen Test-Server mit
echten Konten gibt es zwei Wege:
1. **Passwort vor der ganzen Seite** (nginx-„Basic Auth“): ein Benutzername + Passwort für alle Tester, ohne Code-Änderung,
   echte Sperre – Fremde sehen nicht einmal die Anmeldeseite. Empfohlen für die erste geschlossene Testphase.
2. **Einladungscode bei der Registrierung:** jede Person bekommt einen eigenen Code, ohne Code kein Konto. Gibt es in 4inOne
   noch nicht – wäre eine neue, kleine Backend-Funktion (Code prüfen, Rate-Limit, Tests).
Laut `docs/BETA_TEST_PLAN.md` vor der ersten Einladung außerdem: Mailversand, Kontaktadresse, HTTPS-Prüfung auf dem Server.

---

## 8. Geänderte Dateien

- Frontend: `src/app/app.config.ts`, `app.ts`, `app.html`, `features/organisation/organisation.ts`; neu `core/navigation/chunk-load-recovery.ts` (+ `.spec.ts`),
  `shared/reload-notice/reload-notice.ts`; `package.json`, `package-lock.json`
- Backend: `finanzen/category_colors.py`, `finanzen/tests/test_private_category_colors.py`, neu
  `finanzen/migrations/0023_category_colors_area_tokens.py`; `requirements.txt`, `requirements-dev.txt`
- Doku: `DESIGN.md`, `docs/DESIGN_SYSTEM.md`, `docs/audits/AUDIT_2026-11-11_GESAMT.md`, dieser Bericht

Nichts committet, nichts gepusht, nichts veröffentlicht.
