# Reisen V1 — Stand (eingefroren)

Stand: 09.10.2026. Grundlage: „4inOne – REISEN V1 – FINALER MASTER PROMPT“.
Eine Reise ist ein klarer Container für **Übersicht, Planung, Packliste und Budget**.

## Analyse

**Bereits vorhanden:** `Trip` mit Pflicht-Zeitraum und DB-Constraint `end >= start`, Teilnehmer (`TripParticipant`,
Rollen OWNER/EDITOR/VIEWER, nur über eigene Kontakte), Packliste (`PackingItem` mit Kategorie, `packed_at`), Reise-Aufgaben
(`TripTask` mit Datum/Uhrzeit), Ausgaben (`TripExpense`, Decimal, Kategorie) und Planung je Kategorie
(`TripBudgetCategory`), Überschneidungsprüfung (`trips/overlaps/`, rein informativ), regelbasiertes Smart Setup
(`trip-suggestions.ts`), Rechte über `TripAccessPermission`/`TripContentAccessPermission`.

**Doppelt:** globale Reiter „Packlisten“, „Budget“ und „Erinnerungen“ neben der Reise; „Übersicht“ und „Reisen“
zeigten dieselbe Reise zweimal. Erinnerungen waren Reise-Aufgaben mit Uhrzeit — kein eigenes Datenmodell.

**Wiederverwendung:** alle Models, Endpunkte, Formulare (`ModalForm`, `app-field`, Datums-/Zeitauswahl), Smart Setup,
Teilnehmer-Dialog, Demo-API.

**Migration:** nur Status (siehe unten) — keine Reise, Aufgabe, Packliste oder Ausgabe wird gelöscht oder verschoben.

## Navigation

```
Reisen
└── Meine Reisen (Bevorstehend · Vergangen · Abgesagt, eingeklappt)
    └── [Reise]  Übersicht · Planung · Packliste · Budget
```

- Adresse: `/reisen` = Meine Reisen, `/reisen?trip=<id>&tab=planung|packliste|budget`. Zurück-Taste funktioniert.
- Alte Links: `?tab=packlisten` → Packliste, `?tab=erinnerungen` → Planung, `?trip=<id>` (Dashboard, Verknüpfungen) bleibt.
- **Entfernt** (UI): globale Reiter Übersicht/Reisen/Packlisten/Budget/Erinnerungen, Reise-Umschalter, Prozent-
  „Reisebereitschaft“, bereichsübergreifende Vorschläge (`trip-plan`) und Haushalts-Konflikthinweise im Reisebereich.
- **Erhalten, ohne Reiter:** Backend-Endpunkte `connections/reisen/<id>/erinnerungen/` und `…/sparziel/` sowie die
  Vorschlags-API (`connections/suggestions/`) — sie gehören zur späteren Connection Engine. Verknüpfungen einer Reise
  stehen wie in Organisation im Bearbeiten-Dialog (`app-connections`).

## Reiter

- **Übersicht:** Countdown („In 12 Tagen“, „Unterwegs · Tag 2 von 4“, „Vorbei“), vier Kacheln (Aufgaben offen,
  „12 von 24 gepackt“, „420 € von 700 €“, Teilnehmer) mit Sprung in den Reiter, Eckdaten (Ziel, Abreise, Transport,
  Unterkunft, Notiz). Kein Score.
- **Planung:** Aufgaben (Offen · Erledigt · Meine — „Meine“ nur bei mehreren Teilnehmern), Schnell-Eingabe + Formular
  mit Datum, Uhrzeit, „Wer kümmert sich?“; Teilnehmer mit Rollen und Privatsphäre-Hinweis; Anreise und Unterkunft;
  höchstens drei allgemeine Hinweise; Einstieg in die Vorschläge.
- **Packliste:** Schnell-Eingabe (Kategorie optional, sonst „Sonstiges“), Gruppen mit großen Häkchen, Alle/Offen/
  Gepackt, „x von y gepackt“, Häkchen zurücksetzen mit Rückfrage, „Vorlage verwenden“.
- **Budget:** ohne Budget und Ausgaben der Leerzustand „Noch kein Reisebudget“; sonst Gesamtbudget/Ausgegeben/
  Verbleibend mit Rechenzeile, geplant vs. ausgegeben je Kategorie, Ausgabenliste („vor der Reise“ markiert).
  Gesamtbudget und Währung werden im Dialog „Reisebudget“ festgelegt.

