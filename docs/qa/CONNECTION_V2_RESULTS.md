# Connection Engine V2 — Testergebnisse

**Stand:** 02.11.2026 · lokal (macOS, SQLite, Chromium) · alle Zahlen stammen aus tatsächlich ausgeführten Läufen.
Status: **PASS** = automatisiert ausgeführt und grün · **MISSING** = Funktion fehlt (der Test belegt das heutige
Verhalten) · **BLOCKED** = nicht prüfbar · **MANUAL** = braucht Menschen oder Zeit · **FAIL** = Test rot.

## 1. Gesamtläufe

| Suite | Befehl | Ergebnis |
|---|---|---|
| Backend (pytest, ohne Ausschluss) | `cd backend && python -m pytest -q` | **1098 bestanden, 1 fehlgeschlagen**: der vorbestehende Farbtest `test_private_category_colors…` (INFO-04) |
| Neue QA-Szenarien | `python -m pytest connections/tests/test_qa_v2_scenarios.py` | **26 bestanden** (23 Tests, einer mit 4 Parametern) |
| Frontend Unit (Vitest) | `npx ng test --watch=false` | **476 bestanden** (74 Dateien) |
| E2E (Playwright), 1. Lauf | `npx playwright test` | 345 bestanden, 8 fehlgeschlagen |
| E2E, 2. Lauf nach zwei Testkorrekturen | `npx playwright test` | **348 bestanden, 5 fehlgeschlagen** (6,1 min) |

**Die 5 E2E-Fehler im 2. Lauf** sind alle Finanzen-Tests, die vom Datum abhängen. Die Demo bucht Fixkosten zum
Monatsersten, und heute ist der 02.11., gestern der 01.11.:

- `finance-import.spec.ts:19` (390/1440)
- `finance-periods.spec.ts:7` (390/1440)
- `finance-periods.spec.ts:101` (der Vortag 01.11. hat nur Einnahmen)

Die Korrektur läuft als eigene Aufgabe. Mit den Connections hängen sie nicht zusammen.

**Im 1. Lauf zusätzlich rot und in diesem Audit geklärt:**

| Test | Ursache | Maßnahme |
|---|---|---|
| `finance-planned.spec.ts:12` (390/768) | Der Test las das Label des laufenden Monats, bevor „nächster Monat“ geladen war. Seit der Vertragsplanung hat der November einen geplanten Posten (39,99 €), deshalb fiel der Wettlauf auf. Die App zeigt nach dem Laden richtig 669,38 €. | Test wartet jetzt auf den Monatsnamen im Label. Ergebnis: 10/10 grün. |
| `organisation.spec.ts:359` | In der Demo-Woche ab 02.11. hat jeder Tag einen Termin, der Test fand keinen leeren Tag. Das hängt am Datum. | Test blättert bis zu 3 Wochen weiter. Ergebnis: 2/2 grün. |
| `invitations.spec.ts:187` (430) | Zeitüberschreitung unter Last | einzeln wiederholt 6/6 grün, keine Änderung |

## 2. Eigene QA-IDs (Testdaten aus dem Auftrag)

Datei: `backend/connections/tests/test_qa_v2_scenarios.py`. Das Datum ist im Test auf den 02.11.2026 (Europe/Berlin)
festgesetzt.

