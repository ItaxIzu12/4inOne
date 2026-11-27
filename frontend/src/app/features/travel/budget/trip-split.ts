import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { AppIcon } from '../../../shared/ui/icons/app-icon';
import { ReisenApi, Trip, TripBalances, TripExpense } from '../data/travel-api.service';
import { formatMoney } from '../shared/travel-logic';

/** Reise › Budget › „Wer schuldet wem“ (15.11.2026): wer was ausgelegt hat, wer wem wie viel schuldet – mit den
 * wenigsten Überweisungen (backend reisen/split.py). „Als beglichen markieren“ ist nur ein Vermerk; Veyora bewegt
 * nie Geld. Nur bei Reisen mit mehr als einer Person; gerechnet in der Reisewährung. */
@Component({
  selector: 'app-trip-split',
  imports: [AppIcon],
  templateUrl: './trip-split.html',
  styleUrls: ['../shared/trip-common.scss', './trip-split.scss'],
})
export class TripSplit {
  readonly trip = input.required<Trip>();
  /** Nur als Auslöser: ändern sich die Ausgaben, wird neu gerechnet. */
  readonly expenses = input.required<TripExpense[]>();
  readonly canEdit = input(true);

  private readonly api = inject(ReisenApi);
  readonly data = signal<TripBalances | null>(null);
  readonly failed = signal(false);
  readonly busy = signal<string | null>(null);
  readonly message = signal('');

  readonly settled = computed(() => !!this.data() && !this.data()!.transfers.length);
  readonly anyPaid = computed(() => this.data()?.people.some((p) => Number(p.paid) > 0) ?? false);

  constructor() {
    effect(() => {
      const id = this.trip().id;
      this.expenses();
      untracked(() => this.load(id));
    });
  }

  load(id = this.trip().id): void {
    this.failed.set(false);
    this.api.balances(id).subscribe({
      next: (data) => this.data.set(data),
      error: () => this.failed.set(true),
    });
  }

  money(value: string | number): string {
    return formatMoney(value, this.data()?.currency || this.trip().currency);
  }
  /** „bekommt 70 €“ / „schuldet 70 €“ / „ausgeglichen“ */
  state(balance: string): { text: string; tone: 'plus' | 'minus' | 'even' } {
    const value = Number(balance);
    if (value > 0) return { text: `bekommt ${this.money(value)}`, tone: 'plus' };
    if (value < 0) return { text: `schuldet ${this.money(-value)}`, tone: 'minus' };
    return { text: 'ausgeglichen', tone: 'even' };
  }
  key(t: { from_user: number; to_user: number }): string {
    return `${t.from_user}-${t.to_user}`;
  }

  settle(t: TripBalances['transfers'][number]): void {
    if (this.busy()) return;
    this.busy.set(this.key(t));
    this.api.settle({ trip: this.trip().id, from_user: t.from_user, to_user: t.to_user, amount: t.amount }).subscribe({
      next: () => {
        this.busy.set(null);
        this.message.set(`Vermerkt: ${t.from_name} hat ${t.to_name} ${this.money(t.amount)} gegeben.`);
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.message.set('Das konnte nicht gespeichert werden. Bitte versuche es noch einmal.');
      },
    });
  }
  undo(id: number): void {
    if (this.busy()) return;
    this.busy.set(`s${id}`);
    this.api.removeSettlement(id).subscribe({
      next: () => {
        this.busy.set(null);
        this.message.set('Vermerk zurückgenommen.');
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.message.set('Das konnte nicht zurückgenommen werden. Bitte versuche es noch einmal.');
      },
    });
  }
  shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  }
}
