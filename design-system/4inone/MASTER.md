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
→ „Privat ist die Grundeinstellung.“ als Faktenliste → Häufige Fragen → Abschluss-Band in Tinte → Kachel-Fuß.
Nie: Unschärfe-Einblendung, Satzfetzen-Paare („X. Y.“) als Überschriften, Häkchen-Listen, 1-2-3-Schritte.

## Anmeldung / Registrierung
Split: links Warmweiß mit Überschrift, Satz und `app-link-chain`; rechts Formular auf Weiß. Felder 52 px, Radius 12,
Rand `#948C7E`, Fokus Tinte; Hauptknopf Tinte, Zweitweg mit Tintenrand. ≤ 760 px nur das Formular.

## App (Dashboard, Rahmen)
Gleiche Tokens wie die Website über `styles.css`: warmweißer Grund, Tinte als Hauptfarbe, Bereichs-Farbfelder
(`--*-fill`/`--*-on`). Dashboard „Kommandozentrale“: große Begrüßung, Überblick-Band mit vier Kacheln (Heute,
Budget, Reise, Haushalt), Tagesplan mit Farbfeldern, rechts Für dich und Letzte Buchungen.
Kopfzeile ohne Suche, deckend. Tableiste und Seitenleiste: aktiver Eintrag als Farbfeld.

## Unterseiten
Gleicher Kopf, kräftiger Titel bis 64 px, Abschnitte mit feiner Linie (`--line`) und kräftiger H2, Text in
`--ink-soft` 17 px, Lesespalte 720 px; Platzhalter-Hinweis in Amber-Tönung; kompakter Kachel-Fuß.

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
- `app-tile-footer` — `variant="full|compact"`, Farben/Schrift über `--tf-*`.
- `app-animated-beam [iterations]` — `'infinite'` (Website) oder feste Zahl (App: 3, dann Ruhe).
- `app-link-chain` — Beispielkette (`heading`, `caption`, `links`); Startseite und Anmeldung. Bereichsfarben per
  Mixin `editorial.area-tones`.
- `app-area-deck` — Fächer (derzeit nicht auf `/`, bleibt für App/Onboarding verfügbar).

## Nicht tun
Erfundene Stimmen, Bewertungen, Zahlen, Preise („kostenlos“); Kursive; Serifen-Mix; schwebende Karten um ein Logo;
Eyebrows; Verlaufs-Text; Glas als Deko; farbige
Seitenränder an Karten; mehr als ein dunkler Abschnitt; Icons auf Amber in Weiß.
