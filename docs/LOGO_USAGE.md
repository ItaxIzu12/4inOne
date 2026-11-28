# Lumiknot — Logo

> Teil der Brand Governance (`docs/BRAND_GOVERNANCE.md`): verbindlich für Bildmarke, Wortmarke, Logo-Varianten und die Logo-Komponente.

Stand 28.11.2026. Vorlage: `docs/brand/lumiknot-orbit-reference.webp` (nur Referenz, nie in der App verwenden).
Übersicht aller Varianten: `docs/brand/lumiknot-logo-overview.png`; Größen- und Hintergrundprüfung:
`docs/brand/lumiknot-logo-qa.png`. Markenstrategie: `docs/BRAND_IDENTITY.md`, Farben und Schrift:
`docs/BRAND_GUIDELINES.md`.

> **Rechtlicher Vorbehalt:** Die Orbit-Bildmarke und der Name sind nicht eingetragen und nicht auf Einzigartigkeit
> geprüft. Kein ®, kein ™ als Anspruch, keine Aussage „geschützt“ oder „einzigartig“, bis eine Prüfung vorliegt
> (`docs/BRAND_GUIDELINES.md` › Namensprüfung).

## 1. Konstruktion

Das **Orbit-Zeichen** besteht aus vier gleichen, abgerundeten Elementen, die sich verschlingen. Jedes Element ist
dieselbe Konstruktion, um 90° gedreht (`frontend/src/app/shared/ui/brand/orbit.ts`, einzige Quelle der Geometrie):

1. kurze Zuleitung mit runder Kappe,
2. 135°-Bogen um den äußeren Ring (Radius 108, echter Kreisbogen statt freier Bézierkurve – dadurch exakt gleich
   in allen vier Elementen),
3. Diagonale – eine Seite der Raute in der Mitte; sie endet auf dem Ring des nächsten Elements und liegt darunter.

| Maß | Wert (Einheiten) | Hinweis |
|---|---|---|
| Zeichenfläche | 452 × 452 (Mitte 0/0, Ausdehnung ±226) | Kleinvariante ±234 |
| Strichstärke | 68 (≈ 15 % der Breite) | Kleinvariante 84 |
| Ring-Radius | 108 | Mittellinie des Strichs |
| Enden | rund (`stroke-linecap: round`) | |
| Drehrichtung | im Uhrzeigersinn | Bewegung von links oben nach rechts |
| Überlagerung | Zeichenreihenfolge Finanzen → Haushalt → Organisation → Reisen | Reisen liegt oben; Finanzen beginnt bei y = 84 unter Reisen |

| Element | Farbe | Bereich | Lage |
|---|---|---|---|
| 1 | Grün `#13A274` | Finanzen | oben links |
| 2 | Orange `#F59A42` | Haushalt | oben rechts |
| 3 | Violett `#7864E7` | Organisation | unten rechts |
| 4 | Blau `#2197BE` | Reisen | unten links, liegt oben |

Die freie Raute in der Mitte steht für die Verbindung aller Bereiche. Gegenüber der Vorlage sind Kurven, Strichstärke
und Abstände geometrisch vereinheitlicht; Silhouette, Drehrichtung, Vierteilung und Überlagerungen bleiben. Die
Vorlage hat Verläufe und Licht; das **flache** Zeichen ist die Hauptvariante.

## 2. Wortmarke

- **Manrope 700**, Laufweite −0,032 em (−5 bei 156), Midnight `#101820` bzw. Weiß auf dunklem Grund.
- Im Lockup: Zeichenhöhe = 1,41 × Schriftgröße, Abstand Zeichen–Name 24 Einheiten bei 220er-Zeichen (≈ 0,11 ×
  Zeichenhöhe), Grundlinie auf 73 % der Zeichenhöhe.
- Claim *Life, connected.* in Manrope 500, gesperrt (+0,24 em horizontal, +0,15 em vertikal), nie größer als ¼ der
  Namenshöhe.
