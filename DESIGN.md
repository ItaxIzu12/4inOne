# 4inOne — DESIGN.md (Kurzfassung)

Kanonisch und ausführlich: [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) · Werte: `frontend/src/styles.css` (`:root`).
**Bei jeder UI-/Design-Änderung beide Dateien im selben Schritt aktualisieren.**

## Charakter
Erwachsen, ruhig, hochwertig, klar, effizient — freundlich, nicht verspielt. Ein Designsystem, vier Fachbereiche.
Systematisch im Grundgerüst, flexibel im Inhalt. Keine Gradients, Glas, Glow, Deko-Charts, Badge-Fluten, Karten in Karten.

## Tokens (System V3)
- Flächen: `--surface-app #f4f6fa`, `--surface-card #fff`, Hover `#f6f8fb`, Press `#eef2f7`.
- Text: `--text-primary #1b2a44`, `--text-secondary #56657c`. Linien: `--border-subtle #e7ebf1`, `--border-default #dfe4ed`, `--border-strong #b9c0ce`.
- Marke `--brand-primary #245fb0`. Bereiche (nur Akzente): Finanzen `#1e7a4d` · Haushalt `#b8432a` (Coral) · Organisation `#7541b5` · Reisen `#246db8`.
- Status: Erfolg `#1e7a4d` · Warnung `#8a5a00` · Fehler `#b3261e` · Info `#245fb0` — nie nur über Farbe.
- Typo (Instrument Sans, variabel 400–700, selbst gehostet; Gewichte 400/500/600/700): Seite 30 (Handy 24) · Abschnitt 20 · Unterabschnitt 18 · Kennzahl 24 · Titel/Wert 16 · Text 16 · Sekundär/Label/Button 14 · Meta 13 · Caption 12. Zahlen `tabular-nums`.
- Abstände 4 · 8 · 12 · 16 · 24 · 32 · 40 · 48 · 64. Radien 8 · 12 · 16 (+ Pille für Chips). Schatten nur für Overlays.
- Layout: Inhalt max. 1280 px, Ränder 32/24/16; Steuerhöhe 44 px; Fokus 3 px `--brand-primary`, Offset 2 px.

