import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AppIcon } from '../../shared/icons/app-icon';
import { ReisenApi, Trip, TripBudgetCategory, TripExpense, TripSavingsGoal } from './reisen-api.service';
import { BUDGET_META, budgetRows, formatMoney, percent, totalBudget } from './reisen-logic';
import { TripSwitcher } from './trip-switcher';

const RECENT = 5;

/** Reiter „Budget“: Kennzahlen, geplant/ausgegeben je Kategorie, letzte Ausgaben und der Bezug zu Finanzen. */
@Component({
  selector: 'app-trip-budget',
  imports: [AppIcon, TripSwitcher],
  templateUrl: './trip-budget.html',
  styleUrls: ['./trip-common.scss', './trip-budget.scss'],
})
export class TripBudget {
  private api = inject(ReisenApi);
  private router = inject(Router);
  private destroy = inject(DestroyRef);

  readonly trip = input.required<Trip>();
  readonly trips = input.required<Trip[]>();
  readonly planned = input.required<TripBudgetCategory[]>();
  readonly expenses = input.required<TripExpense[]>();
  readonly canEdit = input(true);
  readonly switchTrip = output<number>();
  readonly addExpense = output<void>();
  readonly editExpense = output<TripExpense>();
  readonly editPlan = output<void>();

  readonly meta = BUDGET_META;
  readonly showAll = signal(false);
  readonly savings = signal<TripSavingsGoal[]>([]);

  readonly total = computed(() => totalBudget(this.trip(), this.planned()));
  readonly spent = computed(() => this.expenses().reduce((s, e) => s + Number(e.amount), 0));
  readonly left = computed(() => this.total() - this.spent());
  readonly spentPct = computed(() => percent(this.spent(), this.total()));
  readonly rows = computed(() => budgetRows(this.planned(), this.expenses()));
  readonly saved = computed(() => this.savings().reduce((s, g) => s + Number(g.current_amount), 0));
  readonly recent = computed(() => {
    const sorted = [...this.expenses()].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    return this.showAll() ? sorted : sorted.slice(0, RECENT);
  });
  readonly hasMore = computed(() => this.expenses().length > RECENT);

  constructor() {
    effect(() => {
      const id = this.trip().id;
      untracked(() =>
        this.api
          .savings(id)
          .pipe(takeUntilDestroyed(this.destroy))
          // Nur Zusatzinformation: fehlt sie, bleibt das Budget voll nutzbar.
          .subscribe({ next: (goals) => this.savings.set(goals), error: () => this.savings.set([]) }),
      );
    });
  }

  money(value: number | string, compact = true): string {
    return formatMoney(value, this.trip().currency, compact);
  }
  shortDate(iso: string): string {
    return new Date(`${iso}T12:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  private financePath(): string {
    return this.router.url.startsWith('/demo') ? '/demo/finanzen' : '/finanzen';
  }
  openFinance() {
    void this.router.navigateByUrl(this.financePath());
  }
  createGoal() {
    void this.router.navigate([this.financePath()], { queryParams: { goal: 'new', title: `Reise: ${this.trip().title}` } });
  }
  barWidth(pct: number): number {
    return Math.min(100, Math.max(0, pct));
  }
}