- **Geprüfte Anpassungen (28.11.2026):** Manrope ist geometrisch ausgewogen; die Buchstabenfolge „Lumiknot“ hat
  keine Unterlängen und keine Problempaare, die eine Unterschneidung von Hand erfordern. Die negative Laufweite
  schließt die Lücken bei Fettsatz. Eigene Glyphenformen (z. B. ein Orbit-Punkt auf dem i oder ein verbundenes
  „kn“) wären möglich, sind aber **nicht umgesetzt** – sie machen die Wortmarke schwerer lesbar und brauchen eine
  eigene Freigabe.
- Die Dateien betten Manrope ein und setzen Farbe und Schrift als Attribute, damit eingebettete SVGs nichts auf die
  Seite übertragen. Für Druckdaten Text in Pfade umwandeln (siehe 7).

## 3. Schutzraum

- Rund um Zeichen und Lockups mindestens **¼ der Zeichenhöhe** frei (bei 40 px Zeichen: 10 px).
- In diesem Raum keine Texte, Kanten, Linien oder anderen Logos. Fotos nur, wenn der Bereich ruhig ist.
- Der Schutzraum ist in `docs/brand/lumiknot-logo-overview.png` gestrichelt gezeigt.

## 4. Mindestgrößen

| Variante | Bildschirm | Druck |
|---|---|---|
| Zeichen, Standard (Strich 68) | 24 px (so nutzt es `<app-brand>` in Kopf- und Seitenleiste) | 8 mm |
| Zeichen, Kleinvariante (Strich 84) | 16 px (für 16–23 px) | 5 mm |
| Lockup horizontal | 96 px breit | 25 mm |
| Lockup vertikal | 72 px breit | 20 mm |
| Wortmarke allein | 64 px breit | 18 mm |
| Mit Claim | 160 px breit (darunter ohne Claim) | 40 mm |

**Größenprüfung (28.11.2026, `docs/brand/lumiknot-logo-qa.png`):** 16, 24, 32, 48, 64, 128, 256 und 512 px auf Ivory,
Weiß und Midnight sowie einfarbig. Ab 48 px sind alle vier Elemente, die Überlagerungen und die Raute klar. Bei
16–32 px ist die Kleinvariante deutlich besser: Die Raute bleibt offen und die Farben laufen weniger ineinander;
darum nutzen Favicon und `favicon.ico` sie. Bei 16 px sind die Überlagerungen nur noch angedeutet – erkennbar bleiben
Silhouette, Vierfarbigkeit und die offene Mitte. Einfarbig sind unter 24 px die Lücken an den Überlagerungen nicht mehr
sichtbar; dort lieber farbig.

## 5. Varianten

Alle Dateien erzeugt `npm run brand:assets` (`frontend/scripts/brand-assets.mts`) aus `orbit.ts` und
`brand.config.ts` – nie von Hand bearbeiten. SVG ist die verbindliche Quelle; alle PNG/ICO entstehen daraus.

