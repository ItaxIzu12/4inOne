import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';

/**
 * Verbindet zwei Elemente mit einer geschwungenen Linie, auf der ein Lichtimpuls läuft (Muster „Animated Beam“ aus
 * Magic UI, nach Angular übertragen). Das SVG liegt absolut im `container` (der `position: relative` haben muss)
 * und hinter den verbundenen Elementen; der Verlauf wird bei jeder Größenänderung neu berechnet.
 *
 *   <app-animated-beam [container]="stage" [from]="a" [to]="b" color="#0f9d6b" [delay]="0.4" />
 *
 * Bei reduzierter Bewegung bleibt nur die ruhende Linie. Rein dekorativ: aria-hidden.
 */
@Component({
  selector: 'app-animated-beam',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (geometry(); as g) {
      <svg [attr.width]="g.w" [attr.height]="g.h" [attr.viewBox]="'0 0 ' + g.w + ' ' + g.h" aria-hidden="true" focusable="false">
        <path class="beam__base" [attr.d]="g.d" />
        <path
          class="beam__pulse"
          [attr.d]="g.d"
          pathLength="1000"
          [style.stroke]="color()"
          [style.animation-delay.s]="delay()"
          [style.animation-duration.s]="duration()"
          [class.is-reverse]="reverse()"
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
      stroke: var(--beam-base, rgb(18 24 38 / 0.12));
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
    @media (prefers-reduced-motion: reduce) {
      .beam__pulse {
        display: none;
      }
    }
  `,
})
export class AnimatedBeam {
  readonly container = input.required<HTMLElement>();
  readonly from = input.required<HTMLElement>();
  readonly to = input.required<HTMLElement>();
  readonly color = input('#3b6fe0');
  /** Biegung der Linie in px (positiv nach oben). */
  readonly curvature = input(0);
  readonly delay = input(0);
  readonly duration = input(3.2);
  readonly reverse = input(false);

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
