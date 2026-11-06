# Connection Engine V2 — Unabhängiges QA-Audit

**Stand:** 02.11.2026 · lokal (macOS, SQLite, Chromium) · Branch `main`, nicht committet
**Grundlage:** QA-Auftrag „Independent QA & Full Test Execution“ und `4inOne_Entwicklungsplan_Connections_V2_Testing_SmartScan.md`
**Begleitdokumente:** `CONNECTION_V2_RESULTS.md`, `CONNECTION_V2_BUGS.md`, `CONNECTION_V2_RELEASE_GATE.md`

## 0. Einschränkung vorab

Der Testkatalog mit 122 IDs (`4inOne_Connection_Engine_V2_Vollstaendiger_6_Tage_Testplan_und_Claude_Prompt.md`) lag
**nicht vor**. Entschieden wurde: ohne Katalog starten. Deshalb:

- Die 122 Katalog-IDs sind **BLOCKED – Katalog fehlt**. Keine von ihnen ist als bestanden markiert.
- Geprüft wurde mit den fiktiven Testdaten aus dem Auftrag. Die Prüfungen haben **eigene IDs** (`QA2-01` … `QA2-23`).
- Der **6-Tage-Handtest wurde nicht durchgeführt**. Er braucht echte Personen und echte Tage (siehe Release-Gate §4).

## 1. Was geprüft wurde (Inventar)

| Bereich | Regel / Funktion | Code | Vorhandene Tests vor diesem Audit |
|---|---|---|---|
| CON-01 Vertrag → Finanzen | Plant monatlich, vierteljährlich und jährlich; nur laufender und künftige Monate; eine Buchung mit dem Vertragsnamen ersetzt den Plan; nur die eintragende Person (`can_see_cost`) | `connections/auto_links.py` `contract_planned`, `finanzen/private_api.py` | `test_auto_links.py` |
| CON-02 Vertrag → Kündigungsfrist | Nur wenn Vertragsende **und** Frist (in Tagen) gesetzt sind; Datum = Ende − Frist; keine Vorlaufzeit | `contract_reminder_day` | dito |
| CON-03 Haushaltsaufgaben in Organisation | Derselbe Datensatz; höchstens 100; nur mir zugewiesen oder niemandem | `household_tasks` | dito, E2E |
| CON-04 Gerät → Wartung | Nur mit `maintenance_due_date` | `device_maintenance_day` | dito |
| CON-05 Einkauf → Finanzen | Abhaken ist keine Buchung; Abschließen mit Betrag bucht einmal | `haushalt` | `test_existing_connections.py` |
| CON-06 Reisen ↔ Finanzen | Reisekosten nie in Finanzen | `reisen` | dito |
| CON-07 Reise → Kalender | Zeitraum als ganztägiger Eintrag | `calendar_items` | `test_auto_links.py` |
| CON-10 Sparziel → Erinnerung | Zieldatum, sonst Endmonat; offen ohne Ende → kein Datum | `savings_day` | dito |
| Rechte | Die Quelle wird bei jedem Lesen geprüft; fremd = 404; fremden Betrag planen = 403 | `views.py`, `registry` | QA-10/11, `test_permission_matrix.py` |

## 2. Testdaten → Abdeckung