| Variante | Datei | Verwendung |
|---|---|---|
| Primär (horizontal, flach) | `public/brand/lumiknot-lockup-horizontal.svg` | Standard überall, wo Platz ist |
| Horizontal hell | `public/brand/lumiknot-lockup-horizontal-light.svg` | auf Midnight und dunklen Fotos |
| Mit Claim | `public/brand/lumiknot-lockup-claim.svg` | Markenauftritte, Präsentationen |
| Vertikal | `public/brand/lumiknot-lockup-vertical.svg` | quadratische Flächen, Titelseiten (mit Claim) |
| Nur Wortmarke | `public/brand/lumiknot-wordmark.svg`, `…-wordmark-light.svg` | wo das Zeichen schon in der Nähe steht oder sehr wenig Höhe ist |
| Nur Zeichen | `public/brand/lumiknot-symbol.svg` | Avatare, kleine Flächen, wenn der Name daneben steht |
| Einfarbig dunkel | `public/brand/lumiknot-symbol-mono-dark.svg` | Druck einfarbig, Prägung, helle Flächen |
| Einfarbig hell | `public/brand/lumiknot-symbol-mono-light.svg` | dunkle Flächen ohne Farbe |
| Favicon | `public/favicon.svg`, `public/favicon.ico` (16/32/48) | Browser; Kleinvariante mit Strich 84 |
| App-Icon / PWA | `public/icon-512.png`, `public/icon-192.png` | PWA, Stores (Zeichen 72 % auf Ivory) |
| Apple Touch | `public/apple-touch-icon.png` (180) | iOS-Startbildschirm (Zeichen 70 %) |
| Maskable | `public/icon-maskable-512.png` | Android (Zeichen 60 %, sicher im Kreis) |
| Teilen-Bild | `public/og-image.png` (1200 × 630) | Open Graph |

Nach jeder Änderung an den Dateien die Version `?v=` erhöhen – in `src/index.html` (Icons, `og:image`) und
`public/manifest.webmanifest` –, damit Browser, installierte Apps und Messenger nicht das alte Bild behalten.

In Angular immer `<app-brand>` statt einer Bilddatei: es zeichnet das Zeichen inline (scharf, ohne Anfrage), nutzt
Manrope und kennt den Bereichskontext.

**Optional (nicht erstellt):** eine räumliche Darstellung mit leichter Tiefe wie in der Vorlage, nur für ausgewählte
Markenpräsentationen, nie in der App oder als Icon. Erst auf Anfrage.

## 6. Logo-Komponente `<app-brand>` – erlaubte Zustände

Die App zeigt das Logo **nur** über `<app-brand>` (`shared/ui/brand/brand.ts`). Sie zeichnet aus derselben Geometrie
(`orbit.ts`) und denselben Farben (`brand.config.ts`) wie der Datei-Generator – es gibt keine zweite SVG-Geometrie.

| Eingabe | Werte | Standard | Wann |
|---|---|---|---|
| `context` | `global` · `finance` · `household` · `organization` · `travel` | `global` | Bereich hervorheben (App-Shell setzt ihn aus der URL) |
| `layout` | `horizontal` · `vertical` · `symbol` · `wordmark` | `horizontal` | Kopfzeilen / quadratische Flächen / schmale Leisten, Avatare / wo das Zeichen schon steht |
| `claim` | `true` · `false` | `false` | „Life, connected.“ unter dem Namen (Markenauftritte, vertikal) |
| `tone` | `color` · `mono` | `color` | einfarbig auf unruhigem Grund, Druckähnliches; Lücken an den Überlagerungen |
| `surface` | `auto` · `light` · `dark` | `auto` | `auto` erbt die Textfarbe; `dark` = Weiß auf Midnight-Bändern |
| `motion` | `static` · `animated` | `static` | `animated` nur für Start-Momente (einmal zeichnen, ≈ 0,7 s) |
| `size` | Zahl (px Zeichenhöhe) | Schriftgröße × 1,3 | unter 24 px automatisch Kleinvariante (Strich 84) |
| `wordmark` | `true` · `false` | `true` | älter; `false` = `layout="symbol"` |

**Bereichskontext:** Das passende Element bleibt voll, die anderen gehen auf 42 % Deckkraft. Form, Farben und
Reihenfolge ändern sich nie. Die Hauptnavigation zeigt immer alle vier Elemente (`docs/SECTION_IDENTITY.md`).

**Bewegung:** Bereichswechsel 240 ms nur über Deckkraft; `motion="animated"` zeichnet die Elemente einmal nacheinander
und blendet den Namen ein. Keine Rotation, kein Pulsieren, keine Dauerbewegung; bei `prefers-reduced-motion` sofort
der Endzustand (`docs/MOTION_GUIDELINES.md`).

