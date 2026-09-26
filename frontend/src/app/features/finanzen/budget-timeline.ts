import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { MONTH_NAMES, MONTH_SHORT } from '../../shared/form/date-utils';
import { FinanceBudget, budgetCovers, budgetSpan, euros, winningBudget } from './private-finance-api.service';

interface Bar {
  budget: FinanceBudget;
  /** Spalte 1–12 (Jan–Dez) von/bis einschließlich, im angezeigten Jahr. */
  from: number;
  to: number;
  row: number;
  active: boolean;
  /** Beginnt vor dem angezeigten Jahr / läuft darüber hinaus bzw. „bis auf Weiteres“. */
  cutStart: boolean;
  openEnd: boolean;
  label: string;
  range: string;
  description: string;
}

/**
 * Die Zeiträume aller Budgets als Zeitleiste über ein Jahr: jedes Budget ein Balken über seine Monate.
 * Sichtbar wird, WANN welches Budget gilt und wo sich Zeiträume überlagern (Balken liegen dann in eigenen Zeilen).
 * Kräftig ist das Budget, das im gewählten Monat gilt. Die Regel dafür ist dieselbe wie im Backend
 * (`budgetCovers`, später beginnendes Budget gewinnt).
 */
@Component({
  selector: 'app-budget-timeline',
  standalone: true,
  templateUrl: './budget-timeline.html',
  styleUrl: './budget-timeline.scss',
})
export class BudgetTimeline {
  readonly budgets = input.required<FinanceBudget[]>();
  /** Der gewählte Monat („JJJJ-MM“). */
  readonly month = input.required<string>();
  /** Ein Monatsname wurde angeklickt. */
  readonly monthPick = output<string>();

  protected readonly viewYear = signal(new Date().getFullYear());
  protected readonly names = MONTH_NAMES;
  protected readonly short = MONTH_SHORT;
  protected readonly columns = Array.from({ length: 12 }, (_, i) => i);

  constructor() {
    // Wechselt der gewählte Monat in ein anderes Jahr, folgt die Ansicht.
    effect(() => {
      const year = Number(this.month().slice(0, 4));
      if (year) untracked(() => this.viewYear.set(year));
    });
  }

  protected shift(delta: number): void {
    this.viewYear.update((y) => y + delta);
  }

  protected ym(index: number): string {
    return `${this.viewYear()}-${String(index + 1).padStart(2, '0')}`;
  }

  /** Index (0–11) des gewählten Monats im angezeigten Jahr, sonst null. */
  protected readonly selectedIndex = computed(() => {
    const [year, month] = this.month().split('-').map(Number);
    return year === this.viewYear() ? month - 1 : null;
  });

  /** Das Budget, das im gewählten Monat gilt (später beginnendes gewinnt). */
  private readonly activeId = computed(() => {
    const covering = this.budgets()
      .filter((b) => budgetCovers(b, this.month()))
      .sort((a, b) => b.month.localeCompare(a.month));
    return covering[0]?.id ?? null;
  });

  /** Jeder Monat gehört genau einem Budget (dem mit dem spätesten Start). Ein Balken ist deshalb eine
   * zusammenhängende Strecke, in der dasselbe Budget gilt — überdeckte Monate eines älteren Budgets bleiben leer,
   * es stehen nie zwei Beträge übereinander. Ein Budget kann dadurch in mehrere Strecken zerfallen. */
  protected readonly bars = computed<Bar[]>(() => {
    const year = this.viewYear();
    const budgets = this.budgets();
    const bars: Bar[] = [];
    let run: { budget: FinanceBudget; from: number } | null = null;
    const flush = (to: number) => {
      if (!run) return;
      const { budget, from } = run;
      const start = budget.month.slice(0, 7);
      const end = budget.open_ended ? '9999-12' : (budget.end_month ?? budget.month).slice(0, 7);
      const money = euros(budget.amount);
      bars.push({
        budget,
        from,
        to,
        row: 0,
        active: budget.id === this.activeId() && this.selectedIndex() !== null && this.selectedIndex()! + 1 >= from && this.selectedIndex()! + 1 <= to,
        cutStart: start < `${year}-${String(from).padStart(2, '0')}`,
        openEnd: to === 12 && end > `${year}-12`,
        label: money.replace(',00 ', ' '),
        range: budgetSpan(budget),
        description: `Budget ${money}, ${budgetSpan(budget)}`,
      });
      run = null;
    };
    for (let month = 1; month <= 12; month++) {
      const winner = winningBudget(budgets, this.ym(month - 1));
      if (run && winner?.id !== run.budget.id) flush(month - 1);
      if (winner && !run) run = { budget: winner, from: month };
    }
    flush(12);
    return bars;
  });

  /** Für schmale Bildschirme: eine Karte je Budget, das im Jahr irgendwo gilt; `months` = seine Monate. */
  protected readonly cards = computed(() => {
    const byId = new Map<number, { bar: Bar; months: Set<number> }>();
    for (const bar of this.bars()) {
      const entry = byId.get(bar.budget.id) ?? { bar, months: new Set<number>() };
      for (let m = bar.from; m <= bar.to; m++) entry.months.add(m);
      byId.set(bar.budget.id, entry);
    }
    return [...byId.values()].sort((a, b) => a.bar.from - b.bar.from);
  });

  protected readonly rowCount = computed(() => Math.max(1, ...this.bars().map((b) => b.row + 1)));
}
