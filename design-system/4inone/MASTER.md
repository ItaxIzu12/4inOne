# 4inOne — Designsystem öffentliche Seiten (MASTER, Stand 21.10.2026)

Richtung **„Editorial hell“** (vom Nutzer gewählt aus drei Vorschlägen: Editorial hell · Dunkel & präzise · Swiss
Raster). Erarbeitet mit `ui-taste` (Richtungswahl, Designvertrag), `ui-ux-pro-max` (Typo-/Stil-/UX-Leitlinien),
`magic-ui` (Muster Magic Card, Animated Beam, Blur Fade — nach Angular übertragen, keine React-Pakete) und
`impeccable` (Qualitätsuntergrenze). Gilt für `/` (features/landing) und die Unterseiten im Rahmen `shared/public-shell` (Impressum, Datenschutz,
Nutzungsbedingungen, Barrierefreiheit, 404). Tokens: `shared/styles/_editorial.scss` (Mixins
`tokens`, `display`). Die App behält ihr System (DESIGN.md); das Logo nutzt überall die vier Bereichsfarben.

## Zweck
Überzeugen und erklären: In Sekunden verstehen, dass 4inOne eine App für Finanzen, Haushalt, Termine und Reisen ist,
die verknüpft, was zusammengehört, und privat bleibt — dann Konto erstellen oder Demo ansehen.

## Farben
| Rolle | Wert | Hinweis |
|---|---|---|
| Grund | `#FAF8F4` · Tönung `#F2EEE6` | warmweiß |
| Karte | `#FFFFFF` | Rand `#E6E0D4` oder Schatten, nie beides |
| Tinte | `#121826` | Text gedämpft `#4A5263` (7,4:1) |
| Finanzen | Fläche `#0F9D6B` · Text `#0B6E4B` (6,3:1) · Tönung `#E4F4EC` | Symbol auf Fläche weiß |
| Haushalt | `#E04F78` · `#A8325A` (6,4:1) · `#FCE8EE` | Symbol weiß |
| Organisation | `#E3961A` · `#8A5800` (6,0:1) · `#FCEFD9` | Symbol in Tinte (Weiß nur 2,4:1) |
| Reisen | `#3B6FE0` · `#2453B4` (7,1:1) · `#E7EDFB` | Symbol weiß |
Die vier Flächenfarben haben ähnliche Helligkeit und Sättigung (einheitlich). Ein dunkler Moment: Privatsphäre auf
Tinte (Text `#C9CFDB`, 11:1).

## Schrift
**Schibsted Grotesk** für alles (Google Font, OFL, variabel 400–900, selbst gehostet `public/fonts/schibsted-grotesk`,
global über `--font-body`/`--font-display`). Überschriften 700, −0,03 em (H1 clamp(42–80 px), H2 clamp(34–56 px)),
Text 17 px, Lead 18–21 px. **Keine Kursive** (nutzergewünscht: wirkt generiert) — `font-synthesis-style: none`.

## Aufbau (22.10.2026, „Produkt im Mittelpunkt“)
Kopf (Ausprobieren · Bereiche · Privatsphäre · Fragen, Anmelden, Konto erstellen) → Hero zentriert: „Dein ganzer Alltag
auf einer Startseite.“, ein Satz, „Konto erstellen“ + „Ohne Anmeldung ausprobieren“, Hinweis „Läuft im Browser …“ →
Bühne: echtes Dashboard im Passepartout, Handy davor (am Handy nur das Handy) → Aussage-Absatz (erster Satz Tinte,
Rest gedämpft) → „Probier aus, was 4inOne verbindet.“ (Verknüpfungs-Probe: Beispiel wählen, Vorschläge mit Grund
verknüpfen, Lichtlinie, „bewusst nicht vorgeschlagen“) → Bereiche als Umschalter mit echtem Screenshot
→ „Privat ist die Grundeinstellung.“ als Faktenliste → Häufige Fragen → Abschluss-Band (einziger Abschluss) → klassischer Fuß (Marke, Spalten Bereiche/Produkt/Rechtliches, ©-Leiste).
Nie: Unschärfe-Einblendung, Satzfetzen-Paare („X. Y.“) als Überschriften, Häkchen-Listen, 1-2-3-Schritte.

## Anmeldung / Registrierung
Split: links Warmweiß mit Überschrift, Satz und `app-link-chain`; rechts Formular auf Weiß. Felder 52 px, Radius 12,
Rand `#948C7E`, Fokus Tinte; Hauptknopf Tinte, Zweitweg mit Tintenrand. ≤ 760 px nur das Formular.

