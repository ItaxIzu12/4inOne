# Release-Bereitschaft — Qualitäts-Gate vor Smart Scan

**Stand:** 15.11.2026 · nach der Umstellung auf PostgreSQL, dem DSGVO-Datenexport und dem Testkatalog. Ersetzt den
Stand vom 06.11.2026. Alle Testfälle mit Priorität und Abdeckung: [`TESTKATALOG.md`](TESTKATALOG.md) (220 Fälle).

## Checkliste

| Kriterium | Status | Beleg / offen |
|---|---|---|
| Priorisierte Connection-Workflows funktionsfähig und dokumentiert | ✅ | CON-01 … CON-10, `CONNECTION_ENGINE_V2_AUDIT.md`; seit 14.11. 12 erlaubte Paare mit Testmatrix für alle Paare und Arten (`connections/tests/test_matrix.py`) |
| Automatisierte Tests reproduzierbar grün | ✅ | **GitHub Actions grün für `5798015`** (15.11.), alle vier Jobs: Backend gegen PostgreSQL 16, Frontend, Browser (vollständige Playwright-Suite), Full-Stack. Lokal ebenso (Zahlen unten). Einschränkung: ein Browser-Test („tote Links“) läuft unter starker Parallellast in einen Zeitüberlauf, einzeln 12/12 grün. |
| Alle vier Module auf Regressionen geprüft | ✅ | `REGRESSION_TEST_REPORT.md`, QA2-23; seitdem jede Änderung mit Backend-, Unit- und E2E-Lauf |
| Keine bekannten kritischen oder hohen Bugs | ✅ | alle QA2-Befunde behoben; CSV-Injection im Finanz-Export behoben (15.11., `finanzen/reports.py`) |
| Private, geteilte und bereichsübergreifende Zugriffe getestet | ✅ | `core/test_permission_matrix.py` (Sweep über alle Listen-Endpunkte, IDOR auf allen Detail-Endpunkten, wird rot bei neuen Endpunkten ohne Prüfung; entpackt seit 15.11. auch ZIP-Antworten) |
| Keine Doppelbuchungen oder Datenverluste | ✅ | QA-01/03/05/09, QA2-02/06/11/12/22, Idempotenz (`core/test_idempotency.py`); PostgreSQL erzwingt jetzt Fremdschlüssel |
| Mobile Kernabläufe und Accessibility geprüft | ✅ | 320–1920 px ohne Querscrollen, axe ohne Befund (`e2e/accessibility.spec.ts` 47/47); nur Emulation, **echte Geräte offen** (TESTKATALOG UI-02) |
| Datenbank wie in Produktion | ✅ | seit 15.11. lokal und in der CI **PostgreSQL 16** (`docs/LOKALE_DATENBANK.md`); Bestandsdaten aus SQLite übernommen (365/365 Zeilen in 65 Tabellen) |
| Datenmigrationen und Wiederherstellbarkeit getestet | ⚠️ lokal | Migrationen auf leerer PostgreSQL-DB und Bestandsdaten grün; **Backup → Restore auf dem Zielserver offen** (TESTKATALOG DB-06) |
| DSGVO: Auskunft und Löschung | ✅ Technik | Datenexport als ZIP unter Einstellungen → Profil (15.11., `datenexport/`), Konto löschen; **Rechtstexte, AVV und Verarbeitungsverzeichnis offen** (GDPR-01/04/05) |
| Offene Einschränkungen transparent dokumentiert | ✅ | dieses Dokument, `TESTKATALOG.md` (Blockerliste am Ende), `docs/qa/*` |
| Testpersonen können den Nutzen nachvollziehen | ❌ offen | **Phase 5 vorbereitet, nicht durchgeführt** — braucht 5–10 echte Personen über 2–4 Wochen (`docs/beta/`) |

### Letzte Läufe (tatsächlich ausgeführt, 15.11.2026)

