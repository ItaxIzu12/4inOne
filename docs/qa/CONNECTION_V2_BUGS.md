# Connection Engine V2 — Befunde (nach Schwere)

**Stand:** 02.11.2026 · Jede Zeile ist durch einen Test belegt, der das heutige Verhalten prüft
(`backend/connections/tests/test_qa_v2_scenarios.py`). Bei fehlenden Funktionen prüft der Test bewusst das **heutige**
Verhalten. Wird die Funktion gebaut, schlägt er fehl und muss angepasst werden.

Im Audit selbst wurde kein App-Code geändert (nur Tests). Danach wurden auf Wunsch alle fünf Befunde behoben (02.11.2026, Migrationen `haushalt/0010` und `0011`). Alle Befunde sind fehlende Funktionen, die ein Datenmodell oder eine
Produktentscheidung brauchen (zum Teil mit Migration). Ein „minimaler, sicherer Fix“ war für keinen von ihnen möglich.

| ID | Schwere | Bereich | Reproduktion | Erwartet | Beobachtet | Test | Vorschlag |
|---|---|---|---|---|---|---|---|
| BUG-QA2-02 | ~~hoch~~ **behoben 02.11.2026** | CON-02 Kündigungsfrist | Vertrag mit Ende 31.12.2027 und „1 Monat“ Frist. Die App kennt nur Tage, also 30 eintragen. Fristerinnerung einschalten. | letzter Kündigungstag **30.11.2027** | Kalender zeigt **01.12.2027**, einen Tag zu spät. Wer sich darauf verlässt, verpasst die Frist. | `test_qa2_04_…`, `test_qa2_04b/c_…`, Unit `vertraege-logic.spec.ts` | **Umgesetzt:** neues Feld `notice_period_months` (Migration `haushalt/0010_notice_period_months`), Formular „Zahl · Monate/Tage“, Rechnung kalendarisch: (Ende + 1 Tag) − n Monate − 1 Tag. Tage unverändert. Gesetzt ist immer nur eine Einheit. |
| BUG-QA2-03 | ~~mittel~~ **behoben 02.11.2026** | CON-02 Erinnerung | wie oben, Erinnerung „14 Tage vorher“ gewünscht | Eintrag am 17.11.2027 | Nur ein Eintrag am Fristtag. Es gibt keine Vorlaufzeit und keine Benachrichtigung. | `test_qa2_04_…`, `test_qa2_04d_…` | **Umgesetzt:** `reminder_lead_days` am Vertrag (14 Standard; 0/7/14/30), zusätzlicher Kalendereintrag „Kündigung vorbereiten“, nur solange die Frist noch kommt. Push-Benachrichtigung weiter Plan-Phase 7. |
| BUG-QA2-04 | ~~mittel~~ **behoben 02.11.2026** | CON-01 Preisänderung | Telekom 39,99 € ab 01.01.2027 verbunden. Preis auf 34,99 € ändern (gilt ab 01.03.2027). | Jan./Feb. 39,99 €, ab März 34,99 € | Alle noch nicht vergangenen Monate zeigen 34,99 €. Gebuchte Zahlungen bleiben richtig (QA2-06). | `test_qa2_05_…`, `test_qa2_05b_…` | **Umgesetzt:** `next_cost` + `next_cost_from` (privat wie `cost`); Finanzen plant je Zahlungstag den passenden Preis (`services.cost_on`); am Stichtag gilt der neue Preis, gespeichert beim nächsten Sichern. Eine Preisänderung zur Zeit (kein ganzer Verlauf). |
| BUG-QA2-05 | ~~niedrig–mittel~~ **behoben 02.11.2026** | CON-04 Wartung | Gerät mit letzter Wartung 01.07.2026 und Intervall 6 Monaten anlegen, dann letzte Wartung auf 01.08.2026 ändern | nächste Wartung 01.01.2027, danach 01.02.2027 | 02.05.2027 (heute + 6 Monate), bleibt nach der Änderung gleich. Das Formular hat kein Feld „Letzte Wartung“, nur „Nächste Wartung“. | `test_qa2_10_…` | **Umgesetzt:** Feld „Letzte Wartung“ im Formular; mit Intervall nächste = letzte + Intervall (Formular live, Backend beim Speichern, wenn letzte Wartung oder Intervall geändert und der Termin nicht ausdrücklich gesetzt wurde). |
| BUG-QA2-01 | ~~niedrig~~ **behoben 02.11.2026** | Haushalt Gerät | Gerät mit Seriennummer TEST-ABC-123 speichern | Seriennummer gespeichert | Es gibt kein Feld dafür; der Wert wird stillschweigend verworfen. Ausweg heute: Notizen. | `test_qa2_09_…` | **Umgesetzt:** Feld `serial_number` (60 Zeichen), nur in der Detailantwort wie die Vertragsnummer. |

## Hinweise (kein Fehler, aber dokumentiert)

| ID | Thema | Beobachtung |
|---|---|---|
| INFO-01 | Währungen | Verträge haben keine Währung, geplante Vertragskosten gelten als EUR. Reisen rechnen in Reisewährung, ohne zu raten (QA2-15). |
| INFO-02 | Geplant vs. bezahlt bei Reisen | Geplant steht in den Budget-Kategorien, bezahlt in den Ausgaben. Eine einzelne Ausgabe hat keinen Status „geplant“. Das Japan-Szenario rechnet richtig (QA2-12). |
| INFO-03 | Gleichzeitigkeit | Abgesichert durch einen DB-Constraint und den Umgang mit `IntegrityError`. Ein echter Mehrprozess-Test gegen PostgreSQL ist **BLOCKED** (lokal nur SQLite). |
| INFO-04 | Vorbestehend | `finanzen/tests/test_private_category_colors.py::test_travel_and_home_match_the_area_colors_of_the_app` schlägt fehl (`KeyError: 'travel'`). Er hängt nicht mit den Connections zusammen und bestand schon vor dieser Arbeit. |

## Früher gefunden und behoben (Phase 2, zur Vollständigkeit)

F-01 (Doppelplanung, hoch), F-02 (Demo-Injector), F-03 (Vertragsdialog, hoch), F-04 (Schalterbeschriftung), siehe
`docs/CONNECTION_ENGINE_V2_TEST_REPORT.md` §3. Ihre Regressionstests sind in diesem Lauf grün.
