# Connection Engine V2 — Testbericht (Phase 2)

**Stand:** 01.11.2026 · Alle hier genannten Läufe wurden tatsächlich ausgeführt (lokal, macOS, SQLite, Chromium).
Architektur und Regeln: `CONNECTION_ENGINE_V2_AUDIT.md`.

## 1. Automatisierte Tests

| Ebene | Datei | Inhalt | Ergebnis |
|---|---|---|---|
| Django Unit + Integration | `backend/connections/tests/test_auto_links.py` (18 Tests) | Pflicht-Szenario „Internetvertrag“, QA-01 … QA-14, Zahlungstage, Sparziel-Termin, Doppelzählung F-01, ungültige Eingaben | grün |
| Django Integration | `backend/connections/tests/test_existing_connections.py` (3) | CON-05 Abhaken ≠ Buchung, Abschließen bucht genau einmal; CON-06 Reisekosten nie in Finanzen | grün |
| Berechtigungsmatrix | `backend/core/test_permission_matrix.py` | neuer Detail-Endpunkt `AutoLinkDetailView` registriert | grün |
| Angular Unit | `frontend/src/app/shared/connections/auto-links.spec.ts` (8) | Regeln (gleich wie Backend), Vorschau, Änderungen erst beim Speichern, Reihenfolge, fremder Betrag gesperrt | grün |
| End-to-End (Playwright, Demo) | `frontend/e2e/connections-v2.spec.ts` (6) | Vertrag → Finanzen (Vorschau, genau ein Posten, Preisänderung, Pause), Vertrag → Kündigung im Kalender + Aufheben, Abbrechen verwirft, Haushaltsaufgaben in Organisation (390/1440 px, axe), abgeleitete Kalendereinträge öffnen die Quelle | grün |

Gesamtläufe: siehe `REGRESSION_TEST_REPORT.md`.

## 2. Kritische Testfälle (Plan 3.2)

| Test-ID | Erwartung | Test | Ergebnis |
|---|---|---|---|
| QA-01 | Vertrag zweimal speichern → genau ein Finanzposten | `test_qa01_…`, Szenario Schritt 6, E2E „exactly one item“ | ✅ |
| QA-02 | Preisänderung nur auf zukünftige Planwerte | `test_qa02_qa03_…`, Szenario Schritt 4, E2E Preisänderung | ✅ |
| QA-03 | Historische Zahlung bleibt identisch | `test_qa02_qa03_…`, Szenario Schritt 8 | ✅ |
| QA-04 | Unklare Kündigungsfrist → keine Frist erfinden | `test_qa04_no_invented_deadlines`, Unit „never invents“ | ✅ |
| QA-05 | Reisebudget mit Flugzahlung → keine Doppelzählung | `test_qa05_…`, `test_con06_…` | ✅ |
| QA-06 | Reise verschieben → nur abhängige Einträge | `test_qa06_…` (eigener Termin bleibt) | ✅ |
| QA-07 | Haushaltsaufgabe in Organisation erledigt → gleicher Task | `test_qa07_…`, E2E Haushaltsaufgaben | ✅ |
| QA-08 | Pausieren → keine Synchronisierung | `test_qa08_…`, Szenario Schritt 7, E2E Pause | ✅ |
| QA-09 | Verbindung löschen → keine fremden/historischen Daten weg | `test_qa09_…` (inkl. Quelle gelöscht) | ✅ |
| QA-10 | Nutzer B öffnet Verbindung von A → verweigert | `test_qa10_…` (404; fremder Betrag 403; kein Betrag im Text) | ✅ |
| QA-11 | Rechte entzogen → keine Weitergabe | `test_qa11_…` (Reise und Haushalt verlassen) | ✅ |
| QA-12 | Zwei Updates gleichzeitig → keine Duplikate | `test_qa01_…` (DB-Constraint), `create` fängt IntegrityError | ✅ (siehe Grenzen) |
| QA-13 | Zielobjekt manuell verändert → Konflikt nachvollziehbar | `test_qa13_…`: es gibt keine Kopie; Änderung an der Quelle wirkt | ✅ (entfällt durch Bauweise) |
| QA-14 | Retry nach Fehler ohne doppelte Seiteneffekte | `test_qa14_…` (Fehler mitten im Anlegen → nichts halb; Wiederholung idempotent) | ✅ |

## 3. Testprotokoll — gefundene Fehler

| ID | Bereich | Reproduktion | Erwartet / beobachtet | Schwere | Ursache / Korrektur | Regressionstest |
|---|---|---|---|---|---|---|
| F-01 | CON-01 Finanzen | Ausgabe „Strom“ als wiederkehrend markiert, Vertrag „Strom“ mit Finanzen verbunden, Folgemonat ansehen | ein Planposten / **zwei** (wiederkehrend + Vertrag) — doppelt gezählt | **hoch** | Vertrag und wiederkehrende Planung wurden unabhängig berechnet. Jetzt ersetzt ein verbundener Vertrag eine gleichnamige wiederkehrende Planung (`finanzen/private_api.planned_expenses`, Demo gleich); Buchen aus „Geplant“ legt bei Verträgen eine **einmalige** Buchung an | `test_a_linked_contract_replaces_a_recurring_booking_…` |
| F-02 | Demo Finanzen | Unit-Tests erzeugen `DemoPrivateFinanceApi` mit `new` | grün / NG0203 (inject außerhalb Kontext) | mittel (nur Tests/Demo) | Injector optional | bestehende Demo-Specs |
| F-03 | Haushalt Dialog | leerer Haushalt → „Vertrag hinzufügen“ | Dialog öffnet / NG0950, Dialog fehlte | **hoch** | Pflicht-Eingabe `sourceType` wurde vor dem Setzen gelesen → Standardwert | `e2e/haushalt-reiter.spec.ts` „empty household“ |
| F-04 | Finanzen Sparziel | Sparziel-Dialog | kein Feld „Zieldatum“ / Schalter hieß „Zieldatum im Kalender zeigen“ (irreführend, Dialog fragt kein Zieldatum ab) | niedrig | umbenannt in „Im Kalender daran erinnern“ | `e2e/private-finance.spec.ts:380` |

Alle vier sind behoben; **0 bekannte kritische oder hohe Fehler** in den Connections.

## 4. Grenzen und nicht getestete Szenarien (ausdrücklich)

- **Echte Parallelität** (zwei Prozesse gleichzeitig) wurde nicht mit mehreren Threads gegen eine Datenbank getestet
  (SQLite in Tests); abgesichert ist der Datenbank-Constraint und der Umgang mit `IntegrityError`. Unter PostgreSQL
  sollte ein Lasttest vor dem Livegang folgen.
- **Zeitzonen:** abgeleitete Einträge sind ganztägige Datumswerte (kein Uhrzeit-Versatz). Fälligkeiten über
  Monatsgrenzen in anderen Zeitzonen nicht separat getestet.
- **Vertragsverlängerung:** Ist das Vertragsende vorbei und verlängert sich der Vertrag automatisch, plant Finanzen
  weiter, die Kündigungserinnerung zeigt aber „Frist vorbei — neues Laufzeitende eintragen“ statt zu raten.
- **Haushaltsaufgaben in Organisation:** höchstens 100; zugewiesen an mich oder niemanden.
- **Gebucht ersetzt geplant:** Zuordnung über die Notiz = Vertragsname (wie bei wiederkehrenden Posten über Notiz +
  Kategorie). Eine anders benannte Buchung wird nicht erkannt.
- Benachrichtigungen (Push/Glocke) für Erinnerungen sind **nicht** Teil dieser Phase (Plan Phase 7).