## App (Dashboard, Rahmen)
Gleiche Tokens wie die Website über `styles.css`: warmweißer Grund, Tinte als Hauptfarbe, Bereichs-Farbfelder
(`--*-fill`/`--*-on`). Dashboard (27.10.2026): große Begrüßung, „Heute“ als Zeitleiste | Finanzen-Karte (noch
verfügbar, Tagessatz, Ausgabenkurve, letzte Transaktionen), darunter Für dich | Demnächst (Reise, Haushalt). Finanzen
› Übersicht wie eine Banking-App: eine große Zahl, drei ruhige Werte, abfahrbare Ausgabenkurve, Transaktionen nach
Tagen. Diagramme selbst gezeichnet (SVG), ohne Verläufe. Alle Finanz-Ansichten (Zeiträume, Transaktionen, Budgets,
Sparziele) folgen derselben Kopfkarte, Steuerzeile (Segment + Datum) und Tagesliste (`finanzen/_fin-look.scss`).
Erklären statt voraussetzen: Startliste für neue Konten, „Wie entsteht diese Zahl?“, (i)-Begriffe, am Monatsanfang
ein Rückblick auf den Vormonat (ausblendbar) und unter Ausgaben die Fixkosten mit Jahressumme — nur echte Werte.
Budgets › „Dein Jahr“: große Zahl, Urteil, zwölf Säulen in einer Reihe (Tönung = Budget, Füllung = Ausgaben, grün gehalten / rot überschritten), antippbar.
Haushalt: „Dein Zuhause, Raum für Raum“ — Kopfkarte in der Haushaltsfarbe (einzige Bereichsfläche), Räume nach Dringlichkeit, Aufgaben nach Tag/Raum/Person, ruhiger Erledigt-Moment; Einkaufen wahlweise als Kacheln; Zuhause mit Zeitleiste „Als Nächstes“ und Geräten nach Raum.
Organisation: „Dein Tag, Stunde für Stunde“ — neuer Startreiter Heute mit Kopfkarte in der Organisationsfarbe (einzige Bereichsfläche), Tageslinie mit freier Zeit zum Antippen, Aufgaben heute und angeheftete Notiz; Kalender mit Kategoriefarben, Legende und Woche als Handy-Start; Aufgaben nach Tag/Projekt mit Erledigt-Moment; Notizen als Zettelwand mit „Schnell notieren“.
Reisen: „Von hier nach dort“ — Bordkarte in der Reisefarbe (einzige Bereichsfläche: Abreise → Ziel, Tage bis zur Abreise, gezählte Vorbereitung), weitere Reisen als Karten mit Kalenderblatt; Planung als Countdown-Linie mit Abreise-Marke, Packliste mit Kategorie-Ringen, Budget mit „Noch übrig“ groß und gestapeltem Balken; Dialoge mit Live-Bordkarte und Chips.
Verknüpfungen: sichtbar statt versteckt — kleine Marken in der Bereichsfarbe am Eintrag („✈ Berlin Wochenende“) und „Gehört zu dieser Reise“ in der Reise-Übersicht; nichts wird automatisch verknüpft.
Startseite: „Vier Antworten“ — je Bereich die eine Antwort in seiner Handschrift (heute ausgegeben, Aufgaben heute, als Nächstes + freie Zeit, Tage bis zur Reise), darunter Dein Tag, Finanzen, Dein Fortschritt (ehrliche Ringe) mit Idee für heute und die Bordkarte der nächsten Reise.
Abnahme (31.10.2026): Zahlen und Balken haben immer eine ausgesprochene Bedeutung (kein „Vorbereitet“ aus gemischten Größen, keine unbeschrifteten Balken), Zeitlücken heißen „ohne Termin“ statt „frei“, Monatssummen „bis heute im Oktober“.
Personen & Gruppen: „Dein Kreis“ — dunkle Kopfkarte mit Gesichtern, gezählten Fakten und dem Versprechen in einer Zeile; Geteiltes als Marken in Bereichsfarbe. Einstellungen: Seitennavigation am Rechner, Kontoschutz als ehrliche Liste, durchgängig Tinte statt Blau.
Gemeinsame Kalender: Termine wahlweise „Nur ich“ oder in einem gemeinsamen Kalender (Familie, WG); Private bleiben für andere völlig unsichtbar; Filter Alle · Nur meine · je Kalender; Marken „Familie · von Max“.
Kalenderfreigabe wie Outlook: eigener Kalender für Personen freigebbar (ansehen/bearbeiten, nach Annehmen); neue Termine privat; „Wer sieht den Termin?“ mit Nur ich · Gruppe · Personen; Filter „Kalender von …“.
Dialoge: langer Inhalt scrollt im Dialog, Schließen bleibt stehen.
Notizen: Fotos & PDF anhängen (Test), Vorschau auf der Karte, Fotos ohne Standortdaten.
Geräte/Verträge: Fotos & PDF beim Anlegen und Bearbeiten, Haushaltsfarbe; löschen nur Hochladende oder Admins.
Termin-Dialog: „Ganztägig“ als Schalter-Zeile; „Ganztägig“ in Listen nicht fett.
Haushalt: Avatare im Kopf → „Wer ist dabei?“; Dialoge nennen, wer den Eintrag sieht.
Rückmeldungen: helle Karte mit Symbol, × und Zeitleiste; oben in der Mitte (Handy volle Breite); ~5 s, pausiert unter dem Zeiger.
Dialog-Knöpfe immer mit Symbol: × Abbrechen, ✓ Speichern, Papierkorb Löschen.
Ort-Felder schlagen Orte vor (eigene + OpenStreetMap über den Server); Freitext bleibt möglich.
Verbindungen V2: „Mit anderen Bereichen verbinden“ mit Schalter, Vorschau und Status in den Dialogen; abgeleitete Einträge mit Herkunftsmarke.
Tagesblatt: Tag mit Terminen anklicken → Liste des Tages + „Termin an diesem Tag“, nach dem Speichern zurück; leere Tage direkt neu; Woche mit „+“-Fläche je Spalte.
Kopfzeile ohne Suche, deckend. Tableiste und Seitenleiste: aktiver Eintrag als Farbfeld.