| Testdaten aus dem Auftrag | Darstellbar? | Automatisiert | Befund |
|---|---|---|---|
| Telekom 39,99 € monatlich, 01.01.–31.12.2027 | ja | QA2-02, 03 | — |
| Frist 1 Monat | ja, seit 02.11.2026 (`notice_period_months`) | QA2-04, 04b, 04c | BUG-QA2-02 behoben: 30.11.2027 |
| Erinnerung 14 Tage vor der Frist | **nein** | QA2-04 (belegt das Fehlen) | **BUG-QA2-03** |
| Preis 34,99 € ab 01.03.2027 | **nein** (kein Gültig-ab-Datum) | QA2-05 (belegt das heutige Verhalten) | **BUG-QA2-04** |
| Strom 75 € monatlich | ja | QA2-07 | — |
| Wöchentliche Aufgabe „Wohnung reinigen“ | ja | QA2-08 | — |
| Samsung TEST-WM-100 | ja (Feld `model`) | QA2-09 | — |
| Seriennummer TEST-ABC-123 | **nein** | QA2-09 | **BUG-QA2-01** |
| Letzte Wartung 01.07.2026, Intervall 6 Monate, dann 01.08.2026 | nur teilweise | QA2-10 | **BUG-QA2-05**: die letzte Wartung bestimmt die nächste nicht; das Formular hat kein Feld dafür |
| Einkauf Milch, Reis, Brot, Gemüse; 24,50 € | ja | QA2-11 | — |
| Japan 12.–19.03.2027, Budget 2000 €; Flug 750 € und Hotel 550 € geplant und bezahlt → ausgegeben 1300 €, übrig 700 € | ja; „geplant“ steckt in den Budget-Kategorien, „bezahlt“ in den Ausgaben | QA2-12 | — |
| Ende auf 21.03. verschieben | ja | QA2-13 | — |
| Überschneidung 18.–20.03. | ja (Warnung, blockiert nicht) | QA2-14 | — |
| Private Ausgabe von A: 300 € | ja | QA2-16 | — |
| Nutzer A, B, C | ja | QA2-16 … 19 | — |
| Zeitzone Europe/Berlin | ja | QA2-01 (Datum im Test fest auf 02.11.2026) | — |
| Mehrere Währungen | Reisen: ja; Verträge: nur EUR | QA2-15 | Hinweis: Verträge haben keine Währung (siehe Bugs, Info) |
| Gleichzeitigkeit | DB-Constraint vorhanden | QA-01/12 (bestehend) | Echter Paralleltest **BLOCKED** (SQLite, kein PostgreSQL lokal) |

## 3. Wege in der App (Einstiegspunkte)

| Was | Wo | Wer |
|---|---|---|
| Vertrag/Gerät verbinden | Haushalt › Ordner › Vertrag oder Gerät bearbeiten › Abschnitt „Verbindungen“ | A (eintragende Person); B nur Fristerinnerung, kein Betrag |
| Geplante Vertragskosten | Finanzen › Geplant (Marke „aus Haushalt › Vertrag“) | nur wer verbunden hat |
| Fristen, Wartung, Reisen, Sparziele | Organisation › Kalender (nur lesbar; Klick öffnet die Quelle) | nur wer verbunden hat |
| Haushaltsaufgaben | Organisation › Aufgaben › „Aus dem Haushalt“ | Mitglieder des Haushalts |
| Reise im Kalender | Reisen › Reise bearbeiten › „Verbindungen“ | Ersteller und Teilnehmer der Reise |
| Sparziel-Erinnerung | Finanzen › Sparziele › Ziel bearbeiten | nur die Eigentümerin |

C (außenstehend) hat keinen Einstieg zu Daten von A. Direkte API-Aufrufe liefern 404 (QA2-18).

## 4. Risiken

1. ~~Kündigungsfrist einen Tag zu spät~~ (BUG-QA2-02) — behoben 02.11.2026.
2. Erinnerungen erscheinen nur im Kalender, ohne Vorlauf und ohne Benachrichtigung (BUG-QA2-03; Push ist Plan-Phase 7).
3. Eine Preisänderung schreibt auch die geplanten Werte der Monate vor ihrem Gültigkeitsdatum um (BUG-QA2-04). Gebuchte
   Zahlungen bleiben unberührt.
4. Echte Gleichzeitigkeit, Backup und Restore sind nur auf SQLite geprüft, nicht auf PostgreSQL.
5. Ohne den 122-ID-Katalog ist die Abdeckung des Plans nicht belegbar.
