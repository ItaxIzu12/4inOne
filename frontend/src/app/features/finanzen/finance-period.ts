import { Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { AppIcon } from '../../shared/icons/app-icon';
import { weekRangeLabel } from '../../shared/dates/calendar-week';
import {
  FinanceCategory,
  FinanceSummary,
  FinanceTransaction,
  PrivateFinanceApi,
  SavingsContributionDto,
  UNCATEGORISED_COLOR,
} from './private-finance-api.service';
import {
  FinancePeriod,
  PERIOD_LABELS,
  PeriodRange,
  customRangeError,
  customRangeHelp,
  exactMonth,
  reachesFuture,
  numericDate,
  periodTotals,
  rangeFor,
  todayIso,
  topCategories,
} from './finance-periods';

const PERIODS: FinancePeriod[] = ['day', 'week', 'month', 'custom'];
const LIST_LIMIT = 10;

/**
 * Zeitraum-Umschalter der Finanz-Übersicht: Heute · Woche · Monat · Benutzerdefiniert. Die Datumsauswahl selbst steht
 * oben in der Seite (private-finance.html), in jedem Zeitraum an derselben Stelle.
 *
 * „Monat“ ist die Budgetansicht und bleibt in der Seite selbst (private-finance.html); diese Komponente zeigt dann
 * nur den Umschalter. Für Tag, Woche und eigenen Zeitraum zeigt sie, was passiert ist — Ausgaben, Einnahmen,
 * Sparbeiträge und Buchungen — ohne künstliches Tages- oder Zeitraumbudget (Ausgaben verteilen sich nicht gleichmäßig).
 * Der Tag bleibt über „Monat im Blick“ mit dem Monatsbudget verbunden.
 */
@Component({
  selector: 'app-finance-period',
  imports: [AppIcon],
  templateUrl: './finance-period.html',
  styleUrl: './finance-period.scss',
})
export class FinancePeriodView {
  private api = inject(PrivateFinanceApi);
  private destroy = inject(DestroyRef);

  readonly period = model<FinancePeriod>('month');
  /** Bezugstag für „Heute“ und „Woche“ */
  readonly day = model(todayIso());
  readonly range = model<PeriodRange>({ from: `${todayIso().slice(0, 7)}-01`, to: todayIso() });
  readonly transactions = input.required<FinanceTransaction[]>();
  readonly categories = input.required<FinanceCategory[]>();
  /** Bei einer Änderung (neue Buchung, Sparziel) neu laden */
  readonly version = input(0);
  readonly openTransaction = output<FinanceTransaction>();
  readonly showExpenses = output<void>();

  readonly periods = PERIODS;
  readonly labels = PERIOD_LABELS;
  readonly today = todayIso();
  protected readonly numericDate = numericDate;
  readonly contributions = signal<SavingsContributionDto[]>([]);
  /** Lange Listen (Woche, eigener Zeitraum) zunächst gekürzt */
  readonly showAll = signal(false);
  readonly visibleRows = computed(() => (this.showAll() ? this.totals().rows : this.totals().rows.slice(0, LIST_LIMIT)));
  readonly hiddenCount = computed(() => Math.max(0, this.totals().rows.length - LIST_LIMIT));
  readonly monthSummary = signal<FinanceSummary | null>(null);

  readonly rangeIssue = computed(() => (this.period() === 'custom' ? customRangeError(this.range()) : null));
  readonly rangeError = computed(() => this.rangeIssue()?.message ?? null);
  readonly rangeHelp = computed(() => customRangeHelp(this.range()));
  /** Zeitraum reicht in die Zukunft: es erscheinen nur bereits erfasste Buchungen, nichts wird hochgerechnet. */
  readonly future = computed(() => this.period() === 'custom' && !this.rangeError() && reachesFuture(this.range(), this.today));
  /** Genau ein Kalendermonat gewählt → dessen echtes Monatsbudget; sonst kein Restbudget. */
  readonly matchingMonth = computed(() => (this.period() === 'custom' && !this.rangeError() ? exactMonth(this.range()) : null));
  readonly rangeBudget = signal<FinanceSummary | null>(null);
  readonly matchingMonthLabel = computed(() => {
    const month = this.matchingMonth();
    return month ? new Date(`${month}-01T12:00`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) : '';
  });
  readonly current = computed(() => rangeFor(this.period(), this.day(), this.range()));
  readonly totals = computed(() => periodTotals(this.transactions(), this.contributions(), this.current()));
  readonly isEmpty = computed(() => !this.totals().rows.length && this.totals().saved === 0);
  readonly top = computed(() => topCategories(this.totals().rows, this.categories(), UNCATEGORISED_COLOR));
  /** Der Zeitraum in Worten — dieselben Begriffe (Einnahmen, Ausgaben, Gespart, Transaktionen) in jeder Ansicht,
   * nur diese Zeile ändert sich: „heute“, „am 05.10.2026“, „diese Woche“, „01.10.2026 – 31.10.2026“. */
  readonly scope = computed(() => {
    const range = this.current();
    if (this.period() === 'day') return this.day() === this.today ? 'heute' : `am ${numericDate(this.day())}`;
    if (this.period() === 'week') {
      return range.from <= this.today && this.today <= range.to ? 'diese Woche' : weekRangeLabel(this.day());
    }
    return `${numericDate(range.from)} – ${numericDate(range.to)}`;
  });
  /** „Monat im Blick“ gehört zum Monat des gewählten Tags: „diesen Monat“ nur im laufenden Monat, sonst „im September 2026“. */
  readonly monthWords = computed(() => {
    const month = this.day().slice(0, 7);
    if (month === this.today.slice(0, 7)) return { when: 'diesen Monat', dative: 'für diesen Monat' };
    const name = new Date(`${month}-01T12:00`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    return { when: `im ${name}`, dative: `für ${name}` };
  });
  readonly emptyText = computed(() =>
    this.period() === 'day'
      ? this.day() === this.today
        ? 'Heute noch keine Finanzbewegungen.'
        : `Am ${numericDate(this.day())} gab es keine Finanzbewegungen.`
      : this.period() === 'week'
        ? 'In dieser Woche gab es keine Finanzbewegungen.'
        : 'Im gewählten Zeitraum gab es keine Finanzbewegungen.',
  );

  constructor() {
    // Sparbeiträge des Zeitraums vollständig nachladen (die allgemeine Liste enthält nur die letzten).
    effect(() => {
      const period = this.period();
      const range = this.current();
      this.version();
      if (period === 'month' || this.rangeError()) return;
      untracked(() =>
        this.api
          .contributions(range.from, range.to)
          .pipe(catchError(() => of([] as SavingsContributionDto[])), takeUntilDestroyed(this.destroy))
          .subscribe((rows) => this.contributions.set(rows)),
      );
    });
    // Passendes Monatsbudget für einen eigenen Zeitraum, der genau einen Kalendermonat abdeckt.
    effect(() => {
      const month = this.matchingMonth();
      this.version();
      this.rangeBudget.set(null);
      if (!month) return;
      untracked(() =>
        this.api
          .summary(month)
          .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroy))
          .subscribe((summary) => {
            if (this.matchingMonth() === month) this.rangeBudget.set(summary);
          }),
      );
    });
    // „Monat im Blick“ gehört zum Monat des gewählten Tags.
    effect(() => {
      const month = this.day().slice(0, 7);
      this.version();
      if (this.period() !== 'day') return;
      untracked(() =>
        this.api
          .summary(month)
          .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroy))
          .subscribe((summary) => this.monthSummary.set(summary)),
      );
    });
  }

  /** Start- und Enddatum vertauscht eingegeben: mit einem Klick richtigstellen. */
  swapRange() {
    this.range.update((r) => ({ from: r.to, to: r.from }));
  }
  select(period: FinancePeriod) {
    this.period.set(period);
    this.showAll.set(false);
  }
  money(value: number | string): string {
    const n = Number(value);
    return `${n.toLocaleString('de-DE', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;
  }
  categoryName(id: number | null): string {
    return this.categories().find((c) => c.id === id)?.name ?? 'Sonstiges';
  }
  categoryColor(id: number | null): string {
    return this.categories().find((c) => c.id === id)?.color ?? UNCATEGORISED_COLOR;
  }
  rowTitle(row: FinanceTransaction): string {
    return row.note || this.categoryName(row.category);
  }
  shortDate(iso: string): string {
    return new Date(`${iso}T12:00`).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  }
}
