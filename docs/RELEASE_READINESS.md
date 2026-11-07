# Release-Bereitschaft — Qualitäts-Gate vor Smart Scan

**Stand:** 06.11.2026 · Abschnitt 10 des Entwicklungsplans nach Phase 1–4, QA-Audit (`docs/qa/`) und Vorbereitung
Phase 5. Vorheriger Stand 01.11.2026 ist durch diese Fassung ersetzt.

## Checkliste

| Kriterium | Status | Beleg / offen |
|---|---|---|
| Priorisierte Connection-Workflows funktionsfähig und dokumentiert | ✅ | CON-01 … CON-10, `CONNECTION_ENGINE_V2_AUDIT.md`; seit 02.11. auch Frist in Monaten, Vorab-Erinnerung, Preis ab Datum |
| Automatisierte Tests reproduzierbar grün | ⚠️ teilweise | Backend und Unit grün (Zahlen unten). Die Finanz-Datumstests sind behoben (fester Demo-Tag, 20/20). **Ein vollständiger E2E-Lauf ohne Systemlast steht aus:** drei Läufe vom 03.–06.11. liefen bei Last 11–90 über 7–14 h und scheiterten an Zeitüberschreitungen. Gezielte Läufe der geänderten Bereiche waren grün. |
| Alle vier Module auf Regressionen geprüft | ✅ | `REGRESSION_TEST_REPORT.md`, QA2-23 (CRUD aller vier Module ohne Verbindungen) |
| Keine bekannten kritischen oder hohen Bugs | ✅ | F-01, F-03 und BUG-QA2-02 (hoch) behoben; alle QA2-Befunde behoben (`docs/qa/CONNECTION_V2_BUGS.md`) |
| Private, geteilte und bereichsübergreifende Zugriffe getestet | ✅ | QA-10/11, QA2-16 … 19 (Nutzer A/B/C), `test_permission_matrix.py` |
| Keine Doppelbuchungen oder Datenverluste | ✅ | QA-01/03/05/09, QA2-02/06/11/12/22 |
| Mobile Kernabläufe und Accessibility geprüft | ✅ | 390/768/1440 px, axe ohne Befund; neue Dialoge (Frist, Preis, Wartung, Feedback) bei 390 und 1440 px geprüft |
| Datenmigrationen und Wiederherstellbarkeit getestet | ⚠️ lokal | SQLite frisch und Kopie, Backup/Restore; **PostgreSQL auf dem Zielserver offen** |
| Offene Einschränkungen transparent dokumentiert | ✅ | dieses Dokument, `docs/qa/*`, Testbericht §4 |
| Testpersonen können den Nutzen nachvollziehen | ❌ offen | **Phase 5 vorbereitet, nicht durchgeführt** — braucht 5–10 echte Personen über 2–4 Wochen (`docs/beta/`) |

### Letzte Läufe (tatsächlich ausgeführt)

| Suite | Ergebnis |
|---|---|
| Backend (`python -m pytest`) | **1123 bestanden, 1 fehlgeschlagen** (vorbestehender Farbtest `test_private_category_colors`, nicht Connections) · `makemigrations --check`: keine fehlenden Migrationen (06.11.) |
| Frontend Unit (`npx ng test --watch=false`) | **482 bestanden** (04.11.) |
| E2E gezielt: Finanzen-Zeiträume/Import, Beta-Feedback, Kontomenü | 10/10 bzw. 20/20 bei doppelter Wiederholung; Beta-Feedback 3/3; Kontomenü + Feedback 14/14 (04.11.) |
| E2E gezielt: Haushalt, Connections, Finanzen › Geplant, Organisation, Private Finanzen | **107 bestanden** (02.11.) |
| E2E vollständig | **nicht auswertbar** (Systemlast; s. o.) — erneut ausführen, wenn der Rechner frei ist: `cd frontend && npx playwright test` |

## Phase 5 — Stand

Vorbereitet (04.11.2026):
- **Beta-Kit** `docs/beta/`: Ablauf, fünf Aufgaben, Beobachtungsbogen, Interviewleitfaden, Einwilligung (Vorlage),
  Auswertungsvorlage mit Definition of Done.
- **„Feedback geben · Beta“** im Kontomenü (abschaltbar über `BETA_FEEDBACK_ENABLED`, Standard aus), Speicherung
  datensparsam, keine Liste für Nutzer, Löschung mit Konto bzw. nach 180 Tagen.
- **Auswertung** pseudonym: `beta_feedback_report` (Antworten, Freitexte) und `beta_usage_report` (aktive Tage/Wochen
  je Bereich aus Zeitstempeln, ohne Inhalte, ohne Tracking).

Offen: Durchführung mit echten Personen, Auswertung, Behebung kritischer/hoher Befunde.

## Entscheidung

**Smart Scan ist noch NICHT freigegeben.** Das Gate ist erst erfüllt, wenn:

1. die E2E-Suite **ohne parallele Last** vollständig grün durchläuft,
2. ein PostgreSQL-Backup/Restore inkl. privater Dateien auf dem Zielserver geprobt wurde,
3. Phase 5 durchgeführt und ausgewertet ist (`docs/beta/AUSWERTUNG.md`) und kritische/hohe Befunde behoben sind.

Phase 6 ist als Plan vorbereitet (`docs/SMART_SCAN_V1_PLAN.md`); Technik freigegeben (pypdf, Tesseract, Ollama
lokal), Installation erst beim Start.

## Manuell erforderliche Prüfungen

- `python manage.py migrate` — neu seit 01.11.: `haushalt/0009` … `0011`, `organisation/0008`, `connections/0004`,
  `core/0017_beta_feedback`.
- Für den Beta-Test: `BETA_FEEDBACK_ENABLED=True` in der Server-`.env`, danach wieder aus.
- Vollständiger E2E-Lauf ohne parallele Last.
- PostgreSQL-Lasttest für gleichzeitige Zugriffe; PostgreSQL-Backup/Restore inkl. `PRIVATE_MEDIA_ROOT`.
- Beta-Test mit 5–10 Personen (`docs/beta/README.md`).
