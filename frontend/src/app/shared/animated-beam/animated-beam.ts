import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';

/**
 * Verbindet zwei Elemente mit einer geschwungenen Linie, auf der ein Lichtimpuls läuft (Muster „Animated Beam“ aus
 * Magic UI, nach Angular übertragen). Das SVG liegt absolut im `container` (der `position: relative` haben muss)
 * und hinter den verbundenen Elementen; der Verlauf wird bei jeder Größenänderung neu berechnet.
 *
 *   <app-animated-beam [container]="stage" [from]="a" [to]="b" color="#17694f" [delay]="0.4" />
 *
 * Bei reduzierter Bewegung bleibt nur die ruhende Linie. Rein dekorativ: aria-hidden.
 */
@Component({
  selector: 'app-animated-beam',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geometry(); as g) {
      <svg [attr.width]="g.w" [attr.height]="g.h" [attr.viewBox]="'0 0 ' + g.w + ' ' + g.h" [class.is-preview]="preview()" aria-hidden="true" focusable="false">
        <path class="beam__base" [attr.d]="g.d" />
        <path
          class="beam__pulse"
          [attr.d]="g.d"
          pathLength="1000"
          [style.stroke]="color()"
          [style.animation-delay.s]="delay()"
          [style.animation-duration.s]="duration()"
          [style.animation-iteration-count]="iterations()"
          [class.is-reverse]="reverse()"
          [class.is-finite]="iterations() !== 'infinite'"
        />
      </svg>
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
    }
    svg {
      position: absolute;
      inset: 0;
      overflow: visible;
    }
    path {
      fill: none;
      stroke-linecap: round;
    }
    .beam__base {
      stroke: var(--beam-base, rgb(23 37 35 / 0.12));
      stroke-width: 1.5;
    }
    .beam__pulse {
      stroke-width: 2.5;
      stroke-dasharray: 90 910;
      stroke-dashoffset: 1000;
      animation: beam linear infinite;
    }
    .beam__pulse.is-reverse {
      animation-direction: reverse;
    }
    @keyframes beam {
      to {
        stroke-dashoffset: 0;
      }
    }
    /* Begrenzte Impulse: ein- und ausblenden, damit nach dem letzten nichts am Linienanfang stehen bleibt */
    .beam__pulse.is-finite {
      opacity: 0;
      animation-name: beam-finite;
      animation-fill-mode: forwards;
    }
    @keyframes beam-finite {
      0% {
        stroke-dashoffset: 1000;
        opacity: 0;
      }
      12%,
      88% {
        opacity: 1;
      }
      100% {
        stroke-dashoffset: 0;
        opacity: 0;
      }
    }
    /* Vorschau („was würde verbunden?“): gestrichelt, ohne Impuls, kurz eingeblendet */
    .is-preview {
      animation: beam-in 180ms ease-out both;
    }
    .is-preview .beam__base {
      stroke: var(--beam-preview, rgb(23 37 35 / 0.4));
      stroke-width: 1.75;
      stroke-dasharray: 4 7;
    }
    .is-preview .beam__pulse {
      display: none;
    }
    @keyframes beam-in {
      from {
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .beam__pulse {
        display: none;
      }
      .is-preview {
        animation: none;
      }
    }
  `,
})
export class AnimatedBeam {
  readonly container = input.required<HTMLElement>();
  readonly from = input.required<HTMLElement>();
  readonly to = input.required<HTMLElement>();
  readonly color = input('#3d6b9a');
  /** Biegung der Linie in px (positiv nach oben). */
  readonly curvature = input(0);
  readonly delay = input(0);
  /** Anzahl der Impulse; „infinite“ für die Website, eine feste Zahl in der App (Ruhe, Akku). */
  readonly iterations = input<number | 'infinite'>('infinite');
  readonly duration = input(3.2);
  readonly reverse = input(false);
  /** Nur Vorschau: gestrichelte Linie ohne Impuls (z. B. beim Überfahren von „Verknüpfen“). */
  readonly preview = input(false);

  readonly geometry = signal<{ w: number; h: number; d: string } | null>(null);

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const measure = () => {
        const box = this.container().getBoundingClientRect();
        const a = this.from().getBoundingClientRect();
        const b = this.to().getBoundingClientRect();
        const ax = a.left - box.left + a.width / 2;
        const ay = a.top - box.top + a.height / 2;
        const bx = b.left - box.left + b.width / 2;
        const by = b.top - box.top + b.height / 2;
        const cx = (ax + bx) / 2;
        const cy = (ay + by) / 2 - this.curvature();
        this.geometry.set({ w: box.width, h: box.height, d: `M ${ax},${ay} Q ${cx},${cy} ${bx},${by}` });
      };
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(measure);
      observer.observe(this.container());
      observer.observe(this.from());
      observer.observe(this.to());
      destroy.onDestroy(() => observer.disconnect());
    });
  }
}
