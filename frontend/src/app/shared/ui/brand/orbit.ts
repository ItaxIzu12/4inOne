/**
 * Geometrie des Lumiknot-Orbit-Zeichens (28.11.2026, Vorlage docs/brand/lumiknot-orbit-reference.webp; Regeln
 * docs/LOGO_USAGE.md). Vier gleiche Elemente, je um 90° um die Mitte gedreht – keine nachgezeichneten Kurven, sondern
 * eine Konstruktion aus Gerade, Kreisbogen und Diagonale:
 *
 *   Zuleitung (senkrecht) → 135°-Bogen um den äußeren Ring (r = 108) → Diagonale (eine Seite der Raute in der Mitte).
 *
 * Die Diagonale endet auf der Mittellinie des Rings des nächsten Elements und liegt dort darunter; so verschlingen
 * sich die vier Elemente. Reihenfolge = Zeichenreihenfolge: Finanzen (oben links) · Haushalt (oben rechts) ·
 * Organisation (unten rechts) · Reisen (unten links). Reisen liegt zuletzt oben – wie in der Vorlage.
 *
 * Koordinaten um (0, 0); `ORBIT_VIEWBOX` umschließt das Zeichen genau. Die Datei hat keine Importe, damit das
 * Generator-Skript (scripts/brand-assets.mts) sie direkt mit Node lesen kann.
 */
export type OrbitSection = 'finance' | 'household' | 'organization' | 'travel';

/** Strichstärke der Hauptvariante und der kräftigeren Kleinvariante (Favicon, Zeichen unter 24 px). */
export const ORBIT_STROKE = 68;
export const ORBIT_STROKE_SMALL = 84;

/** Einfarbig: Lücke (je Seite) dort, wo ein Element über einem anderen liegt – sonst verschmelzen die Elemente. */
export const ORBIT_MONO_GAP = 18;

/** Ab dieser Zeichengröße (px) abwärts die Kleinvariante (Strich 84) verwenden (docs/LOGO_USAGE.md › Mindestgrößen). */
export const ORBIT_SMALL_BELOW = 24;

/** Halbe Kantenlänge des Zeichens inklusive Strich (Kleinvariante etwas größer). */
export const ORBIT_EXTENT = 226;
export const ORBIT_EXTENT_SMALL = 234;

const ARC = 'V-84A108 108 0 0 1 -7.63 -160.37L152.35 -0.39';

/** Ein Element; Finanzen beginnt tiefer und verschwindet unter Reisen (wie in der Vorlage). */
function element(start: number): string {
  return `M-192 ${start}${ARC}`;
}

export interface OrbitElement {
  readonly section: OrbitSection;
  readonly d: string;
  readonly rotate: number;
}

export const ORBIT_ELEMENTS: readonly OrbitElement[] = [
  { section: 'finance', d: element(84), rotate: 0 },
  { section: 'household', d: element(-30), rotate: 90 },
  { section: 'organization', d: element(-30), rotate: 180 },
  { section: 'travel', d: element(-30), rotate: 270 },
];

/** Einfarbig: welche Elemente ein Element überdecken (alle später gezeichneten) – für die Lücken-Masken. */
export function orbitElementsAbove(index: number): readonly OrbitElement[] {
  return ORBIT_ELEMENTS.slice(index + 1);
}

export function orbitViewBox(small = false): string {
  const e = small ? ORBIT_EXTENT_SMALL : ORBIT_EXTENT;
  return `${-e} ${-e} ${2 * e} ${2 * e}`;
}
