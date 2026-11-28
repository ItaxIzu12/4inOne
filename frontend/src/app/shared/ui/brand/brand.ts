import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { BRAND, BRAND_SECTIONS, BrandContext } from '../../../core/brand/brand.config';
import {
  ORBIT_ELEMENTS,
  ORBIT_EXTENT,
  ORBIT_EXTENT_SMALL,
  ORBIT_MONO_GAP,
  ORBIT_SMALL_BELOW,
  ORBIT_STROKE,
  ORBIT_STROKE_SMALL,
  orbitElementsAbove,
  orbitViewBox,
} from './orbit';

/** Aufbau: Zeichen mit Name nebeneinander (Standard), untereinander, nur Zeichen oder nur Name. */
export type BrandLayout = 'horizontal' | 'vertical' | 'symbol' | 'wordmark';
/** Farbig (Standard) oder einfarbig in der Schriftfarbe (mit Lücken an den Überlagerungen). */
export type BrandTone = 'color' | 'mono';
/** Untergrund: `auto` erbt die Textfarbe; `light`/`dark` setzen Midnight bzw. Weiß fest (Bänder, Fotos). */
export type BrandSurface = 'auto' | 'light' | 'dark';
/** `animated` zeichnet das Zeichen beim ersten Erscheinen einmal (≈ 0,7 s); nie dauerhaft, nie bei reduzierter Bewegung. */
export type BrandMotion = 'static' | 'animated';

let nextId = 0;

/**
 * Die Marke Lumiknot – die eine Logo-Komponente der App (docs/LOGO_USAGE.md, docs/SECTION_IDENTITY.md,
 * docs/MOTION_GUIDELINES.md). Geometrie nur aus shared/ui/brand/orbit.ts, Name und Farben aus core/brand/brand.config.ts
 * – dieselben Quellen, aus denen scripts/brand-assets.mts die Logo-Dateien erzeugt.
 *
 * - `context`: 'global' (Standard) zeigt alle vier Elemente gleich; in einem Bereich bleibt das passende Element voll,
 *   die anderen gehen auf 42 % – Form, Farben und Reihenfolge bleiben, die Marke bleibt eine.
 * - `layout`, `tone`, `surface`, `size`, `claim`, `motion`: siehe Typen oben.
 * - `wordmark` (älter): false = `layout="symbol"`.
 *
 * Mit sichtbarem Namen ist das Zeichen dekorativ; ohne Namen trägt es `role="img"` und den Namen.
 * Ohne `size` gilt die `font-size` des Hosts (Zeichen = 1,3 em); unter 24 px die Kleinvariante (Strich 84).
 */
