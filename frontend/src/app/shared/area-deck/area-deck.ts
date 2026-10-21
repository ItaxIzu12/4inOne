import { afterNextRender, Component, computed, DestroyRef, inject, input, model, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppIcon, IconName } from '../icons/app-icon';

/** Die vier Bereiche von 4inOne — jeder mit seiner Logo-Farbe. */
export type AreaTone = 'finance' | 'household' | 'organisation' | 'travel';

/** Eine Zeile der Vorschau: Text, optional ein Wert rechts, ein Balken (0–1) und ein Zustand. */
export interface AreaPreviewRow {
  label: string;
  value?: string;
  meter?: number;
  state?: 'late' | 'next';
}

/** Kleiner Ausschnitt echter Inhalte, z. B. aus der Demo — macht die Karte zum Produktbild statt zum Werbesatz. */
export interface AreaPreview {
  /** Herkunft, sichtbar auf der Karte (z. B. „Aus der Demo“). */
  source: string;
  rows: AreaPreviewRow[];
}

export interface AreaDeckCard {
  key: string;
  tone: AreaTone;
  icon: IconName;
  name: string;
  /** Ein Satz, was der Bereich für dich tut. */
  text: string;
  /** Zwei bis drei Stichworte (z. B. „Monatsbudget“). */
  tags?: string[];
  /** Optionale Vorschau mit echten Inhalten (ersetzt bei Bedarf die Stichworte). */
  preview?: AreaPreview;
  /** Optionaler Link der aktiven Karte, z. B. in die Demo. */
  link?: { label: string; path: string; query?: Record<string, string> };
}

/**
 * Fächer aus Bereichskarten (Vorbild: Kombai-Galerie „Daymoor“). Die mittlere Karte ist groß und lesbar, die anderen
 * liegen gefächert daneben — ein Tipp holt sie nach vorn. Bedienbar per Tastatur (Pfeiltasten, Pos1/Ende), mit
 * Vor/Zurück-Knöpfen und Punkten; keine automatische Drehung. Global nutzbar: Startseite, Leerzustände, Onboarding —
 * für jeden der vier Bereiche gleich, nur die Farbe wechselt.
 *
 * Barrierefreiheit: Nur die aktive Karte ist inhaltlich lesbar und hat ihren Link; die übrigen sind Knöpfe
 * „Haushalt zeigen“. Die Ansage nach einem Wechsel kommt über eine aria-live-Region.
 */
@Component({
  selector: 'app-area-deck',
  standalone: true,
  imports: [RouterLink, AppIcon],
  templateUrl: './area-deck.html',
  styleUrl: './area-deck.scss',
})
export class AreaDeck {
  readonly cards = input.required<AreaDeckCard[]>();
  /** Name der Gruppe für Screenreader, z. B. „Die vier Bereiche“. */
  readonly label = input('Bereiche');
  /** Index der aktiven Karte; von außen setz- und lesbar (two-way: [(active)]). */
  readonly active = model(0);
  /** Einmal beim Erscheinen aus einem Stapel auffächern (bei reduzierter Bewegung sofort offen). */
  readonly fanIn = input(false);
  readonly stacked = signal(false);

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      if (!this.fanIn() || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      this.stacked.set(true);
      const timer = setTimeout(() => this.stacked.set(false), 650);
      destroy.onDestroy(() => clearTimeout(timer));
    });
  }

  readonly current = computed(() => this.cards()[this.active()] ?? this.cards()[0]);

  /** Abstand jeder Karte zur aktiven: −2 … 2 (bei vier Karten die kürzere Richtung, damit der Fächer symmetrisch bleibt). */
  offset(index: number): number {
    const n = this.cards().length;
    let d = index - this.active();
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  }

  select(index: number): void {
    const n = this.cards().length;
    this.active.set(((index % n) + n) % n);
  }

  onKey(event: KeyboardEvent): void {
    const n = this.cards().length;
    const next =
      event.key === 'ArrowRight' ? this.active() + 1
      : event.key === 'ArrowLeft' ? this.active() - 1
      : event.key === 'Home' ? 0
      : event.key === 'End' ? n - 1
      : null;
    if (next === null) return;
    event.preventDefault();
    this.select(next);
  }

  // Wischen am Handy: horizontale Bewegung über 40 px wechselt die Karte.
  private startX: number | null = null;
  onPointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') this.startX = event.clientX;
  }
  onPointerUp(event: PointerEvent): void {
    if (this.startX === null) return;
    const dx = event.clientX - this.startX;
    this.startX = null;
    if (Math.abs(dx) > 40) this.select(this.active() + (dx < 0 ? 1 : -1));
  }
}
