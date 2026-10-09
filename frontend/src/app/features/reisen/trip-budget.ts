import { Component, computed, input, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { Trip, TripBudgetCategory, TripExpense } from './reisen-api.service';
import { BUDGET_META, budgetRows, formatMoney, percent, totalBudget } from './reisen-logic';

const RECENT = 6;

/** Reise › Budget: eigenständig, ohne Finanzen. Gesamtbudget, ausgegeben, verbleibend; geplant gegen ausgegeben je
 * Kategorie; die Ausgaben dieser Reise. Ohne Budget und Ausgaben ein klarer Leerzustand statt „0 € / 0 %“. */
@Component({
  selector: 'app-trip-budget',
  imports: [AppIcon],
  templateUrl: './trip-budget.html',
  styleUrls: ['./trip-common.scss', './trip-budget.scss'],
})
export class TripBudget {
  readonly trip = input.required<Trip>();
  readonly planned = input.required<TripBudgetCategory[]>();
  readonly expenses = input.required<TripExpense[]>();
  readonly canEdit = input(true);
  readonly addExpense = output<void>();
  readonly editExpense = output<TripExpense>();
  readonly editPlan = output<void>();

  readonly meta = BUDGET_META;
  readonly showAll = signal(false);

  readonly total = computed(() => totalBudget(this.trip(), this.planned()));
  readonly spent = computed(() => this.expenses().reduce((s, e) => s + Number(e.amount), 0));
  readonly left = computed(() => this.total() - this.spent());
  readonly spentPct = computed(() => percent(this.spent(), this.total()));
  readonly rows = computed(() => budgetRows(this.planned(), this.expenses()));
  readonly blank = computed(() => !this.total() && !this.expenses().length);
  readonly sorted = computed(() => [...this.expenses()].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id));
  readonly shown = computed(() => (this.showAll() ? this.sorted() : this.sorted().slice(0, RECENT)));
  /** Vor der Reise gezahlt? Dann steht es dabei — Flüge und Hotels werden oft Monate vorher bezahlt. */
  readonly before = computed(() => this.trip().start_date);

  money(value: number | string, compact = true): string {
    return formatMoney(value, this.trip().currency, compact);
  }
  shortDate(iso: string): string {
    return new Date(`${iso}T12:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  barWidth(pct: number): number {
    return Math.min(100, Math.max(0, pct));
  }
}
