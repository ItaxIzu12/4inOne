# Dashboard V1 — Stand (eingefroren)

Stand: 10.10.2026. Grundlage: „4inOne – DASHBOARD V1 – FINAL UX REFINEMENT PROMPT“.
Das Dashboard beantwortet genau eine Frage: **Was ist heute für mich wichtig?**

## Aufbau

1. Begrüßung nach Tageszeit (Guten Morgen / Guten Tag / Guten Abend) + „Das steht heute an.“, rechts **+ Hinzufügen**.
2. Vier Bereiche als ein ruhiges Band (Desktop 4 Spalten, ab 1100 px 2×2, am Handy 2×2 mit Symbol oben) — je
   höchstens zwei Angaben, jedes Feld ein Link in den Bereich:
   - Finanzen: „702,29 € übrig“ · „vom Monatsbudget“ (sonst „x € über dem Budget“ / „Starte mit deinem Monatsbudget“)
   - Haushalt: „3 Aufgaben heute“ · „1 überfällig“ (sonst „1 überfällig“ / „Keine Aufgabe heute“) — nie die Gesamtzahl
   - Organisation: „2 Termine heute“ · „2 Aufgaben heute“ (sonst „Keine Termine heute“)
   - Reisen: „Berlin“ · „in 12 Tagen“ (Ort aus dem Ziel, sonst Titel; sonst „Keine Reise geplant“)
3. **Heute** — Hauptfläche, höchstens 5 Zeilen, „Alle anzeigen (n)“ klappt den Rest an Ort und Stelle auf.
4. **Für dich** — höchstens eine Karte, nur aus echten Daten, nur wenn es etwas gibt.

Danach endet die Seite bewusst. Kein Foto, keine Diagramme, kein Wetter.

## Heute: Inhalt und Reihenfolge

Nur Tagesrelevantes: heutige Termine (auch wiederkehrend), heute fällige und überfällige Aufgaben aus Organisation
und Haushalt, Reise-Termine von heute, Haushaltsfristen, die heute enden. **Nicht**: künftige Fristen (→ „Für dich“),
Einkaufsliste, Transaktionen, Vorschläge.

Sortierung: 1. überfällig · 2. mit Uhrzeit, chronologisch · 3. heute ohne Uhrzeit · 4. sonstige Tagespunkte.
„Überfällig“ steht immer als Text in der Zeile; Rot unterstützt nur. Zweite Zeile = Ort oder Bereich
(„Organisation“, „Haushalt · überfällig“). Die bedeutungslosen violetten Punkte sind entfernt.

Leer: „Heute ist nichts Dringendes offen — Du hast heute keine fälligen Aufgaben oder Termine.“ + Hinzufügen.

## Für dich

Kandidaten innerhalb von 30 Tagen, die nicht schon unter „Heute“ stehen: die nächste Haushaltsfrist (Wartung,
Garantie, Kündigungsfrist) oder die nächste Reise mit offener Vorbereitung (Aufgaben offen oder ungepackt). Die
frühere gewinnt, bei Gleichstand die Frist (sie steht sonst nirgends auf der Seite). Sonst keine Karte.
Keine Connection-Vorschläge, keine KI — die bisherigen Reise-Vorschläge erscheinen nicht mehr auf der Startseite.

## Hinzufügen (Schnellerfassung)

Liste aus Links (Disclosure, kein ARIA-Menü): **Buchung, Aufgabe, Termin, Notiz, Einkauf, Reise**. Jeder Eintrag
öffnet das **bestehende** Formular über `?neu=`:

| Eintrag | Ziel |
| --- | --- |
| Buchung | `/finanzen?tab=transactions&neu=buchung` → „Buchung erstellen“ |
| Aufgabe | `/organisation?tab=tasks&neu=aufgabe` → „Aufgabe hinzufügen“ |
| Termin | `/organisation?neu=termin` → „Termin hinzufügen“ |
| Notiz | `/organisation?tab=notes&neu=notiz` → „Neue Notiz“ |
| Einkauf | `/haushalt?tab=einkaufen&neu=artikel` → Fokus im Feld „Artikel hinzufügen“ |
| Reise | `/reisen?neu=reise` → „Reise erstellen“ |