**Barrierefreiheit:** Mit sichtbarem Namen ist das Zeichen dekorativ (`aria-hidden`), der Link drumherum heißt
„Lumiknot – Startseite“ (`BRAND.a11y.homeLink`). Bei `layout="symbol"` trägt das Zeichen `role="img"` und
`aria-label="Lumiknot"`.

**Einsatz (28.11.2026):** App-Shell (Seitenleiste, Handy-Kopf: `context` aus der URL), öffentliche Kopf- und
Fußzeilen, Anmeldung (dunkles Band `surface="dark"`, Abschluss `motion="animated"`), Passwort-/E-Mail-Seiten,
Onboarding, Offline-Seite.

## 7. Exportvorgaben

| Format | Quelle | Regeln |
|---|---|---|
| SVG (Bildschirm) | `public/brand/*.svg` | `viewBox` ohne feste Größe, Titel und `aria-label` enthalten, Manrope eingebettet (Lockups ≈ 33 KB, Zeichen < 3 KB) |
| PNG (Icons) | aus SVG über Playwright/Chromium, 1×, sRGB | Hintergrund Ivory `#F7F6F2`, außer Favicon (transparent) |
| ICO | 16/32/48 als PNG-Einträge | Kleinvariante |
| Druck | SVG → PDF/EPS mit Text in Pfaden | Farben in CMYK/Pantone von einer Druckerei abstimmen lassen (Werte unten sind Bildschirmwerte) |

Neue Größen immer aus dem Generator ergänzen, nie aus einem PNG skalieren.

## 8. Farben

| Rolle | Hex | RGB | Verwendung |
|---|---|---|---|
| Finanzen | `#13A274` | 19 162 116 | Element 1 |
| Haushalt | `#F59A42` | 245 154 66 | Element 2 |
| Organisation | `#7864E7` | 120 100 231 | Element 3 |
| Reisen | `#2197BE` | 33 151 190 | Element 4 |
| Midnight | `#101820` | 16 24 32 | Wortmarke, einfarbig dunkel, dunkler Grund |
| Ivory | `#F7F6F2` | 247 246 242 | Icon-Hintergrund, heller Grund |
| Weiß | `#FFFFFF` | 255 255 255 | Wortmarke hell, einfarbig hell |

Die Logo-Farben sind **nie Textfarbe** (Kontrast auf Weiß 2,2–4,4:1); für Text gibt es die Varianten in
`docs/BRAND_GUIDELINES.md` › Farben. `npm run check:brand` prüft, dass `--logo-*` in `styles.css` diesen Werten
entspricht.

## 9. Richtige Verwendung

- Auf Ivory, Weiß oder Midnight; auf Fotos nur mit ruhiger Fläche, sonst einfarbig.
- Unter 24 px die Kleinvariante und farbig statt einfarbig.
- Zeichen und Name immer im festen Verhältnis der Lockup-Dateien.
- In der App ausschließlich `<app-brand>`; in Dokumenten und Präsentationen die SVG-Dateien.

## 10. Falsche Verwendung

- Verzerren, stauchen, drehen oder spiegeln.
- Einzelne Elemente umfärben, vertauschen, weglassen oder die Überlagerungen ändern (Ausnahme: die dezente
  Hervorhebung über `context`).
- Verläufe, Schatten, Neon, Glanz, Konturen, 3D-Effekte im Primärlogo.
- Den Namen in einer anderen Schrift, in Großbuchstaben oder mit anderer Laufweite setzen.
- Das Zeichen in einen Rahmen, Kreis oder eine Form setzen (außer den erzeugten App-Icons).
- Auf unruhigem Grund ohne einfarbige Variante, auf Bereichsfarben als Grund.
- ®- oder ™-Zeichen, Zusätze wie „by …“ direkt am Logo.
- Logo aus einem Screenshot oder PNG nachbauen statt die Quelldateien zu nutzen.
