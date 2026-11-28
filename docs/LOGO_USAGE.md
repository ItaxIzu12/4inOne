# Lumiknot — Logo

Stand 28.11.2026. Vorlage: `docs/brand/lumiknot-orbit-reference.webp` (nur Referenz, nie in der App verwenden).

## Aufbau

Das **Orbit-Zeichen** besteht aus vier gleichen, abgerundeten Elementen, die sich verschlingen. Jedes Element ist
dieselbe Konstruktion, um 90° gedreht (`frontend/src/app/shared/ui/brand/orbit.ts`):

1. kurze Zuleitung mit runder Kappe,
2. 135°-Bogen um den äußeren Ring (Radius 108),
3. Diagonale – eine Seite der Raute in der Mitte; sie endet auf dem Ring des nächsten Elements und liegt darunter.

| Element | Farbe | Bereich | Lage |
|---|---|---|---|
| 1 | Grün `#13A274` | Finanzen | oben links |
| 2 | Orange `#F59A42` | Haushalt | oben rechts |
| 3 | Violett `#7864E7` | Organisation | unten rechts |
| 4 | Blau `#2197BE` | Reisen | unten links, liegt oben |

Die freie Raute in der Mitte steht für die Verbindung aller Bereiche. Gegenüber der Vorlage sind Kurven, Strichstärke
(68 von 452) und Abstände geometrisch vereinheitlicht; Silhouette, Drehrichtung, Vierteilung und Überlagerungen
bleiben. Die Vorlage hat Verläufe und Licht; das **flache** Zeichen ist die Hauptvariante.

## Varianten

Alle Dateien erzeugt `npm run brand:assets` (`frontend/scripts/brand-assets.mts`) – nicht von Hand bearbeiten.

| Variante | Datei | Verwendung |
|---|---|---|
| Primär (horizontal) | `public/brand/lumiknot-lockup-horizontal.svg` | Standard überall, wo Platz ist |
| Horizontal hell | `public/brand/lumiknot-lockup-horizontal-light.svg` | auf Midnight und dunklen Fotos |
| Mit Claim | `public/brand/lumiknot-lockup-claim.svg` | Markenauftritte, Präsentationen |
| Vertikal | `public/brand/lumiknot-lockup-vertical.svg` | quadratische Flächen, Titelseiten |
| Nur Zeichen | `public/brand/lumiknot-symbol.svg` | Avatare, kleine Flächen, wenn der Name daneben steht |
| Einfarbig dunkel | `public/brand/lumiknot-symbol-mono-dark.svg` | Druck einfarbig, Prägung, helle Flächen |
| Einfarbig hell | `public/brand/lumiknot-symbol-mono-light.svg` | dunkle Flächen ohne Farbe |
| Favicon | `public/favicon.svg`, `public/favicon.ico` (16/32/48) | Browser; Kleinvariante mit Strich 84 |
| App-Icon | `public/apple-touch-icon.png` (180), `public/icon-192.png`, `public/icon-512.png` | iOS, PWA |
| Maskable | `public/icon-maskable-512.png` | Android (Zeichen in 60 %, sicher im Kreis) |
| Teilen-Bild | `public/og-image.png` (1200 × 630) | Open Graph |

Nach jeder Änderung an den Dateien die Version `?v=` erhöhen – in `src/index.html` (Icons, `og:image`) und
`public/manifest.webmanifest` –, damit Browser, installierte Apps und Messenger nicht das alte Bild behalten.

In Angular immer `<app-brand>` statt einer Bilddatei: es zeichnet das Zeichen inline (scharf, ohne Anfrage), nutzt
Manrope und kennt den Bereichskontext.

## Bereichskontext (`<app-brand [context]>`)

- `global` (Standard): alle vier Elemente gleich.
- `finance` · `household` · `organization` · `travel`: das passende Element bleibt voll, die anderen gehen auf 42 %
  Deckkraft. Form, Farben und Reihenfolge ändern sich nie.
- Übergang 240 ms nur über Deckkraft; bei `prefers-reduced-motion` ohne Übergang. Keine Rotation, kein Pulsieren,
  keine Dauerbewegung.
- Die App-Shell setzt den Kontext aus der URL (`/finanzen`, `/haushalt`, `/organisation`, `/reisen`, auch unter
  `/demo`).
- `wordmark=false` zeigt nur das Zeichen; dann trägt es `role="img"` und `aria-label="Lumiknot"`. Mit Namen ist das
  Zeichen dekorativ (`aria-hidden`), der Link drumherum hat ein eigenes `aria-label`.

## Regeln

- Schutzraum rundum mindestens ¼ der Zeichenhöhe; Mindestgröße Zeichen 16 px (Favicon-Variante), Lockup 96 px breit.
- Auf Ivory, Weiß oder Midnight; auf unruhigen Flächen die einfarbige Variante.
- Nicht: verzerren, drehen, einzelne Elemente umfärben oder vertauschen, Verläufe, Schatten, Neon, Konturen,
  Elemente weglassen (außer der dezenten Hervorhebung über `context`), Name in anderer Schrift setzen, ®-Zeichen.
- Eine räumliche Variante (leichte Tiefe wie in der Vorlage) nur für ausgewählte Markenpräsentationen, nie in der App
  oder als Icon.