**Vorschläge** (feste Vorlagen aus `trip-suggestions.ts`, keine KI): aus der Planung nur Aufgaben, aus der Packliste
nur Packstücke (nach Kategorie gruppiert), direkt nach dem Anlegen einer Reise beides. Schon vorhandene Einträge
fehlen. Alle angehakt; „x von y ausgewählt“ mit „Alle abwählen/auswählen“, der Button nennt die Anzahl
(„6 Aufgaben übernehmen“), Fußleiste bleibt beim Scrollen sichtbar.

**Wetter am Ziel** (`Trip.climate`, optional: Warm · Mild · Kalt · Schnee, Migration `0010_trip_climate_winter`) und
die Reiseart **Wintersport** (`WINTER`) steuern die Vorschläge mit: Warm → Sonnenhut, leichte Kleidung, Sonnencreme;
Mild → Regenjacke, Pullover; Kalt → warme Jacke (statt „Jacke“), Mütze, Schal, Handschuhe, Lippenpflege; Schnee →
zusätzlich Thermowäsche, Winterschuhe, Sonnencreme; mit dem Auto bei Kälte/Schnee Eiskratzer und „Winterreifen (und
Schneeketten) prüfen“; Wintersport → Skibrille, Skisocken, „Skipass kaufen“, „Skiausrüstung leihen oder reservieren“
(ohne Wetterangabe gilt Schnee). Keine Mengen nach Reisedauer — die Anzahl entscheidet jeder selbst. Das Formular
schlägt das Wetter nur vor (Juni–August warm, November–Februar kalt, sonst mild; Wintersport → Schnee), sichtbar als
„Geschätzt nach Reisemonat – bitte prüfen“; eine eigene Wahl bleibt stehen. Kein Wetterdienst: Das Ziel verlässt
4inOne nicht. Ohne Angabe wird nichts Jahreszeitliches angenommen.

**Gepäck** (`Trip.baggage`, Liste, Migration `0012_trip_baggage_list`): kombinierbare Chips Handgepäck · Aufgabegepäck ·
Gepäck im Auto; nichts gewählt = keine Angabe („Noch unklar“ entfällt, alte Werte wurden übernommen). Kompakte Packliste
nur bei ausschließlich Handgepäck; Handgepäck → „Handgepäck-Maße und Flüssigkeitsregel prüfen“, Aufgabegepäck →
„Kofferanhänger“.

## Budget, Währungen und Ausgaben

- **Reisewährung** (`Trip.currency`): alle 30 Währungen mit EZB-Referenzkurs (`core/currencies.py`, Frontend
  `shared/currency/currencies.ts`), Anzeige „JPY – Japanischer Yen“. Beträge formatiert zentral `formatAmount` (Intl.NumberFormat, Locale de-DE
  getrennt von der Währung): „250.000 ¥“, „1.430,20 CHF“, „350,00 $“, „1.430,20 €“ — gespeichert wird immer Zahl +
  ISO-Code. Eine neue Reise bekommt die Landeswährung, wenn das Ziel eindeutig ein Land nennt („Tokio, Japan“ → JPY),
  sonst die Heimatwährung (auch serverseitig, wenn keine Währung mitkommt); im Budget-Dialog wird sie vorgeschlagen, solange noch nichts geplant oder ausgegeben ist. Keine
  Aussagen darüber, welche Währungen sonst „akzeptiert“ werden.
- **Heimatwährung**: eine zentrale Einstellung (`core.UserPreference`, Einstellungen → Profil), über `/auth/me/`; im
  Frontend nur über `HomeCurrency` gelesen (Demo: eigene Einstellung). Keine Währung ist bevorzugt: Ziel jeder
  Umrechnung ist die eingestellte Heimatwährung (EUR, CHF, USD, JPY …). Die einzige Vorgabe ist die Voreinstellung für
  neue Konten (`DEFAULT_HOME_CURRENCY` / `ACCOUNT_DEFAULT_HOME_CURRENCY`). Gleiche Währung wie die Heimatwährung →
  keine „≈“-Zeile. EUR ist nur die technische Basis der EZB-Tabelle (Kreuzkurse).
- **Kurse** (`core/fx.py`): tägliche EZB-Referenzkurse, vom Backend geladen (keine Nutzerdaten), höchstens alle 6 h
  (Sperre im lokalen Cache `fx`, auch nach Fehlschlag), gespeichert in `core.ExchangeRate` je Kursdatum. Älter als 7 Tage
  = nicht verfügbar. Kreuzkurse über EUR, alles Decimal. Nie ein geratener Kurs, nie „1“ als Ersatz.
  Frontend: `FxService` lädt `/fx/rates/` einmal je Sitzung und rechnet Vorschauen lokal (kein Request je Tastendruck);
  Demo mit festen, als „Beispielkurs (Demo)“ gekennzeichneten Kursen.