## Regeln
- Schrift überall Instrument Sans (App, Login, Landingpage, Formulare) über `--font-body`/`--font-display`; Datei `public/fonts/instrument-sans` (OFL), vorgeladen, `font-display: swap`. Große Überschriften höchstens −0,025 em Laufweite.
- Öffentliche Startseite (Neugestaltung 15.10.2026, „Der Satz ist die Bühne“): H1 „Dein Alltag. [Zeichen] verbunden.“ — das 4inOne-Zeichen steht für „Alles“ und entfaltet sich beim Laden zu den vier Bereichsfeldern (Markenfarben `#76cda4` · `#efa1c2` · `#ffd175` · `#99c5ff`), danach öffnet sich der echte Startseiten-Screenshot. Weiche Kanten nach dem Zeichen: Radius 28 px mit einer engeren 8-px-Ecke; Knöpfe voll gerundet. Abschnitte: erst Nutzen („Ohne / Mit Verknüpfung“), dann Verknüpfen als „Eine Karte, vier Felder“ (vier Farbfelder, dieselbe App-Karte je einen Schritt weiter, echte Beschriftungen; Handy untereinander), Bereiche als Reiter mit Screenshots, Teilen-Schalter (hell getönt, Finanzen gesperrt), Kombinationsliste eingeklappt, H2 bis 56 px, dunkler Abschluss mit angeschnittenem Namen. Unter 1280 px steht das Logo (2 × 2, Bereichs-Symbole) selbst als Wort vor „verbunden.“; Kopfzeile ≤ 400 px nur „Anmelden“, H1 auch nach Höhe begrenzt (quer). Nur echte Funktionen und Screenshots, keine Eyebrows, Verläufe, Schatten oder Linien; mit reduzierter Bewegung sofort der Endzustand.
- Marke überall `<app-brand>` (vier Farbfelder + „4inOne“), Favicon dieselben vier Felder. Das alte Kompass-Logo/-Name ist entfernt.
- Genau ein aktiver Navigationspunkt; Bottom-Navigation am Handy: Start · Finanzen · Haushalt · Organisation · Reisen.
- Seitenkopf: Titel · Untertitel · Hauptaktion rechts; eine Primary-Aktion je Ansicht.
- Reiter in allen Bereichen gleich: 46 px, 16 px/400, aktiv 600 mit Unterstrich in Bereichsfarbe; Handy 44 px, 13 px, nur Text. Kopf→Inhalt 16 px (Handy 12).
- Seitentitel am Handy überall auf derselben Höhe (auch „Guten Morgen“ auf der Startseite: Abstand zur Kopfzeile wie in den Bereichen).
- Formularfelder (Feld, Auswahl, Datum, Uhrzeit) einheitlich 15 px am Rechner, 16 px am Handy.
- Inaktive Reiter in allen Bereichen `--text-secondary` (kein bereichsgefärbtes Grau); Bereichsfarbe nur aktiv.
- Karten: Radius 16, Rand `--border-subtle`, Innenabstand 20/22 px (Handy 16), kein Schatten. Kartenüberschrift h2 18 px, h3 16 px.
- Buttons: Primär 44 px · Radius 12 · 14 px/600 · Abstand 16; Sekundär gleiche Maße, ebenfalls 600. Filter-Chips und Umschalter 44 px.
- Senden-Knopf in einer Eingabezeile (48-px-Leiste) optisch 40 px, Klickfläche per `::before` 44 px.
- Login/Registrierung: eigenes Split-Layout, aber Titel `--fs-page`, Radien `--radius-md`, `--brand-primary`, `--focus-ring`; Eingaben/Buttons dort bewusst 52 px.
- Personen & Gruppen: Kopf links, grüne Datenschutz-Karte rechts; Reiter hier als umrandete Felder mit Symbol (Übersicht · Gruppen · Geteilte Bereiche, aktiv `--info-soft` + `--brand-primary`); zwei Spalten (Inhalt | Einladen + Häufige Fragen), unter 1100 px untereinander; Breite und Ränder wie die Fachbereiche (1280 zentriert, 32/20/16 px). Zeigt nur Echtes: geteilte Reisen/Haushalte je Person, „Teilen …“ = zu einer kommenden eigenen Reise hinzufügen (Rolle „ansehen“).
- Haushalt › Heute am Rechner: „Heute fällig“ volle Breite, darunter „Demnächst“ | „Einkauf“ nebeneinander; Aufgabenzeilen in festen Spalten (Fälligkeit rechtsbündig, „Heute“ als Text, Überfällig/Hoch als kleine Marken). Am Handy unverändert untereinander.
- Haushalt › Zuhause: Vertragsbeträge sind privat (nur wer sie erfasst hat); andere sehen „Betrag privat“, die Summe zeigt „pro Monat (deine Verträge)“.
- Einladungen (V1): Glocke in der Kopfzeile mit Zahl in `--brand-primary` (kein Alarmrot, Zahl statt Punkt); Popover 380 px, am Handy volle Breite unter der Kopfzeile; je Einladung Symbol des Bereichs, „Sophie hat dich zu „Unser Zuhause“ eingeladen.“, Meta-Zeile, Annehmen (Primär) / Ablehnen (Sekundär), 44 px. Startseite: eine ruhige Zeile „… eingeladen · Ansehen“ über den Bereichen. Personen & Gruppen: Einladungen zu Haushalt/Reise in „Offene Einladungen“, Haushaltsmitglieder unter „Geteilte Bereiche“. Annahmen melden sich bei der einladenden Person als Erfolg mit nächstem Schritt („Etwas teilen“), Ablehnungen nie (nur still „Nicht angenommen“). Kontaktanfragen erscheinen nach einmaliger E-Mail-Bestätigung ebenfalls in Glocke und Startseite; vorher ein ruhiger Hinweis „Mail senden“ (Seite `/email-bestaetigen` wie „Neues Passwort“).
- Passwort vergessen / Neues Passwort: eine zentrierte Karte ohne App-Leisten (`shell: 'bare'`), Button `--brand-primary` mit Radius `--radius-md`; Feldfehler im neuen-Passwort-Formular erst nach dem Absenden.
- Aufgaben-Kästchen überall gleich: 22 px, Radius 8, Rand `#8592a6` (≥ 3:1), Klickfläche 44 px.
- Kleine Bedienelemente dürfen optisch klein sein, ihre Klickfläche reicht aber auf 44 px (unsichtbares `::before`).
- Einzelperson zuerst: Teilen/„gemeinsam“ nur zeigen, wenn wirklich mehrere Personen beteiligt sind.
- Formfehler erst nach dem ersten Speichern; Abbrechen prüft nichts.
- Finanzen: Objekt heißt überall „Transaktion“ — nie „Buchung“ (Suche, Listen, Import, Plus-Menü der Startseite, Meldungen). Begriff „Geplant“ (nie „vorgemerkt“): Budget-Aufschlüsselung Monatsbudget → Bereits ausgegeben → Geplant (Link zur Liste) → Sparbeiträge → Verfügbar; Zeilen „… • ⏱ Geplant“ (Text + Symbol, Betrag ruhiger); Filter Alle/Ausgaben/Einnahmen/Geplant; Kategorie-Budget kompakt: Name + „X € verfügbar“, Balken (geplant heller), „ausgegeben · geplant · von Budget“ (am Rechner eine Zeile) und rechts die Prozentzahl; das Statuswort („Bald erreicht“, „Überschritten“ …) nur, wenn es kritisch wird — im Label immer.
- Verknüpfungen: Abschnitt „Verknüpft mit“ nur in Bearbeiten-Dialogen, Knopf „+ Verknüpfen“, „Verbindung entfernen“ nur wenn erlaubt (löst nur den Zusammenhang, beide Einträge bleiben).
- Vorschläge: kleiner Block „Das könnte zusammengehören“ (gestrichelter Rahmen, kein KI-Look), je Vorschlag Begründung + „Verknüpfen“/„Nicht relevant“ und der Hinweis „Nur ein Vorschlag … geändert wird dabei nichts“; „Für dich“ höchstens einer.
- Abstände nur über `--space-1…9` (4…64 px). Die alten Pixel-Namen `--space-4/8` (4/8 px) gibt es nicht mehr.
- Auswahllisten in Dialogen (z. B. Budgetjahr): Zeilen mit Haarlinien statt Kartenwand, Icons statt Textzeichen, Auswahl = Fläche + Haken + fett.
- Menüs blenden ruhig ein (150 ms, Deckkraft + 4 px). Keine zusätzliche Animations-/UI-Bibliothek.
- Laden: Skelette; Fehler bereichsbezogen mit „Erneut versuchen“; Leerzustände ruhig mit einer Aktion.
- Öffentliche Unterseiten (Rechtliches, Kontakt, Danke, 404): gemeinsamer Rahmen `shared/public-shell` wie die Startseite — Marke + „Anmelden“/„Konto erstellen“ oben, Pflicht-Links unten (15 px, Tippziel ≥ 44 px), keine App-Navigation. Formularfelder 48 px / 17 px, Absenden als Pill 52 px. Sichtbarer Text bleibt Teil des zugänglichen Namens (kein ersetzendes `aria-label`).
- App-Startseite (17.10.2026, „Tagesplan“ — ruhig, erklärbar, handyzuerst): keine Bereichskacheln, keine dunkle Bühne, kein bunter Satz, kein Zeichen vor der Begrüßung und keine Tagesbewegung. Begrüßung (26–34 px, Handy 24) und Tageszeile („4 Punkte heute, 1 überfällig“), „Hinzufügen“ rechts. **Heute** als weiße Karte (Radius 20 mit 8-px-Ecke) in Gruppen Überfällig (rote Schrift + rotes Symbol auf `#fcebea`) · Als Nächstes (dezent `#eef4fd`, Uhrzeit und „in 8 Std.“ in `--brand-primary`) · Später · Ohne Uhrzeit (Zeitspalte leer) · Vorbei. **Eine Zeilen-Form für alles**: Zeit · Bereichs-Symbol 30 px (dasselbe Icon und dieselbe Farbe wie in der Navigation, `--*-accent` auf `--*-soft`, Kontrast ≥ 5,3:1) · Titel/Hinweis (Bereich als erstes Wort, auch am Handy: „Organisation · Praxis Dr. Weber“; keine Doppelungen) · Pfeil. Rechts bzw. darunter im selben Stil: Demnächst (Datum · Reise/Frist), Budget (eine Zahl + 6-px-Balken), Für dich (erklärender Satz + zwei Eintrag-Zeilen mit Bereich · Art + Textlink). Neue Konten: „Erste Schritte“ mit einem Satz, was 4inOne ist, und 3 abhakbaren Zeilen.
- Referenz-Screen: Startseite (`docs/DASHBOARD_V1.md`). Migriert: alle Bereiche (Startseite, Finanzen, Haushalt, Organisation, Reisen).

