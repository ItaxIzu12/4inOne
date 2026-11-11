# Gesamt-Audit 4inOne – 11.11.2026

> **Nachtrag 11.11.2026 abends:** Pillow/DRF-Lücken, leere Seite beim Nachladen und Farbabweichung sind behoben, alle Pakete aktualisiert – siehe `TESTBERICHT_2026-11-11.md`. Dieser Bericht zeigt den Stand **vor** den Korrekturen.

Prüfung durch Claude (Tests, Sicherheit, UI) vor einem öffentlichen Test-Upload. Nur geprüft, **nichts am Code
geändert**. Grundlage: Stand `9743887` (lokal 3 Commits vor `origin/main`).

## 1. Ergebnis in einem Satz

Technisch und sicherheitlich deutlich über dem Niveau typischer Hobby-Projekte; die **Demo ist bereit für GitHub
Pages**, die **echte App mit Konten noch nicht** (zwei Produktions-Fehler, veraltetes Pillow, keine CI).

## 2. Tests – was tatsächlich gelaufen ist

| Bereich | Werkzeug | Ergebnis |
|---|---|---|
| Backend | pytest (eigene Test-DB) | **1123 bestanden, 1 fehlgeschlagen** (4:38 min) |
| Frontend-Unit | Vitest (`ng test`) | **482/482 bestanden** (75 Dateien) |
| Frontend-E2E inkl. Barrierefreiheit | Playwright (Backend simuliert) | **356/356 bestanden** (5,6 min) |
| Produktions-Build Demo | `npm run build:pages` | fehlerfrei, Start 127 kB übertragen |
| Demo im Browser | lokaler GitHub-Pages-Nachbau | Startseite, alle 4 Bereiche, Tiefenlinks, Handy 375 px, Aufgabe anlegen ✓ |
| Django-Produktionscheck | `check --deploy` | **2 Fehler, 2 Warnungen** (siehe 3) |
| Abhängigkeiten Backend | pip-audit | **Pillow 12.3.0: 40 Lücken**, DRF 3.18.0: 3 Lücken |
| Abhängigkeiten Frontend | npm audit | Laufzeit: **0**; nur Entwicklung: vite (hoch), launch-editor (niedrig) |
| Geheimnisse | Git-Historie, Code-Muster | **sauber** – nie `.env`, DB, Uploads oder Schlüssel eingecheckt |

Die echte `backend/db.sqlite3` war vor und nach allen Tests identisch (MD5 `1dd4be6a…`).

**Fehlgeschlagener Test** `finanzen/tests/test_private_category_colors.py::test_travel_and_home_match_the_area_colors_of_the_app`:
kein Testfehler, sondern echte Abweichung. Die App-Bereichsfarben liegen jetzt als Tokens vor (Reisen `#36608b`,
Haushalt `#ab445f`), die Finanz-Kategoriefarben im Backend noch auf alten Werten (Reisen `#2e8aef`, Wohnen `#c2336f`).
Der Test liest außerdem `color: var(--…)` nicht mehr und muss auf die Tokens in `styles.css` umgestellt werden.

## 3. Sicherheit (OWASP / STRIDE)

### Stark – so lassen
- Access-Token nur im Speicher (15 min), Refresh als Cookie, Rotation + Sperrliste; nichts Geheimes in `localStorage`.
- Argon2, Passwort ≥ 10 Zeichen, django-axes (5 Fehlversuche → 1 h), MFA (TOTP), Rate-Limits auf allen sensiblen Wegen.
- Datenzugriff über `owner=request.user` (z. B. `OwnedViewSet`), fremde IDs → 404; 117 benannte Fremdzugriffs-Tests.
- Uploads: Typ per Magic Bytes, 10 MB/Datei, 500 MB/Person, kein HTML/SVG, Bilder neu kodiert ohne EXIF/GPS,
  Pixel-Grenze gegen Dekompressionsbomben; Auslieferung mit `nosniff`, Sandbox-CSP, `no-store`.
- Öffentliche Endpunkte nur Auth-Abläufe + anonymer Seitenzähler, alle gedrosselt; kein `csrf_exempt`.
- nginx: TLS 1.2+, CSP, HSTS, X-Frame-Options, Permissions-Policy, `server_tokens off`; systemd gehärtet
  (`ProtectSystem=strict`, `NoNewPrivileges`, eigener Nutzer). Kein `innerHTML`/`bypassSecurityTrust` im Frontend.