Jede Seite nimmt nur ihre festen Werte an (unbekannte werden ignoriert) und räumt die Adresse danach auf.
Tastatur: Enter öffnet, Fokus auf dem ersten Eintrag, Escape schließt und setzt den Fokus zurück; Klick daneben
schließt. Am Handy nur das Plus-Symbol (44 px, Name „Hinzufügen“).

## Daten, Performance, Rechte

- Bestehende Endpunkte, kein neuer Dashboard-Endpunkt nötig: Finanzen-Monatssummary, Haushalt-Übersicht
  (`summary.due_today`, `overdue_tasks`, `deadlines`), Organisation-Heute bzw. `/today/` (echtes Konto), Reisen.
- Echtes Konto lädt Reisen nur mit `?scope=upcoming`. Eigene Aufgaben werden erst geladen, wenn jemand sucht.
- Alle Zahlen kommen aus serverseitig eingeschränkten Endpunkten: Haushalt nur der eigene Haushalt, Kind-Konten ohne
  Geräte-/Vertragsfristen (Test `test_dashboard_day_counts_and_deadlines_never_leak`), Organisation nur eigene
  Daten, Reisen nur eigene/geteilte (Reisen V1). Echte Konten sehen nie Demo-Daten.
- Teilfehler: Ein nicht ladbarer Bereich zeigt „Gerade nicht verfügbar“, darunter „Einige Bereiche konnten gerade
  nicht geladen werden. Erneut versuchen“ — lädt gezielt nur die fehlgeschlagenen Bereiche. Keine technischen Texte.
- Laden: Platzhalter in den Bereichsfeldern und in Heute, kein Springen.

## Weitere Änderungen

- „Familie & Freunde“ heißt jetzt **„Personen & Gruppen“** (nur Beschriftung; Route `/familie` und Daten bleiben).
- Suche: bleibt „Im Überblick suchen …“ — sie durchsucht Aufgaben, Buchungen des Monats und die nächste Reise,
  keine globale Suche; eine globale Suche wird nicht versprochen.

## Tests

- `e2e/dashboard-v1.spec.ts`: Kennzahlen, Sortierung, eine „Für dich“-Karte, Schnellerfassung (Tastatur, Escape,
  alle sechs Ziele, Adresse aufgeräumt, unbekannter `?neu=` ignoriert), 320/360/390/430/820/1280/1920 px mit axe,
  2×2-Raster und 5 Punkte in der unteren Navigation, echtes Konto ohne Daten (keine Demo-Daten, keine Vorschläge,
  nur `scope=upcoming`), Teilfehler mit Wiederholen.
- `dashboard.spec.ts` (Unit), angepasst: `demo-dashboard`, `dashboard-today`, `phase1`, `landing`,
  `account-menu`, `familie`.
- Backend: `haushalt/test_haushalt_v1.py::test_dashboard_day_counts_and_deadlines_never_leak`.

## Bewusst nicht

Connections, Suggestions-Anzeige, Automationen, Wetter, KI, Diagramme, News, zusätzliche Widgets oder Reiter,
neuer Dashboard-Endpunkt.

## Verfeinerung (10.10.2026, bewusste Ausnahme vom Freeze)

Mit UI Taste + Impeccable geprüft, nur gezielte Änderungen — Struktur, Inhalte und Logik unverändert:
- Bereichsband: Symbol klein (16 px) in der Bereichszeile statt getönter Kachel; der Wert trägt die Hierarchie
  (16 px, tabellarische Ziffern). Am Handy dadurch ein kompaktes 2×2, „Heute“ rückt nach oben.
- „Für dich“ ist sichtbar nachrangig (15 px, gedämpft); „Heute“ bleibt die Hauptüberschrift (20 px). Die Karte nutzt
  dasselbe kleine Bereichssymbol statt einer Kachel.
