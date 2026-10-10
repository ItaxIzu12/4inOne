import { Component, computed, inject, input } from '@angular/core';
import { FxService } from '../../core/fx/fx.service';
import { formatAmount, formatRate } from './currencies';

/**
 * Umrechnung unter einem Betragsfeld in die Heimatwährung: „≈ 48,70 € in deiner Heimatwährung“, darunter eine
 * Kursrichtung („1 JPY ≈ 0,005731 EUR“) und der einheitliche Richtkurs-Hinweis.
 * Rein zur Orientierung — gespeichert wird der eingegebene Betrag in seiner Währung. Gleiche Währung: nichts.
 * Ohne Kurs: „Umrechnung derzeit nicht verfügbar.“ — nie ein geratener Wert.
 */
@Component({
  selector: 'app-fx-hint',
  standalone: true,
  template: `
    @if (from() !== to()) {
      <div class="fx" aria-live="polite">
        @switch (status()) {
          @case ('loading') {
            <p class="fx__line fx__line--muted">Kurs wird geladen …</p>
          }
          @case ('unavailable') {
            <p class="fx__line fx__line--muted">Umrechnung derzeit nicht verfügbar.</p>
          }
          @case ('ready') {
            @if (preview(); as p) {
              <p class="fx__line">
                <b>≈ {{ money(p.value, to()) }}</b><span>{{ ' ' + label() }}</span>
              </p>
              <p class="fx__note">
                1 {{ from() }} ≈ {{ rate(p.rate) }} {{ to() }} · {{ p.source }}, Stand {{ day(p.rateDate) }}<br />
                Umrechnung nach aktuellem Richtkurs. Der tatsächliche Wechselkurs deiner Bank, Karte oder Wechselstube kann
                abweichen.
              </p>
            }
          }
        }
      </div>
    }
  `,
  styles: `
    .fx {
      display: grid;
      gap: 2px;
      padding: 10px 12px;
      border-radius: 12px;
      background: #f4f7fb;
    }
    .fx__line {
      margin: 0;
      color: #16233a;
      font-size: 14.5px;
      font-variant-numeric: tabular-nums;
    }
    .fx__line b {
      font-weight: 650;
    }
    .fx__line span,
    .fx__line--muted {
      color: #53627a;
    }
    .fx__note {
      margin: 0;
      color: #5b6b83;
      font-size: 12.5px;
      line-height: 1.45;
    }
  `,
})
export class FxHint {
  private readonly fx = inject(FxService);
  /** Eingegebener Betrag; null/0 = noch nichts Sinnvolles eingegeben. */
  readonly amount = input<number | null>(null);
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  readonly label = input('in deiner Heimatwährung');

  constructor() {
    this.fx.ensureLoaded();
  }

  readonly status = computed(() => {
    const state = this.fx.state();
    if (state === 'loading') return 'loading';
    if (state === 'unavailable' || (this.amount() && !this.preview())) return 'unavailable';
    return this.amount() ? 'ready' : 'none';
  });
  readonly preview = computed(() => {
    const amount = this.amount();
    return amount ? this.fx.preview(amount, this.from(), this.to()) : null;
  });

  money(value: number, currency: string): string {
    return formatAmount(value, currency);
  }
  rate(value: number): string {
    return formatRate(value);
  }
  day(iso: string): string {
    return new Date(`${iso}T12:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