- **Gesamtbudget**: optional, im Dialog „Gesamtbudget festlegen“ beim Speichern Pflicht (> 0). Gespeichert in
  Reisewährung; „≈ … in deiner Heimatwährung“ zum aktuellen Richtkurs (Planwerte auf ganze Einheiten gerundet), eine
  Kursrichtung („1 JPY ≈ 0,005731 EUR“) und der einheitliche Hinweis „Umrechnung nach aktuellem Richtkurs. Der
  tatsächliche Wechselkurs deiner Bank, Karte oder Wechselstube kann abweichen.“ Kategorie-Budgets erben die
  Reisewährung und zeigen ebenfalls „≈ … geplant“.
- **Ausgaben** (`TripExpense`): Originalbetrag + Originalwährung (Standard Reisewährung) = tatsächliche Zahlung, dazu
  Notiz. Beim Speichern berechnet das **Backend** einen Schnappschuss (`reisen/expense_fx.py`): Wert in Reisewährung
  (für „Ausgegeben“), Wert in der Heimatwährung des Erfassenden, Kurse und Kursdatum. Historisch: ändert sich nur bei
  geändertem Betrag/geänderter Währung. Werte vom Client werden ignoriert. Ohne Kurs wird trotzdem gespeichert; die
  Ausgabe zählt bis dahin nicht in „Ausgegeben“ (steht dabei) und wird nachgerechnet, sobald wieder ein Kurs da ist
  (`backfill_pending` beim Laden von Reisen/Ausgaben; Kursdatum = Datum des Nachrechnens). Migrierte Ausgaben sind
  davon ausgenommen.
- **Betragsfelder** (alle Bereiche, `AmountInput` + `shared/currency/money-input.ts`): „1.500,50“, „250.000“,
  „1500.5“, „12,5“; beim Verlassen formatiert („250000“ → „250.000“), Eingefügtes wie „700 €“ wird bereinigt. Ein
  Leser für Finanzen, Haushalt und Reisen; Mehrdeutiges („12,345“, „1.2.3“) ist ungültig statt geraten. Wechselt die Reisewährung, werden nur die Werte in
  Reisewährung neu berechnet.
- **Summen**: nur über die Werte in Reisewährung — verschiedene Währungen werden nie direkt addiert. Ohne Gesamtbudget:
  „Noch kein Gesamtbudget · Bisher ausgegeben“, kein „Verbleibend“/„0 €“/„100 %“.
- **Migration** `0011_expense_currency_fx`: bestehende Ausgaben bekommen die Reisewährung als Originalwährung (war die
  implizite Annahme), Wert in Reisewährung = Betrag; kein erfundener Heimatwährungs-Wert („Umrechnung unbekannt“).
- **Validierung**: Fehler erst nach „Speichern“/„Ausgabe speichern“, direkt am Feld, danach live; „Abbrechen“ prüft
  nichts.

Hauptaktion: auf Meine Reisen „Reise erstellen“ (am Handy unten). In einer Reise „Bearbeiten“ im Kopf (am Handy als
44-px-Symbolknopf); Hinzufügen passiert im jeweiligen Reiter — kein schwebender Knopf, keine doppelten Knöpfe.

## Models und Migration (`reisen/0009_reisen_v1`)

- `Trip.status`: **PLANNED · CONFIRMED · DONE · CANCELLED** (Anzeige: In Planung · Bestätigt · Abgeschlossen ·
  Abgesagt). Kein Entwurf. „Unterwegs“ ergibt sich aus dem Zeitraum. Datenmigration: `IDEA → PLANNED`,
  `ACTIVE → CONFIRMED` (getestet in `reisen/test_migration_0009.py`). Rückwärts: Status bleibt (beide Werte gültig).
- `Trip.departure` (neu, optional, max. 120): Abreiseort als Freitext — keine Flughafen-/Flug-API.
- `TripTask.assignee` (neu, optional, `SET_NULL`): nur Ersteller oder Teilnehmer dieser Reise; unbekannte und fremde
  IDs bekommen dieselbe Meldung.
- Unverändert: `PackingItem`, `TripExpense` (`date` = Zahlungsdatum, darf vor der Reise liegen), `TripBudgetCategory`,
  `TripEvent`, `TripParticipant`.
- Bewusst nicht gebaut: eigenes Unterkunft-/Transport-Modell (die vorhandenen Felder `accommodation`,
  `accommodation_area`, `transport_type`, `transport_note` genügen für V1), Priorität und Wiederholung für Reise-
  Aufgaben, gemeinsames Task-Modell über alle Bereiche (wie in Organisation V1 dokumentiert: spätere Aufgabe).