- Fehler behoben: im 2×2-Raster bekam „Organisation“ eine überflüssige linke Linie (Spezifität mit der Style-Kapselung).
- Haushalt ist app-weit warmes Coral (`#b8432a`, Fläche `#fdeee9`), siehe docs/DESIGN_SYSTEM.md.

Polish-Runde 2 (frontend-design / typeset / polish, Sidebar bewusst unverändert):
- Breite 960 → 1120 px (seit System V3: gemeinsamer Container 1280 px wie alle Bereiche); Skalen fest: Typo 12/13/14/16/20/30 px, Gewichte 400–700, Radien 8/12/16, Abstände
  4–48; Rhythmus Kopf→Band 32, Band→Heute 48, Heute→Für dich 40.
- Heute: ein Raster (Zeit | Titel+Herkunft | Chevron), Zeit auf Titelzeile ausgerichtet, ganze Zeile als Klickfläche
  mit Hover/Active; Chevron bewegt sich leicht. Reduzierte Bewegung abgeschaltet.
- Demo-Hinweis oben ruhiger (ohne Kontur, gedämpft), ordnet sich Suche und Überschrift unter.
- Geprüft: 360–1920 px + 200 % Zoom (720 px), axe ohne Befund, genau ein aktiver Navigationspunkt, Ziele ≥ 44 px,
  lange Inhalte ohne Querscroll.

Design System V3 (10.10.2026): Die Startseite ist der **Referenz-Screen** — alle Werte kommen aus den globalen Tokens
(`styles.css`, beschrieben in docs/DESIGN_SYSTEM.md und DESIGN.md); Titel 30 px wie die Bereichsköpfe, Start auf
derselben Kante und Höhe wie die Bereiche.

Feinschliff (10.10.2026): „Für dich“ zeigt beim Laden einen Platzhalter in Kartenform (solange Haushalt-Fristen oder
Reisen laden) und verschwindet danach, wenn nichts Relevantes da ist. Das „Hinzufügen“-Menü blendet ruhig ein
(150 ms, Deckkraft + 4 px), bei reduzierter Bewegung ohne Animation. Magic UI wird nicht verwendet (React-Bibliothek,
4inOne ist Angular; die erlaubten Effekte sind mit CSS umgesetzt).

## Freeze

Nur noch Bugfixes, Sicherheit, Barrierefreiheit, Performance und echte UX-Probleme aus Nutzertests. Keine Widgets,
nur weil Platz ist.

## Neubau 15.10.2026 — „Als Nächstes + Reihe“

Die Startseite beantwortet zuerst „Was muss ich heute tun?“: Die erste Zeile von „Heute“ (dieselbe Sortierung:
überfällig → mit Uhrzeit → ganztägig → Fristen) steht groß als „Als Nächstes“, der Rest darunter; „Für dich“ steht
daneben, die vier Bereiche als Reihe darunter (vorher darüber). Unter der Begrüßung ein Tagesstand aus echten Zahlen.
Daten, Aufrufe, Sortierung, Hinweise, Suche, Schnellerfassung und Leer-/Lade-/Fehlerzustände sind unverändert;
Gestaltung siehe docs/DESIGN_SYSTEM.md › App-Startseite (15.10.2026).

## Feinschliff 15.10.2026 — Priorisierung und Demo-Zusammenhang

Die hervorgehobene Zeile zeigt den nächsten noch anstehenden Eintrag mit Uhrzeit (lokale Uhr), danach eine heutige
Aufgabe ohne Uhrzeit; nur ohne solche Einträge fällt sie auf die bestehende Sortierung zurück. Überfällige und
bereits verstrichene Termine bleiben in den weiteren Zeilen sichtbar; keine automatische Erledigung oder Änderung.
Auf dem Handy kleinere Uhrzeit (30 px, überfälliges Datum 22 px), Titel 21 px und kompaktere Innenabstände.
Sidebar, Navigation, Farben und Icons bleiben bestehen.

