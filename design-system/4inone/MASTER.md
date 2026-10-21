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

## Aufbau
Kopf (Bereiche · So geht’s · Privatsphäre · Fragen, Anmelden, Konto erstellen) → Hero: „Dein Alltag. Alles
verbunden.“, ein kurzer Satz, zwei gleichwertige Knöpfe („Konto erstellen“, „Ohne Anmeldung ausprobieren“), rechts die
Beispielkette Waschmaschine → Sparziel → Angebote vergleichen → Lieferung mit Lichtlinien und dem Satz „Vom Gerät
direkt zum Sparziel und zur nächsten Aufgabe.“ (jede Verbindung gibt es wirklich; Werte als Beispiel beschriftet) → Vier Bereiche:
Karten verschiedener Größe (Finanzen/Reisen breit mit echtem Screenshot), je Versprechen, drei Funktionen, ein
echter Wert „Beispiel aus der Demo“, Link in die Demo → So einfach geht’s: drei Schritte (kräftige Ziffern)
(Demo zuerst) neben der echten App-Startseite → Verbunden. Nicht geteilt. (dunkel): Sparziel ↔ Waschmaschine mit Lichtlinie,
Schalter „wer sieht was“ (Finanzen gesperrt) → Häufige Fragen (mit Weg zur Demo) → Kachel-Fuß (global, Farben per
`--tf-*`; Links Impressum · Datenschutz · Nutzungsbedingungen · Barrierefreiheit). Kein Kontaktbereich.

## Anmeldung / Registrierung
Split: links Warmweiß mit Überschrift, Satz und `app-link-chain`; rechts Formular auf Weiß. Felder 52 px, Radius 12,
Rand `#948C7E`, Fokus Tinte; Hauptknopf Tinte, Zweitweg mit Tintenrand. ≤ 760 px nur das Formular.

## Unterseiten
Gleicher Kopf, kräftiger Titel bis 64 px, Abschnitte mit feiner Linie (`--line`) und kräftiger H2, Text in
`--ink-soft` 17 px, Lesespalte 720 px; Platzhalter-Hinweis in Amber-Tönung; kompakter Kachel-Fuß.

## Karten
Radius 16, Rand ODER Schatten; Lichtkegel unter der Maus in der Bereichsfarbe (`appSpotlight`, nur Maus); Hover
−4 px + größerer Schatten. Keine gleich großen Icon-Karten als Seitengerüst.

## Bewegung
Ein großer Moment: Lichtimpulse laufen die Beispielkette entlang (`app-animated-beam`, 2,4 s, versetzt).
Hero-Text klärt sich aus Unschärfe (Blur Fade, 0,8 s, gestaffelt 90 ms), Kettenglieder steigen nacheinander ein; Abschnitte steigen
einmal gestaffelt ein. Reduzierte Bewegung / ohne JS: alles sofort sichtbar, nur ruhende Linien.

## Globale Bausteine (frontend/src/app/shared)
- `appSpotlight` — setzt `--spot-x/-y/-o` unter dem Mauszeiger; Aussehen bestimmt das Element.
- `app-animated-beam` — `[container] [from] [to] color curvature delay duration reverse`; SVG hinter den
  Elementen, Neuberechnung per ResizeObserver, `--beam-base` für die ruhende Linie.
- `app-tile-footer` — `variant="full|compact"`, Farben/Schrift über `--tf-*`.
- `app-link-chain` — Beispielkette (`heading`, `caption`, `links`); Startseite und Anmeldung. Bereichsfarben per
  Mixin `editorial.area-tones`.
- `app-area-deck` — Fächer (derzeit nicht auf `/`, bleibt für App/Onboarding verfügbar).

## Nicht tun
Erfundene Stimmen, Bewertungen, Zahlen, Preise („kostenlos“); Kursive; Serifen-Mix; schwebende Karten um ein Logo;
Eyebrows; Verlaufs-Text; Glas als Deko; farbige
Seitenränder an Karten; mehr als ein dunkler Abschnitt; Icons auf Amber in Weiß.