## Unterseiten (Rechtliches, 404)
Gleicher Kopf mit feiner Linie. Rechtsseiten: links Navigation „Rechtliche Seiten“, rechts der Text auf einem weißen
Blatt (Radius 28), H1/H2 650, Lesespalte 68 ch, Platzhalter-Hinweis in Ocker-Tönung; am Handy die Navigation als
wischbare Pillen. Fuß kompakt: Marke + Rechtliches (aktuelle Seite markiert) + ©-Leiste.

## Karten
Radius 16, Rand ODER Schatten; Lichtkegel unter der Maus in der Bereichsfarbe (`appSpotlight`, nur Maus); Hover
−4 px + größerer Schatten. Keine gleich großen Icon-Karten als Seitengerüst.

## Bewegung
Bewegung sparsam: das Produktbild setzt sich beim Laden (nur transform); Lichtimpulse laufen die Beispielkette entlang.
Inhalte sind nie versteckt (keine Einblend-Effekte). Reduzierte Bewegung: keine Bewegung, nur ruhende Linien.

## Globale Bausteine (frontend/src/app/shared)
- `appSpotlight` — setzt `--spot-x/-y/-o` unter dem Mauszeiger; Aussehen bestimmt das Element.
- `app-animated-beam` — `[container] [from] [to] color curvature delay duration reverse`; SVG hinter den
  Elementen, Neuberechnung per ResizeObserver, `--beam-base` für die ruhende Linie.
- `app-tile-footer` — klassischer Fuß, `variant="full|compact"`, Farben über `--tf-*` (von der Seite geerbt).
- `app-animated-beam [iterations]` — `'infinite'` (Website) oder feste Zahl (App: 3, dann Ruhe).
- `app-link-chain` — Beispielkette (`heading`, `caption`, `links`); Startseite und Anmeldung. Bereichsfarben per
  Mixin `editorial.area-tones`.
- `app-area-deck` — Fächer (derzeit nicht auf `/`, bleibt für App/Onboarding verfügbar).

## Nicht tun
Erfundene Stimmen, Bewertungen, Zahlen, Preise („kostenlos“); Kursive; Serifen-Mix; schwebende Karten um ein Logo;
Eyebrows; Verlaufs-Text; Glas als Deko; farbige
Seitenränder an Karten; mehr als ein dunkler Abschnitt; Icons auf Amber in Weiß.

## Farbidentität „Soft Editorial“ (22.10.2026)
Porcelain `#F7F7F4` · Weiß · Sage `#ECEFEA` · Deep Forest `#172523` · Linien `#DDE1DA` · Sekundärtext `#52615B` ·
Akzent Evergreen `#17694F`. Bereiche gedeckt (`#17694F`, `#AB445F` (Fläche und Text), `#9A641E`/Text `#85561A`,
`#3D6B9A`) nur für Symbole, Balken, Labels, kleine Flächen; Logo behält seine Farben. Landing: Hero Porcelain,
Bereiche Weiß, Verknüpfen Deep Forest, Privatsphäre Sage, Fragen Weiß, Abschluss Deep Forest, Fuß Porcelain.
Schrift bleibt Schibsted Grotesk; Website-Überschriften 650. Landing-H1 bis 60 px, am Handy fließend 27–32 px (immer 4 Zeilen). Hover nur auf Klickbarem, nur am Rechner und bei Tastatur-Fokus gleich: Pfeil rückt 4 px vor, Tab-Fläche gleitet, Vorschau gestrichelt. Scroll-Einblenden nur für H2 und Bild je Abschnitt (12 px, scroll-gebunden, CSS `view()`), nie Fließtext oder Hero. Karten 20–28 px, Schatten sehr zurückhaltend.


Formulare: Zahl + Einheit (z. B. Kündigungsfrist „3 · Monate“) als zwei gleich breite Felder in einer Zeile, auch am Handy; Einheit als `app-select`, unten bündig (02.11.2026).
Abgeleitete Felder (z. B. „Nächste Wartung“ aus letzter Wartung + Intervall) werden live vorausgefüllt, bleiben änderbar und tragen einen Hinweis, woher der Wert kommt (02.11.2026).
Bewertungsfragen (z. B. Beta-Feedback): 44-px-Umschalter mit `aria-pressed` statt Sterne oder Schieberegler; gewählt = Tinte gefüllt, erneut antippen = abwählen (04.11.2026).