@Component({
  selector: 'app-brand',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-context]': 'context()',
    '[attr.data-layout]': 'effectiveLayout()',
    '[class.is-mono]': "tone() === 'mono'",
    '[class.is-animated]': "motion() === 'animated'",
    '[class.on-light]': "surface() === 'light'",
    '[class.on-dark]': "surface() === 'dark'",
    '[style.font-size.px]': 'size() ? size()! / 1.3 : null',
  },
  template: `@if (effectiveLayout() !== 'wordmark') {<svg
        class="mark"
        [attr.viewBox]="viewBox()"
        [attr.aria-hidden]="hasName() ? 'true' : null"
        [attr.role]="hasName() ? null : 'img'"
        [attr.aria-label]="hasName() ? null : name"
        focusable="false"
      >
        @if (tone() === 'mono') {
          <defs>
            @for (mask of masks(); track mask.id) {
              <mask [attr.id]="mask.id" maskUnits="userSpaceOnUse" [attr.x]="-extent()" [attr.y]="-extent()"
                [attr.width]="2 * extent()" [attr.height]="2 * extent()">
                <rect [attr.x]="-extent()" [attr.y]="-extent()" [attr.width]="2 * extent()" [attr.height]="2 * extent()" fill="#fff" />
                @for (above of mask.above; track above.section) {
                  <path [attr.d]="above.d" [attr.transform]="'rotate(' + above.rotate + ')'" fill="none" stroke="#000"
                    [attr.stroke-width]="stroke() + 2 * gap" stroke-linecap="round" stroke-linejoin="round" />
                }
              </mask>
            }
          </defs>
        }
        @for (el of elements; track el.section; let i = $index) {
          <g [attr.mask]="tone() === 'mono' ? 'url(#' + masks()[i].id + ')' : null">
            <path
              pathLength="1"
              [attr.d]="el.d"
              [attr.transform]="'rotate(' + el.rotate + ')'"
              [class]="'el el--' + el.section"
              [class.is-quiet]="context() !== 'global' && context() !== el.section"
              [style.stroke]="tone() === 'mono' ? 'currentColor' : 'var(--logo-' + el.section + ', ' + colors[el.section] + ')'"
              [style.animation-delay.ms]="i * 70"
              [attr.stroke-width]="stroke()"
            />
          </g>
        }</svg
      >}@if (hasName()) {<span class="text"
        ><span class="name">{{ name }}</span>@if (claim()) {<span class="claim">{{ claimText }}</span>}</span
      >}`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.36em;
      font-family: var(--font-brand, 'Manrope', Helvetica, Arial, sans-serif);
      font-size: 27px;
      font-weight: 700;
      letter-spacing: -0.035em;
      line-height: 1;
      color: var(--text-primary, #101820);
    }
    :host(.on-light) {
      color: var(--lk-midnight, #101820);
    }
    :host(.on-dark) {
      color: var(--lk-white, #ffffff);
    }
    :host([data-layout='vertical']) {
      flex-direction: column;
      gap: 0.3em;
      text-align: center;
    }
    .mark {
      width: 1.3em;
      height: 1.3em;
      flex: none;
      overflow: visible;
    }
    :host([data-layout='vertical']) .mark {
      width: 2em;
      height: 2em;
    }
    .text {
      display: inline-flex;
      flex-direction: column;
      gap: 0.3em;
    }
    .claim {
      font-size: 0.32em;
      font-weight: 500;
      letter-spacing: 0.2em;
    }
    .el {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: opacity var(--motion-logo, 240ms) var(--ease-standard, cubic-bezier(0.2, 0, 0, 1));
    }
    .el.is-quiet {
      opacity: 0.42;
    }
    /* Einmaliges Zeichnen beim Erscheinen (App-Start-Momente): Elemente nacheinander, Name blendet danach ein. */
    :host(.is-animated) .el {
      stroke-dasharray: 1;
      animation: lk-draw 520ms var(--ease-out, cubic-bezier(0, 0, 0.2, 1)) both;
    }
    :host(.is-animated) .text {
      animation: lk-fade 240ms var(--ease-out, cubic-bezier(0, 0, 0.2, 1)) 360ms both;
    }
    @keyframes lk-draw {
      from {
        stroke-dashoffset: 1;
      }
      to {
        stroke-dashoffset: 0;
      }
    }
    @keyframes lk-fade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .el {
        transition: none;
      }
      :host(.is-animated) .el,
      :host(.is-animated) .text {
        animation: none;
      }
    }
  `,
})
export class Brand {
  readonly context = input<BrandContext>('global');
  readonly layout = input<BrandLayout>('horizontal');
  readonly tone = input<BrandTone>('color');
  readonly surface = input<BrandSurface>('auto');
  readonly motion = input<BrandMotion>('static');
  /** Höhe des Zeichens in px (horizontal/Zeichen); ohne Angabe aus der Schriftgröße des Hosts. */
  readonly size = input<number | null>(null);
  /** Claim unter dem Namen (nur mit Namen). */
  readonly claim = input(false);
  /** Älter: false = nur Zeichen. */
  readonly wordmark = input(true);

  protected readonly name = BRAND.name;
  protected readonly claimText = BRAND.claim;
  protected readonly elements = ORBIT_ELEMENTS;
  protected readonly gap = ORBIT_MONO_GAP;
  protected readonly colors = Object.fromEntries(BRAND_SECTIONS.map((s) => [s.id, s.logoColor])) as Record<string, string>;

  protected readonly effectiveLayout = computed<BrandLayout>(() => (this.wordmark() ? this.layout() : 'symbol'));
  protected readonly hasName = computed(() => this.effectiveLayout() !== 'symbol');
  /** Kleinvariante, wenn die Größe bekannt und kleiner als 24 px ist. */
  protected readonly small = computed(() => (this.size() ?? Infinity) < ORBIT_SMALL_BELOW);
  protected readonly stroke = computed(() => (this.small() ? ORBIT_STROKE_SMALL : ORBIT_STROKE));
  protected readonly extent = computed(() => (this.small() ? ORBIT_EXTENT_SMALL : ORBIT_EXTENT));
  protected readonly viewBox = computed(() => orbitViewBox(this.small()));

  private readonly uid = `lk-brand-${++nextId}`;
  /** Masken je Element (eindeutige IDs je Instanz, sonst färben sich mehrere Logos auf einer Seite gegenseitig). */
  protected readonly masks = computed(() =>
    ORBIT_ELEMENTS.map((_, i) => ({ id: `${this.uid}-${i}`, above: orbitElementsAbove(i) })),
  );
}
