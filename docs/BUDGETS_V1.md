# Finanzen › Budgets V1 — Stand (eingefroren)

Stand: 07.10.2026. Gezieltes UX-Refactoring des bestehenden Screens, kein Neubau.

## Analyse
- `MonthlyBudget` hat Startmonat, `end_month` und `open_ended` — ein Budget gilt für mehrere Monate,
  es entstehen **keine** Datensätze pro Monat. Das gewinnende Budget eines Monats: `winningBudget()` / `MonthlyBudget.for_month`.
- Formel (Backend `finanzen/private_api.py month_figures`): `available = budget − Ausgaben − gespart`; Einnahmen bleiben separat.
- Ein Sparziel ohne Beitrag und ohne Sparrate bindet nichts. **Abweichung zur Vorgabe:** Ein aktives Ziel **mit monatlicher
  Sparrate** reserviert diese Rate bereits vorab (`saved_planned`, bestehende Funktion mit Warnung bei Überplanung). Das bleibt
  unverändert, wird aber getrennt ausgewiesen („für Sparraten eingeplant“), nie als Ausgabe.

## Geändert (nur Frontend, keine Migration)
- „Bereits verbraucht“ → **Budget gebunden**, darunter getrennt „ausgegeben“, „gespart“ (und ggf. „für Sparraten eingeplant“).
- „Vom Monatsbudget übrig“ mit „x % verfügbar“; Monatsbudget mit „Gültig: Ab April 2026, bis auf Weiteres“.
- Monat ohne Budget: „Noch kein Budget für …“ mit **einem** Knopf „Budget festlegen“, neutral „Im … ausgegeben“, keine 0-€-Werte.
- Kategorie-Budgets: Status in Worten (Im Rahmen · Bald erreicht · Fast ausgeschöpft · Ausgeschöpft · Überschritten);
  leerer Zustand „Noch keine Kategorie-Budgets“.
- Budgetstatus: „Nur noch 10 € übrig. 90 % des Kategorie-Budgets verwendet.“
- Donut „Budget-Nutzung“ **entfernt**: er zeigte die Ausgabenverteilung, die der Reiter Ausgaben bereits zeigt.
- 12-Monats-Liste nicht mehr dauerhaft: „Jahresplanung · x von 12 Monaten mit Budget“ → Dialog „Budgetjahr“ (bestehende Komponente).

## Tests
- Backend `finanzen/tests/test_private_v1.py::test_budget_v1_example_bound_and_remaining` (3.000 / 1.272,71 / 1.025 → 702,29;
  gebunden 2.297,71; Einnahmen; Ziel ohne Beitrag; November; Jahreswechsel; Monat ohne Budget).
- Frontend `finance-tabs.spec.ts` (Statustexte), `budget-timeline.spec.ts`.
- E2E `budget-year.spec.ts` (360/390/430/1440 px, axe, Dialog, Monat ohne Budget), `private-finance.spec.ts`.

## Eingefroren
Bis die vier Hauptbereiche stabil getestet sind, nur noch Bugfixes, UX-Fixes aus echten Tests, Barrierefreiheit,
Performance und Sicherheit — keine neuen Budget-Funktionen.