| ID | Prüfung | Status | Beleg |
|---|---|---|---|
| QA2-01 | Zeitzone Europe/Berlin, `USE_TZ` | PASS | `test_qa2_01_…` |
| QA2-02 | Telekom 39,99 €: jeden Monat 2027 genau ein Posten am 1., nichts davor und danach, keine Buchung | PASS | `test_qa2_02_…` |
| QA2-03 | Zweimal verbinden und erneut speichern → eine Verbindung (201, dann 200), ein Posten | PASS | `test_qa2_03_…` |
| QA2-04 | Kündigungsfrist „1 Monat“ → 30.11.2027 | **PASS** seit 02.11.2026 (BUG-QA2-02 behoben); Hinweis 14 Tage vorher **PASS** (BUG-QA2-03 behoben) | `test_qa2_04_…`; Einheiten wechseln, ungültige Monate: `test_qa2_04b_…`; Kalenderfälle inkl. Schaltjahr: `test_qa2_04c_…` (6) |
| QA2-05 | Preis 34,99 € ab 01.03.2027 | **PASS** seit 02.11.2026 (BUG-QA2-04 behoben) | `test_qa2_05_…` (Jan./Feb. 39,99, ab März 34,99), `test_qa2_05b_…` (Stichtag, privat) |
| QA2-06 | Gebuchte Zahlung ersetzt den Plan; historische Zahlung bleibt nach der Preisänderung gleich | PASS | `test_qa2_06_…` |
| QA2-07 | Telekom + Strom 75 € → zwei Posten, Summe 114,99 € | PASS | `test_qa2_07_…` |
| QA2-08 | Wöchentlich „Wohnung reinigen“: in Organisation genau einmal; Erledigen → nächste am 09.11.; C sieht nichts | PASS | `test_qa2_08_…` |
| QA2-09 | Gerät Samsung TEST-WM-100, Wartung im Kalender | PASS; Seriennummer PASS seit 02.11.2026 (BUG-QA2-01 behoben) | `test_qa2_09_…` |
| QA2-10 | Letzte Wartung 01.07. bzw. 01.08.2026 bestimmt die nächste | **PASS** seit 02.11.2026 (BUG-QA2-05 behoben): 01.01.2027 bzw. 01.02.2027 | `test_qa2_10_…` |
| QA2-11 | Einkauf Milch, Reis, Brot, Gemüse: Abhaken bucht nicht; 24,50 € genau einmal; B sieht die Buchung nicht | PASS | `test_qa2_11_…` |
| QA2-12 | Japan: Budget 2000 €, geplant 750 € + 550 € → ausgegeben 0 €; bezahlt → ausgegeben 1300 €, übrig 700 €; nichts in Finanzen | PASS | `test_qa2_12_…` |
| QA2-13 | Reise-Ende auf 21.03. → der Kalendereintrag folgt, keine Kopie | PASS | `test_qa2_13_…` |
| QA2-14 | Überschneidung 18.–20.03. gemeldet, nicht blockiert; C bekommt nichts | PASS | `test_qa2_14_…` |
| QA2-15 | Reise in JPY: kein Umrechnen geraten, keine Buchung | PASS | `test_qa2_15_…` |
| QA2-16 | Private Ausgabe 300 € von A: B und C bekommen bei GET/PATCH/DELETE 404, die Summe zeigt 0 | PASS | `test_qa2_16_…` |
| QA2-17 | B: sieht die Verbindung und den Betrag von A nicht; Pausieren/Löschen 404; Betrag planen 403; eigene Fristerinnerung möglich | PASS | `test_qa2_17_…` |
| QA2-18 | C: 404 auf Vertrag, Reise, Status, Anlegen, Pausieren, Löschen; Kalender leer | PASS | `test_qa2_18_…` |
| QA2-19 | B verlässt den Haushalt → abgeleitete Einträge verschwinden, Daten bleiben | PASS | `test_qa2_19_…` |
| QA2-20 | Ungültige Beträge (−5, 0, „abc“, 1e15) in Finanzen, Reiseausgaben, Vertragskosten und Budget → 400 | PASS (4 Parameter) | `test_qa2_20_…` |
| QA2-21 | Ungültige Verbindungsanfragen (Art, ID, fremde ID, Zeitraum > 400 Tage, Ende vor Start, Status) | PASS | `test_qa2_21_…` |
| QA2-22 | Pausieren, Fortsetzen, Aufheben, Quelle löschen; Protokoll in Reihenfolge, ohne Inhalte | PASS | `test_qa2_22_…` |
| QA2-23 | Anlegen, Ändern und Löschen in allen vier Modulen ohne Verbindungen → keine Verbindung entsteht | PASS | `test_qa2_23_…` |
| QA2-24 | Echte Gleichzeitigkeit (mehrere Prozesse, PostgreSQL) | **BLOCKED** | lokal nur SQLite; abgesichert durch DB-Constraint (QA-01/12) |
| QA2-25 | 6-Tage-Handtest mit A/B/C | **MANUAL – nicht durchgeführt** | siehe Release-Gate §4 |

Weiterhin grün (frühere Phasen, im Gesamtlauf enthalten): QA-01 … QA-14 (`test_auto_links.py`), CON-05/06
(`test_existing_connections.py`), `auto-links.spec.ts` (8), `e2e/connections-v2.spec.ts` (6).

## 3. Katalog mit 122 IDs

| IDs | Status |
|---|---|
| alle 122 | **BLOCKED – Katalog fehlt** (`4inOne_Connection_Engine_V2_Vollstaendiger_6_Tage_Testplan_und_Claude_Prompt.md` lag nicht vor). Keine ID ist als PASS gewertet. Liegt der Katalog vor, lassen sich die IDs den QA2-Tests oben zuordnen. |

## 4. In diesem Audit geänderte Dateien

- neu: `backend/connections/tests/test_qa_v2_scenarios.py`, `docs/qa/*.md`
- Testkorrekturen: `frontend/e2e/finance-planned.spec.ts`, `frontend/e2e/organisation.spec.ts`
- Im Audit kein App-Code geändert. Danach behoben: BUG-QA2-02 (Kündigungsfrist in Monaten), Migration
  `haushalt/0010_notice_period_months`. Nachlauf: Backend `haushalt` + `connections` 392 grün, Unit 476 grün,
  E2E Haushalt/Connections 52 grün.

## 5. Nachlauf nach den Korrekturen BUG-QA2-01 … 05 (02.–04.11.2026)

| Suite | Ergebnis |
|---|---|
| Backend gesamt | **1107 bestanden, 1 fehlgeschlagen** (vorbestehender Farbtest INFO-04) |
| Frontend Unit | **477 bestanden** |
| E2E gezielt (Haushalt, Connections, Finanzen › Geplant, Organisation, Private Finanzen) | **107 bestanden** |
| E2E gesamt | **nicht auswertbar**: Zwei Läufe unter Systemlast 11–22 dauerten 7,6 h bzw. 11,4 h (normal ~4–6 min), über 150 Zeitüberschreitungen; der Build allein brauchte 1080 s statt ~7 s. Rote Tests dort sind überwiegend `Test timeout`. Erneut laufen lassen, wenn der Rechner frei ist. |
