import { Component, computed, input, output } from '@angular/core';
import { MONTH_NAMES } from '../../shared/form/date-utils';
import { FinanceBudget, euros, winningBudget } from './private-finance-api.service';

@Component({
  selector: 'app-budget-year',
  standalone: true,
  templateUrl: './budget-timeline.html',
  styleUrl: './budget-timeline.scss',
})
export class BudgetYearOverview {
  readonly budgets = input.required<FinanceBudget[]>();
  readonly month = input.required<string>();
  readonly monthPick = output<string>();
  protected readonly year = computed(() => Number(this.month().slice(0, 4)));
  protected readonly today = new Date();
  protected readonly currentMonth = `${this.today.getFullYear()}-${String(this.today.getMonth() + 1).padStart(2, '0')}`;
  protected readonly money = euros;
  protected readonly years = computed(() => {
    const values = [this.today.getFullYear(), this.year(), ...this.budgets().flatMap(b =>
      [Number(b.month.slice(0, 4)), Number((b.end_month ?? b.month).slice(0, 4))])];
    const first = Math.max(1, Math.min(...values) - 1);
    const last = Math.min(9999, Math.max(...values) + 2);
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  });
  protected readonly months = computed(() => MONTH_NAMES.map((name, index) => {
    const month = `${this.year()}-${String(index + 1).padStart(2, '0')}`;
    return { name, month, budget: winningBudget(this.budgets(), month) };
  }));
  protected readonly planned = computed(() => this.months().filter(m => !!m.budget).length);
  protected changeYear(event: Event): void {
    this.monthPick.emit(`${(event.target as HTMLSelectElement).value}-${this.month().slice(5, 7)}`);
  }
}