| Suite | Ergebnis |
|---|---|
| Backend (`python -m pytest`, PostgreSQL 16) | **1185 bestanden** · `makemigrations --check`: keine fehlenden Migrationen · `manage.py check`: ohne Befund |
| Frontend Unit (`npx ng test --watch=false`) | **524 bestanden** · `ng build` ohne Warnungen (Stilbudget eingehalten) |
| E2E vollständig (`npx playwright test`, lokal) | **425 bestanden, 4 übersprungen** (Ortsvorschläge, bewusst aus), 1 Zeitüberlauf unter Last → einzeln 12/12 grün |
| Full-Stack (`playwright.fullstack.config.ts`) | **2 bestanden** (Kernablauf, Datenexport-Download) |
| GitHub Actions (`5798015`) | **grün**: backend, frontend, browser, fullstack |
| Abhängigkeiten | `pip-audit` und `npm audit --omit=dev` ohne Befund |
| `manage.py check --deploy` (Werte wie Produktion) | nur, was die Server-`.env` setzt: Mailserver, `RATE_LIMIT_CACHE=database`, `PRIVATE_MEDIA_ROOT` |

## Phase 5 — Stand

Vorbereitet (04.11.2026):
- **Beta-Kit** `docs/beta/`: Ablauf, fünf Aufgaben, Beobachtungsbogen, Interviewleitfaden, Einwilligung (Vorlage),
  Auswertungsvorlage mit Definition of Done.
- **„Feedback geben · Beta“** im Kontomenü (abschaltbar über `BETA_FEEDBACK_ENABLED`, Standard aus), Speicherung
  datensparsam, keine Liste für Nutzer, Löschung mit Konto bzw. nach 180 Tagen.
- **Auswertung** pseudonym: `beta_feedback_report` (Antworten, Freitexte) und `beta_usage_report` (aktive Tage/Wochen
  je Bereich aus Zeitstempeln, ohne Inhalte, ohne Tracking).

Offen: Server für die Beta (Staging), Durchführung mit echten Personen, Auswertung, Behebung kritischer/hoher Befunde.

## Entscheidung

**Smart Scan ist noch NICHT freigegeben.** Vom Gate ist erfüllt bzw. offen:

1. ~~die E2E-Suite **ohne parallele Last** vollständig grün~~ — **erfüllt** (GitHub Actions 15.11., vollständige Suite grün),
2. ein PostgreSQL-Backup/Restore inkl. privater Dateien auf dem Zielserver geprobt — **offen** (braucht den Server),
3. Phase 5 durchgeführt und ausgewertet (`docs/beta/AUSWERTUNG.md`), kritische/hohe Befunde behoben — **offen**.

Phase 6 ist als Plan vorbereitet (`docs/SMART_SCAN_V1_PLAN.md`); Technik freigegeben (pypdf, Tesseract, Ollama
lokal), Installation erst beim Start.

## Vor einem öffentlichen Start zusätzlich (Blocker aus `TESTKATALOG.md`)

Fast alles Betrieb und Recht, kaum Code:
- **Server:** Einrichtung nach `deploy/ANLEITUNG.md` einmal komplett durchspielen, TLS, gunicorn/systemd, Proxy-IP
  für Rate-Limits, `RATE_LIMIT_CACHE=database`, Update-Ablauf, Timer für Backup und Aufräumen, Pages-Demo entfernen.
- **Backup:** Restore auf frischem Server üben, Notfallplan.
- **E-Mail:** echter EU-Mailversand mit SPF, DKIM, DMARC.
- **Betrieb:** Fehler-Monitoring (z. B. Sentry, EU-Region, ohne Personendaten) und Uptime-Überwachung.
- **Recht:** Impressum, Datenschutzerklärung (inkl. Datenexport), Nutzungsbedingungen; AVV mit Hoster und Mail-Anbieter.
- **Geräte:** Kernabläufe auf echtem iPhone und Android.
- **Beta:** 5–10 Personen über 2–4 Wochen.

## Manuell erforderliche Prüfungen

- `python manage.py migrate` — neu seit 06.11.: `connections/0004_auto_links`, `connections/0005_auto_kind_trip_itinerary`,
  `core/0017_beta_feedback`, `finanzen/0023_category_colors_area_tokens`, `haushalt/0010_notice_period_months`,
  `haushalt/0011_contract_price_reminder_serial`, `reisen/0013_trip_event_kind_cancellation`,
  `reisen/0014_expense_split_settlements`.
- Lokale Datenbank: `./scripts/dev-db.sh up` vor der Arbeit (PostgreSQL in Docker).
- Für den Beta-Test: `BETA_FEEDBACK_ENABLED=True` in der Server-`.env`, danach wieder aus.
- PostgreSQL-Lasttest für gleichzeitige Zugriffe; PostgreSQL-Backup/Restore inkl. `PRIVATE_MEDIA_ROOT`.
- Beta-Test mit 5–10 Personen (`docs/beta/README.md`).