Reise-Erstellung (11.10.2026): bestehende Kalenderkomponente mit gesperrten Tagen vor heute für den Beginn und vor dem Beginn für das Ende. Eintägige Reisen möglich; vergangene Bestandsreisen bleiben bearbeitbar. Keine neuen Layout-/Farb-Tokens.

Meine Reisen (15.10.2026): Karten nur für „Jetzt unterwegs“ und „Als Nächstes“; weitere bevorstehende Reisen als kompakte Zeilen „Danach“, „Vergangen“ zeigt 3 Zeilen + „Alle N anzeigen“, vergangene ohne To-dos, „Vorbei“ grau. Keine neuen Tokens.

15.10.2026: Mobile Tagesbühne kompakter (Uhrzeit 30 px, überfälliges Datum 22 px, Titel 21 px); nächste anstehende
Uhrzeit vor überfälligem Eintrag. Eine Demo-Verknüpfung im vorhandenen „Für dich“, ausdrücklich lokale Vorschau.
Teilen-Beispiel auf Landingpage kennt Sichtbarkeitszustand; keine neuen Farben/Icons/Navigation.

Handyansicht: Die zusätzliche dekorative Tagesachse entfällt; Uhrzeiten bleiben in den bedienbaren Zeilen. Demo-Dialogaktionen und Objektlinks besitzen mindestens 44 px Höhe und sichtbaren Tastaturfokus.

### Helle Dashboard-Übersicht (15.10.2026)
Ersetzt die dunkle Tagesbühne vollständig: weiße, dezent umrandete Tagesliste mit gleich großen Zeilen und ruhiger Markierung „Im Fokus“. Keine große Datumszahl oder Tagesachse. Priorisierung bleibt erhalten. Demo-Zusammenhang zeigt Sparziel und Aufgabe als zwei beschriftete, direkt erreichbare Objekte mit verbindender Erklärung und separater Aktion. Bestehende Navigation, Icons und Bereichsfarben bleiben bestehen. Diese Entscheidung ersetzt die vorherige Tagesbühnen-Gestaltung.
Bereichsübersicht: kompaktes Viererband vor Heute (mobil 2 × 2), Kontextkarte daneben.
