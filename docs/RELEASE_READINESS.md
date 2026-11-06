# Release-Bereitschaft — Qualitäts-Gate vor Smart Scan

**Stand:** 01.11.2026 · Prüfung des Abschnitts 10 aus dem Entwicklungsplan nach Abschluss der Phasen 1–4.

## Checkliste

| Kriterium | Status | Beleg / offen |
|---|---|---|
| Priorisierte Connection-Workflows funktionsfähig und dokumentiert | ✅ | CON-01 … CON-10, `CONNECTION_ENGINE_V2_AUDIT.md` |
| Automatisierte Tests reproduzierbar grün | ⚠️ teilweise | Backend 1072 und Unit 476 grün; E2E 349 grün, **4 bekannte Datumsfehler** (Monatserster) in Finanzen-Tests — Korrektur läuft separat |
| Alle vier Module auf Regressionen geprüft | ✅ | `REGRESSION_TEST_REPORT.md` (3 Regressionen gefunden und behoben) |
| Keine bekannten kritischen oder hohen Bugs | ✅ | F-01 (Doppelzählung) und F-03 (Dialog) behoben, Regressionstests ergänzt |
| Private, geteilte und bereichsübergreifende Zugriffe getestet | ✅ | QA-10/11, Rechte-Matrix, `test_permission_matrix.py` |
| Keine Doppelbuchungen oder Datenverluste | ✅ | QA-01/03/05/09, F-01, CON-05/06-Tests |
| Mobile Kernabläufe und Accessibility geprüft | ✅ | 390/768/1440 px, axe (WCAG 2.1 AA) ohne Befund, Tastatur, Ziele ≥ 44 px |
| Datenmigrationen und Wiederherstellbarkeit getestet | ⚠️ lokal | frische DB + Kopie der Entwicklungs-DB, SQLite-Backup/Restore; **PostgreSQL-Backup auf dem Server noch offen** |
| Offene Einschränkungen transparent dokumentiert | ✅ | Testbericht §4, Regressionsbericht §3/§5 |
| Testpersonen können den Nutzen nachvollziehen | ❌ offen | **Phase 5 (Beta mit 5–10 Personen) noch nicht durchgeführt** — braucht echte Nutzer |

## Entscheidung

**Smart Scan ist noch NICHT freigegeben.** Das Gate ist erst erfüllt, wenn:

1. die vier Datums-E2E-Fehler behoben sind (Aufgabe läuft) und die Suite ohne parallele Last vollständig grün ist,
2. ein PostgreSQL-Backup/Restore inkl. privater Dateien auf dem Zielserver geprobt wurde,
3. Phase 5 (kleiner Beta-Test, Aufgaben aus Plan Abschnitt 6) ausgewertet ist.

Technisch ist die Connection Engine V2 stabil genug für den Beta-Test: Sie erzeugt keine Kopien und keine Buchungen,
schützt Rechte bei jedem Lesen und ist abschaltbar (pausieren/aufheben) ohne Datenverlust.

## Manuell erforderliche Prüfungen

- `python manage.py migrate` (neu: `connections/0004_auto_links`).
- Beta-Test mit echten Nutzern (Phase 5).
- PostgreSQL-Lasttest für gleichzeitige Zugriffe (Testbericht §4).
- PostgreSQL-Backup/Restore inkl. `PRIVATE_MEDIA_ROOT`.
