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

## Freeze

Nur noch Bugfixes, Sicherheit, Barrierefreiheit, Performance und echte UX-Probleme aus Nutzertests. Keine Widgets,
nur weil Platz ist.
