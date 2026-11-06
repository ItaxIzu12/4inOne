# Regressionstest der gesamten App (Phase 3)

**Stand:** 01.11.2026 (Sonntag, Monatserster) · lokal, macOS, SQLite, Chromium · alle Zahlen aus tatsächlichen Läufen.

## 1. Gesamtläufe nach der Connection Engine V2

| Suite | Befehl | Ergebnis |
|---|---|---|
| Backend (Django/pytest) | `python -m pytest --deselect finanzen/tests/test_private_category_colors.py::test_travel_and_home_match_the_area_colors_of_the_app` | **1072 bestanden** |
| Frontend Unit (Angular/Vitest) | `npx ng test --watch=false` | **476 bestanden** (nach Korrektur F-02) |
| End-to-End (Playwright) | `npx playwright test` | **349 bestanden, 4 fehlgeschlagen** (siehe 3.) |

Der erste Gesamtlauf fand drei Regressionen durch die neue Arbeit (Testbericht F-02, F-03, F-04); alle behoben und im
zweiten Lauf bestätigt.

## 2. Abdeckung je Bereich (bestehende Tests, alle im Gesamtlauf enthalten)

| Bereich | Plan-Punkte | Belege (Auswahl) |
|---|---|---|
| 💰 Finanzen | Ein-/Ausgaben, Kategorien, Budgets, Wiederkehrend/Geplant, Sparziele, keine Doppelbuchung, geplant ≠ bezahlt | `backend/finanzen/tests/*`, `e2e/private-finance.spec.ts`, `finance-*.spec.ts`; neu: F-01-Test (Vertrag ersetzt gleichnamige wiederkehrende Planung) |
| 🏠 Haushalt | Verträge/Geräte, Aufgaben/Routinen mit Wiederholung, Einkauf, Zuständigkeiten | `backend/haushalt/test_*.py`, `e2e/haushalt-*.spec.ts`, `folder-attachments.spec.ts`; neu: `test_existing_connections.py` (CON-05) |
| 📅 Organisation | Termine, Aufgaben, Notizen, Ganztägig, Fälligkeiten, geteilte Kalender | `backend/organisation/test_*.py`, `e2e/organisation.spec.ts`, `shared-calendars.spec.ts`, `place-input.spec.ts` |
| ✈️ Reisen | Daten, Überschneidungen, Budget, Packliste, To-dos, Begleiter und Rechte | `backend/reisen/tests.py`, `e2e/reisen.spec.ts` |
| 🔐 Übergreifend | Login/Logout/Registrierung/Sitzungen, privat vs. geteilt, Demo getrennt | `backend/core/test_*` inkl. `test_permission_matrix.py`, `e2e/account-menu.spec.ts`, `invitations.spec.ts`, `demo-pages.spec.ts` |

Demo-Daten sind strikt getrennt: alle Demo-Dienste werden nur unter `/demo` bereitgestellt (`demo.routes.ts`), senden
nichts an den Server und leben nur im Browser-Tab.

## 3. Bekannte Fehlschläge (nicht durch diese Arbeit verursacht)

| Test | Ursache | Status |
|---|---|---|
| `e2e/finance-import.spec.ts:19` (390/1440) | Test erwartet Werte, die am **Monatsersten** nicht gelten (Demo bucht Fixkosten zum 1.) | eigene Aufgabe „Fix finance E2E tests failing on the 1st of a month“ läuft separat |
| `e2e/finance-periods.spec.ts:7` (390/1440) | dito | dito |
| `finanzen/tests/test_private_category_colors.py::test_travel_and_home_match_the_area_colors_of_the_app` | bestand schon vor dieser Arbeit (Farbabgleich) | im Lauf ausgeschlossen, offen |

Unter starker Last (parallele Sitzung, Last 20+) liefen einzelne E2E-Tests in Zeitüberschreitungen; einzeln wiederholt
waren alle grün. Für verlässliche Ergebnisse die E2E-Suite ohne parallele Last laufen lassen.

## 4. Datenmigrationen

- **Leere Datenbank:** `migrate` auf frischer SQLite — alle Migrationen angewendet, `showmigrations` ohne offene,
  `makemigrations --check` ohne Änderungen.
- **Kopie der Entwicklungsdatenbank** (realistische Daten, Original unangetastet): offen war nur
  `connections.0004_auto_links`; angewendet, `PRAGMA integrity_check` = ok.
- **Für dich:** `python manage.py migrate` (neu: `connections/0004_auto_links`).

## 5. Backup und Wiederherstellung (lokal geübt)

SQLite-Kopie → `.backup` → Daten gelöscht (Buchungen, Reisen) → aus der Sicherung wiederhergestellt: alle Zeilenzahlen
identisch (Buchungen 7, Ordner 1, Konten 5), `integrity_check` und `foreign_key_check` sauber.
**Manuell vor dem Livegang:** PostgreSQL-Sicherung (`pg_dump`/`pg_restore`) inkl. `PRIVATE_MEDIA_ROOT` (Dateien,
Anhänge) auf dem echten Server durchspielen — lokal nicht möglich.

## 6. Leistung mit größerem Datenbestand

Erzeugt: 5.000 Buchungen, 250 Verträge/Geräte, 50 Reisen, 100 Sparziele, 300 Haushaltsaufgaben, 551 Verbindungen.

| Endpunkt | Zeit (bester von 3) | DB-Abfragen |
|---|---|---|
| Finanzen-Monat inkl. Vertragsplanung | 71 ms | 29 |
| Kalender abgeleitet, 400 Tage (400 Einträge) | 23 ms | 8 |
| Kalender abgeleitet, 1 Monat | 17 ms | 8 |
| Haushaltsaufgaben in Organisation | 5 ms | 4 |
| Status einer Quelle | 2 ms | 2 |

Abfragezahl der abgeleiteten Endpunkte ist fest (unabhängig von der Datenmenge). Messung auf SQLite lokal; unter
PostgreSQL mit Netzwerk-Latenz erneut messen.
