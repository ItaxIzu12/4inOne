import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { SpendCurve, dayLabel, eur, eurRound, paceAt } from './spend-curve-data';

/**
 * Ausgabenkurve wie in Banking-Apps: aufsummierte Ausgaben des Monats bis heute, dazu gestrichelt das gleichmäßige
 * Budget-Tempo. Selbst gezeichnet (SVG, keine Diagramm-Bibliothek).
 *
 * - `compact`: kleine, ruhige Fassung (Startseite) — nur Bild, beschrieben über `aria-label`.
 * - sonst abfahrbar: Maus/Finger über die Fläche, Tastatur mit ← → Pos1 Ende (role="slider"); die Zeile darüber
 *   nennt Tag, Ausgaben bis dahin und den Plan-Wert. Ohne Eingriff zeigt sie den letzten Tag (heute).
 *
 * Linien skalieren mit `preserveAspectRatio="none"` und `vector-effect: non-scaling-stroke`; Punkte und Führungslinie
 * sind HTML in Prozent, damit sie rund bleiben.
 */
const W = 1000;
const H = 300;

@Component({
  selector: 'app-spend-curve',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = curve();
    @if (!compact()) {
      <p class="readout" aria-hidden="true">
        <span class="readout__day">{{ readout().day }}</span>
        <span class="readout__value">{{ readout().spent }}</span>
        <span class="readout__pace">{{ readout().pace }}</span>
      </p>
    }
    <div
      class="plot"
      [class.is-compact]="compact()"
      [attr.role]="compact() ? 'img' : 'slider'"
      [attr.aria-label]="label()"
      [attr.tabindex]="compact() || !c.series.length ? null : 0"
      [attr.aria-valuemin]="compact() ? null : 1"
      [attr.aria-valuemax]="compact() ? null : c.series.length"
      [attr.aria-valuenow]="compact() ? null : activeDay()"
      [attr.aria-valuetext]="compact() ? null : readout().text"
      (pointermove)="onPointer($event)"
      (pointerdown)="onPointer($event)"
      (pointerleave)="scrub.set(null)"
      (keydown)="onKey($event)"
      (blur)="scrub.set(null)"
    >
      <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        @if (pacePath(); as pace) {
          <path class="pace" [attr.d]="pace" />
        }
        @if (areaPath(); as area) {
          <path class="area" [attr.d]="area" />
          <path class="line" [attr.d]="linePath()" />
        }
        <line class="base" x1="0" [attr.y1]="h" [attr.x2]="w" [attr.y2]="h" />
      </svg>
      @if (point(c.series.length); as p) {
        <span class="dot dot--today" [style.left.%]="p.x" [style.top.%]="p.y" aria-hidden="true"></span>
      }
      @if (scrub() !== null) {
        @let s = point(activeDay());
        @if (s) {
          <span class="guide" [style.left.%]="s.x" aria-hidden="true"></span>
          <span class="dot dot--scrub" [style.left.%]="s.x" [style.top.%]="s.y" aria-hidden="true"></span>
        }
      }
    </div>
    @if (!compact()) {
      <p class="axis" aria-hidden="true"><span>{{ first() }}</span><span>{{ last() }}</span></p>
      <!-- Legende: was die Linien bedeuten (nicht nur über Farbe und Strichart) -->
      <ul class="legend">
        <li><span class="legend__line" aria-hidden="true"></span>Ausgaben, aufsummiert</li>
        @if (c.budget !== null) {
          <li><span class="legend__line legend__line--pace" aria-hidden="true"></span>Budget für Ausgaben (ohne Sparbeiträge), gleichmäßig verteilt</li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: block;
      --curve-line: var(--finance-accent, #17694f);
      --curve-fill: color-mix(in srgb, var(--finance-accent, #17694f) 11%, transparent);
      --curve-pace: var(--text-secondary, #52615b);
      --curve-base: var(--border-subtle, #e6e9e3);
      --curve-height: 180px;
    }
    .readout {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 2px 12px;
      min-height: 24px;
      margin: 0 0 12px;
      color: var(--text-secondary);
      font-size: 14px;
    }
    .readout__day {
      color: var(--text-primary);
      font-weight: 600;
    }
    .readout__value {
      color: var(--text-primary);
      font-weight: 600;
    }
    .plot {
      position: relative;
      height: var(--curve-height);
      touch-action: pan-y;
      outline-offset: 6px;
      border-radius: 4px;
    }
    .plot:not(.is-compact) {
      cursor: crosshair;
    }
    .plot.is-compact {
      --curve-height: 64px;
    }
    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    path,
    line {
      vector-effect: non-scaling-stroke;
      fill: none;
    }
    .area {
      fill: var(--curve-fill);
    }
    .line {
      stroke: var(--curve-line);
      stroke-width: 2.25;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .pace {
      stroke: var(--curve-pace);
      stroke-width: 1.25;
      stroke-dasharray: 3 5;
      opacity: 0.7;
    }
    .base {
      stroke: var(--curve-base);
      stroke-width: 1;
    }
    .dot {
      position: absolute;
      width: 10px;
      height: 10px;
      margin: -5px 0 0 -5px;
      border-radius: 50%;
      background: var(--curve-line);
      box-shadow: 0 0 0 3px var(--surface-card, #fff);
      pointer-events: none;
    }
    .dot--scrub {
      width: 12px;
      height: 12px;
      margin: -6px 0 0 -6px;
    }
    .guide {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: var(--curve-pace);
      opacity: 0.35;
      pointer-events: none;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 20px;
      margin: 12px 0 0;
      padding: 0;
      color: var(--text-secondary);
      font-size: 13px;
      list-style: none;
    }
    .legend li {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend__line {
      width: 18px;
      height: 0;
      border-top: 2.25px solid var(--curve-line);
    }
    .legend__line--pace {
      border-top: 1.5px dashed var(--curve-pace);
    }
    .axis {
      display: flex;
      justify-content: space-between;
      margin: 8px 0 0;
      color: var(--text-secondary);
      font-size: 13px;
    }
  `,
})
export class SpendCurveChart {
  readonly curve = input.required<SpendCurve>();
  readonly compact = input(false);
  /** Name für Screenreader, z. B. „Ausgaben im Oktober“. */
  readonly label = input('Ausgabenverlauf');

  readonly w = W;
  readonly h = H;
  /** Abgefahrener Tag (1-basiert) oder null = letzter Tag. */
  readonly scrub = signal<number | null>(null);
  readonly activeDay = computed(() => this.scrub() ?? this.curve().series.length);

  private readonly max = computed(() => {
    const c = this.curve();
    const top = Math.max(c.budget ?? 0, c.series.at(-1) ?? 0, 1);
    return top * 1.06;
  });
  private x(dayIndex: number): number {
    const c = this.curve();
    return c.days > 1 ? (dayIndex / (c.days - 1)) * W : 0;
  }
  private y(value: number): number {
    return H - (value / this.max()) * H;
  }
  readonly linePath = computed(() =>
    this.curve()
      .series.map((v, i) => `${i ? 'L' : 'M'}${this.x(i).toFixed(1)},${this.y(v).toFixed(1)}`)
      .join(' '),
  );
  readonly areaPath = computed(() => {
    const s = this.curve().series;
    if (s.length < 2) return '';
    return `${this.linePath()} L${this.x(s.length - 1).toFixed(1)},${H} L0,${H} Z`;
  });
  readonly pacePath = computed(() => {
    const b = this.curve().budget;
    return b === null ? '' : `M0,${H} L${W},${this.y(b).toFixed(1)}`;
  });
  /** Position eines Tages (1-basiert) in Prozent der Fläche, oder null. */
  point(day: number): { x: number; y: number } | null {
    const s = this.curve().series;
    if (!s.length || day < 1 || day > s.length) return null;
    return { x: (this.x(day - 1) / W) * 100, y: (this.y(s[day - 1]) / H) * 100 };
  }
  readonly first = computed(() => dayLabel(this.curve().month, 1));
  readonly last = computed(() => dayLabel(this.curve().month, this.curve().days));
  readonly readout = computed(() => {
    const c = this.curve();
    const day = this.activeDay();
    if (!c.series.length) return { day: '', spent: 'Noch keine Ausgaben', pace: '', text: 'Noch keine Ausgaben' };
    const spent = c.series[day - 1];
    const pace = paceAt(c, day);
    const isToday = c.current && day === c.series.length;
    // „Bis heute im Oktober“ statt „Heute“: die Zahl ist die Monatssumme bis heute, nicht die Ausgabe dieses einen Tages
    const monthLong = new Date(`${c.month}-01T12:00`).toLocaleDateString('de-DE', { month: 'long' });
    const dayText = isToday ? `Bis heute im ${monthLong}` : `Bis ${dayLabel(c.month, day)}`;
    // „Budget anteilig“: so viel wäre bis zu diesem Tag dran, wenn das Budget gleichmäßig über den Monat verteilt wird
    const paceText = pace === null ? '' : `Budget anteilig: ${eurRound(pace)}`;
    return {
      day: dayText,
      spent: `${eur(spent)} ausgegeben`,
      pace: paceText,
      text: `${dayText}: ${eur(spent)} ausgegeben${paceText ? `, ${paceText}` : ''}`,
    };
  });

  onPointer(event: PointerEvent): void {
    if (this.compact()) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const c = this.curve();
    if (!c.series.length || !box.width) return;
    const share = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const day = Math.round(share * (c.days - 1)) + 1;
    this.scrub.set(Math.min(c.series.length, Math.max(1, day)));
  }
  onKey(event: KeyboardEvent): void {
    if (this.compact()) return;
    const n = this.curve().series.length;
    if (!n) return;
    const now = this.activeDay();
    const next =
      event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? now - 1
      : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? now + 1
      : event.key === 'Home' ? 1
      : event.key === 'End' ? n
      : null;
    if (next === null) return;
    event.preventDefault();
    this.scrub.set(Math.min(n, Math.max(1, next)));
  }
}