Die öffentliche Demo zeigt in der vorhandenen einzelnen „Für dich“-Karte einen Zusammenhang zwischen dem vorhandenen
Sparziel „Badmintonschuhe“ und der zusätzlichen Demo-Aufgabe „Badmintonschuhe vergleichen“. Beide werden aus den
Demo-Datenquellen geladen, kein echtes Konto wird befüllt. Der Dialog erklärt den Grund und erlaubt Verknüpfen,
Entfernen und Ablehnen ausschließlich als ausdrücklich gekennzeichnetes lokales Beispiel. Diese Vorschau ist kein
Backend-Connection-Datensatz und wird beim Neuladen zurückgesetzt; die Domain-Links öffnen die bestehenden Einträge.
Live-Konten behalten ihre tatsächlichen serverseitigen Vorschläge und Fristen. Keine neue Connection Engine.

Handyansicht: Die zusätzliche dekorative Tagesachse entfällt; Uhrzeiten bleiben in den bedienbaren Zeilen. Demo-Dialogaktionen und Objektlinks besitzen mindestens 44 px Höhe und sichtbaren Tastaturfokus.

### Helle Dashboard-Übersicht (15.10.2026)
Ersetzt die dunkle Tagesbühne vollständig: weiße, dezent umrandete Tagesliste mit gleich großen Zeilen und ruhiger Markierung „Im Fokus“. Keine große Datumszahl oder Tagesachse. Priorisierung bleibt erhalten. Demo-Zusammenhang zeigt Sparziel und Aufgabe als zwei beschriftete, direkt erreichbare Objekte mit verbindender Erklärung und separater Aktion. Bestehende Navigation, Icons und Bereichsfarben bleiben bestehen. Diese Entscheidung ersetzt die vorherige Tagesbühnen-Gestaltung.
Vier Bereichskarten im kompakten Band vor der Tagesliste: vier Spalten auf Desktop, zwei am Handy. Die Kontextkarte
bleibt daneben statt die Bereichskarten aus dem ersten sichtbaren Bildschirmbereich zu verdrängen.

## Neuordnung 17.10.2026 — „kein zweites Menü“

Die Startseite beantwortet drei Fragen, für das Handy zuerst: Was muss ich jetzt tun? (Überfälliges als eigene
Zeile, „Als Nächstes“ = nächster Termin, der heute noch kommt, auf der Tagesbühne; abends ehrlich „Für heute ist
nichts mehr geplant“) · Was steht heute sonst an? (Rest, Vergangenes mit „vorbei“ am Ende) · Was kommt bald?
(Demnächst: nächste Reise und Frist; Für dich: nur Verknüpfungen; Budget: eine Zahl). Die vier Bereichskacheln und
die Hervorhebung der Onboarding-Auswahl sind entfernt — die Bereiche erreicht man über die Navigation. Die
Tageszeitleiste ist entfernt. Tests mit fester Uhr (page.clock / vi.setSystemTime), weil die Reihenfolge von der
Uhrzeit abhängt.

## Tagesplan 17.10.2026 (aktuell)

Ruhig und erklärbar: Begrüßung mit Tageszeile, der Tag als Plan in Gruppen (Überfällig · Als Nächstes · Später · Ohne
Uhrzeit · Vorbei) in einer einzigen Zeilen-Form, daneben bzw. darunter Demnächst (mit Datum), Budget und Für dich im
selben Stil; für neue Konten „Erste Schritte“ (Budget, erste Aufgabe/Termin, Reise — haken sich mit echten Daten ab).
Bühne, Tagessatz und Zeitleiste sind entfernt.

Erkennbarkeit (17.10.2026): Bereichs-Symbole wie in der Navigation statt Farbpunkten, Bereich als Wort im Hinweis
(auch am Handy), keine Doppelungen (Zeitspalte bei „Ohne Uhrzeit“ leer, „überfällig“ nur in der Gruppe und für
Screenreader), erklärender Satz bei „Für dich“ und bei „Erste Schritte“, kein Logo-Zeichen und keine Tagesbewegung.
