import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { BRAND, BrandContext } from '../../../core/brand/brand.config';
import { ORBIT_ELEMENTS, ORBIT_STROKE, orbitViewBox } from './orbit';

/**
 * Die Marke Lumiknot (28.11.2026, docs/LOGO_USAGE.md): Orbit-Zeichen (shared/ui/brand/orbit.ts) und Name in Manrope.
 *
 * - `context`: 'global' (Standard) zeigt alle vier Elemente gleich; in einem Bereich bleibt das passende Element voll
 *   und die anderen werden leiser – Form, Farben und Reihenfolge bleiben, die Marke bleibt erkennbar.
 *   Übergang 240 ms nur über Deckkraft; bei „Bewegung reduzieren“ ohne Übergang. Keine Dauerbewegung.
 * - `wordmark`: false zeigt nur das Zeichen (z. B. sehr schmale Leisten); dann trägt das Zeichen den Namen für
 *   Bildschirmleser, sonst ist es dekorativ und der sichtbare Name zählt.
 *
 * Größe über `font-size` des Hosts (Zeichen = 1,3 em). Farben: `--logo-*` (styles.css), Fallback brand.config.
 */
@Component({
  selector: 'app-brand',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-context]': 'context()' },
  template: `<svg
      class="mark"
      [attr.viewBox]="viewBox"
      [attr.aria-hidden]="wordmark() ? 'true' : null"
      [attr.role]="wordmark() ? null : 'img'"
      [attr.aria-label]="wordmark() ? null : name"
      focusable="false"
    >
      @for (el of elements; track el.section) {
        <path
          [attr.d]="el.d"
          [attr.transform]="'rotate(' + el.rotate + ')'"
          [class]="'el el--' + el.section"
          [class.is-quiet]="context() !== 'global' && context() !== el.section"
          [style.stroke]="'var(--logo-' + el.section + ', ' + colors[el.section] + ')'"
          [attr.stroke-width]="stroke"
        />
      }</svg
    >@if (wordmark()) {<span class="name">{{ name }}</span>}`,
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
    .mark {
      width: 1.3em;
      height: 1.3em;
      flex: none;
      overflow: visible;
    }
    .el {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: opacity 240ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .el.is-quiet {
      opacity: 0.42;
    }
    @media (prefers-reduced-motion: reduce) {
      .el {
        transition: none;
      }
    }
  `,
})
export class Brand {
  readonly context = input<BrandContext>('global');
  readonly wordmark = input(true);

  protected readonly name = BRAND.name;
  protected readonly viewBox = orbitViewBox();
  protected readonly stroke = ORBIT_STROKE;
  protected readonly elements = ORBIT_ELEMENTS;
  protected readonly colors = Object.fromEntries(
    Object.entries(BRAND.sections).map(([key, s]) => [key, s.logoColor]),
  ) as Record<string, string>;
}