## Validierung

- Pflicht: Name, Ziel, erster und letzter Tag; `end_date >= start_date` (Serializer + DB-Constraint). Vergangene
  Reisen sind erlaubt (der Kalender schränkt den Beginn nicht mehr auf heute ein).
- Ziel: beim Anlegen Pflicht; ältere Reisen ohne Ziel bleiben bearbeitbar, nur ausdrückliches Leeren wird abgelehnt.
- Überschneidung: Hinweis „Diese Reise überschneidet sich mit „Japan“ vom 10.–15. Nov. 2026.“ mit „Daten prüfen“ /
  „Trotzdem speichern“. Abgesagte Reisen lösen keinen Hinweis aus.
- Ausgaben: Betrag > 0 (Frontend und Backend), Decimal.

## APIs (`/api/v1/reisen/`)

| Endpunkt | Zweck |
| --- | --- |
| `trips/` GET/POST, `trips/<id>/` GET/PATCH/PUT/DELETE | Reisen; `?scope=upcoming\|past\|cancelled` |
| `trips/<id>/summary/` | Zahlen der Übersicht in einer Antwort (`open_tasks`, `packing_*`, `participants`, `budget_*`) |
| `trips/overlaps/?start_date&end_date&exclude` | Überschneidungen (nur sichtbare Reisen) |
| `tasks/`, `packing-items/`, `packing-items/zuruecksetzen/`, `expenses/`, `budget-categories/`, `participants/` | Inhalte, `?trip=<id>` |

Die Reiseliste liefert die Kennzahlen jeder Karte per Subquery-Annotation in einer Abfrage (konstante Anzahl Queries,
getestet). Das Frontend lädt beim Öffnen einer Reise deren vier Listen parallel und aktualisiert danach optimistisch.

## Rechte und Privatsphäre

- Privat by default: sichtbar nur für Ersteller und Teilnehmer. Fremde bekommen 404 — auch für Zusammenfassung,
  Inhalte und Überschneidungsprüfung; die Oberfläche zeigt für unbekannte und fremde Reisen dieselbe neutrale Meldung.
- Bearbeiten der Reise: Ersteller und Rolle OWNER. Inhalte: zusätzlich EDITOR. VIEWER liest nur.
- Teilnahme gibt keinen Zugriff auf Finanzen, Haushalt, Organisation oder andere Reisen (getestet).
- Reiseausgaben erzeugen keine Finanztransaktion (getestet) — keine Doppelzählung, keine implizite Kopplung.

## Tests

- Backend: `reisen/tests.py`, `reisen/test_reisen_v1.py` (Pflichtfelder, Ende/Beginn, vergangene Reise, Überschneidung,
  Status, Scope-Filter, Rechte, Query-Anzahl, Summary 700/420/280, Aufgaben inkl. Zuständigkeit, Packliste inkl.
  Fortschritt, Budget inkl. Kategorie, Ausgabe vor Reisebeginn, Betrag > 0, keine Finanztransaktion, Privatsphäre),
  `reisen/test_migration_0009.py`, angepasst `connections/tests/test_trip_overview.py`.
- Frontend: `reisen.spec.ts` (Meine Reisen, Leer-/Lade-/Fehlerzustände, Reiter, alte Links, Tastatur, CRUD,
  Validierung, Überschneidung, Aufgaben, Teilnehmer, Packliste, Budget, Leserechte), `reisen-logic.spec.ts`,
  `trip-suggestions.spec.ts`.
- E2E: `e2e/reisen.spec.ts` (manuelle Testfälle 1–11 inkl. 360/390/430/820/1440 px und axe), angepasst
  `mobile-domain-controls`, `scroll-lock`, `demo-pages`.

## Bewusst nicht in V1

Connection Engine, Cross-Domain-Vorschläge, Automationen, Karten/POIs, Wetter, Flugstatus, Airline-/Hotel-/Booking-
APIs (außer den EZB-Referenzkursen für Umrechnungen), Kalender-Sync, Dokumente, Fotos, Reisejournal, Reiseideen (kein vorhandener Code), AI, globale Suche (gibt es
noch nicht).

## Freeze

Nach diesem Stand nur noch Bugfixes, Sicherheits-, Barrierefreiheits-, Performance- und UX-Korrekturen aus echten
Tests. Keine neuen Hauptreiter, keine externen APIs, bevor alle vier Bereiche getestet sind. Danach: Connection Engine V1.