### Befunde
| Prio | Befund | Wirkung | Maßnahme |
|---|---|---|---|
| **P1** | Pillow 12.3.0 mit 40 bekannten Lücken; verarbeitet Nutzer-Uploads (`organisation/files.py`) | manipulierte Bilder an einer öffentlichen Angriffsfläche | auf 13.0.0 heben (Major), Upload-Tests laufen lassen – vor jedem Server-Betrieb |
| **P2** | `check --deploy`: Produktion auf SQLite; E-Mail nur Konsole | Passwort-Reset/Bestätigung funktionieren nicht, Schreibzugriffe serialisiert | PostgreSQL + SMTP setzen (`deploy/ANLEITUNG.md`) |
| **P2** | DRF 3.18.0 (3 Hinweise) | – | Patch auf 3.18.2 |
| **P2** | Keine CI – über 1900 Tests laufen nie automatisch | Regressionen bleiben unbemerkt (siehe Farbtest) | GitHub-Workflow für pytest + Vitest + Build |
| P3 | Rate-Limits je Prozess (Warnung) | bei 3 gunicorn-Workern faktisch 3× so großzügig | `RATE_LIMIT_CACHE=database` |
| P3 | Uploads im Programmordner (Warnung) | Daten gehen bei Neuinstallation verloren | `PRIVATE_MEDIA_ROOT` auf Daten-Volume |
| P3 | vite/launch-editor (nur Entwicklungsserver) | nicht in der ausgelieferten App | `npm audit fix` |

Für die **GitHub-Pages-Demo** sind P1–P3 nicht relevant: kein Backend, keine Konten, keine Uploads.

## 4. UI/UX (kritisch, unabhängig von Prüfstand/Denkraum)

**Stark:** ruhig, erwachsen, konsistent; Bereichsfarben als Orientierung statt Dekoration; „Heute“ zeigt Relevantes
statt Statistik-Wand; Handy mit Tab-Leiste und zweispaltigen Karten, keine waagrechte Scrollleiste; Demo ehrlich
als „Demo-Modus · Beispieldaten“ gekennzeichnet; Formulare als Bottom-Sheet mit klaren Datenschutz-Hinweisen.

| Prio | Befund |
|---|---|
| **P1** | **Nachladen schlägt fehl → leere weiße Seite.** Bricht ein Programmteil beim Laden ab (schlechtes Mobilfunknetz, neue Version veröffentlicht), springt die App zur Startseite und zeigt nichts – keine Meldung, kein „Neu laden“. Im Code gibt es keine Behandlung für fehlgeschlagene Lazy-Chunks. Gerade für Tests „unterwegs“ relevant. |
| P2 | Kein Dunkelmodus – beim Handy abends auffällig, wenn alle anderen Apps dunkel sind. |
| P3 | Finanz-Kategoriefarben weichen von den Bereichsfarben ab (siehe 2). |
| P3 | Kontomenü-Knopf 42 px (knapp unter 44 px Tippfläche). |
| P3 | Landing: zentrierte, sehr lange Überschrift mit Doppel-CTA – solide, aber austauschbar gegenüber der starken App selbst. |

## 5. Teststrategie – Lücken

1. **CI** (höchster Hebel): pytest, Vitest, `ng build` bei jedem Push; Pages-Deploy erst nach grünen Tests.
2. **Full-Stack-E2E:** die 356 E2E-Tests simulieren das Backend – 3–5 Kernabläufe (Registrieren → Bestätigen →
   Anlegen → Teilen → Fremdzugriff verweigert) gegen ein echtes Test-Backend.
3. **Fehlerfälle im Netz:** Test „Chunk lädt nicht → Hinweis + Neu laden“, Offline-Verhalten.
4. **Vor Mehrnutzer-Betrieb:** kurzer Lasttest (Login, Heute, Schreiben) und einmal Backup-Wiederherstellung üben.

## 6. Upload-Reife

| Stufe | Was | Reife |
|---|---|---|
| A | **Demo auf GitHub Pages** (`docs/GITHUB_PAGES_DEMO.md`) – Beispieldaten, ohne Konten, öffentlich per Link | **bereit** (P1 „leere Seite“ vorher beheben empfohlen) |
| B | **Echte App mit Test-Konten** auf eigenem Server (`deploy/`) | **noch nicht**: Pillow, PostgreSQL, SMTP, CI; zusätzlich Datenschutzerklärung/Impressum für echte Nutzerdaten prüfen |
