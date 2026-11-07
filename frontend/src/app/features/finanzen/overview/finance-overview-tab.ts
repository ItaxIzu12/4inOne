import { Component, afterNextRender, computed, inject } from '@angular/core';
import { AppIcon } from '../../../shared/icons/app-icon';
import { SpendCurveChart } from '../../../shared/spend-curve/spend-curve';
import { spendCurve, spendingBudget } from '../../../shared/spend-curve/spend-curve-data';
import { TermHint } from '../../../shared/term-hint/term-hint';
import { FinanceDateNav } from '../shared/finance-date-nav';
import { groupByDay } from '../shared/finance-overview';
import { categoryIcon, goalIcon, goalPercent } from '../shared/finance-tabs';
import { FinancePeriodView } from './finance-period';
import { FINANCE_CONTEXT, FinanceTab, LegacyTab, REVIEW_KEY } from '../finance-context';

/** Finanzen › Übersicht: Monatsbühne, erste Schritte, Monatsrückblick, letzte Transaktionen, Hinweise, Budgets und Sparziele im Blick.
 * Gemeinsamer Zustand (Monat, Daten, Dialog) über FINANCE_CONTEXT von PrivateFinance; Verhalten unverändert. */
@Component({
  selector: 'app-finance-overview-tab',
  standalone: true,
  imports: [AppIcon, FinanceDateNav, FinancePeriodView, SpendCurveChart, TermHint],
  templateUrl: './finance-overview-tab.html',
  // Reihenfolge wie vor der Aufteilung: Diagramme, Bausteine, Finanz-Look, späte Bausteine, eigene Regeln
  styleUrls: ['../shared/finance-charts.scss', '../shared/finance-blocks.scss', '../shared/_fin-look.scss', '../shared/finance-blocks-late.scss', './finance-overview-tab.scss'],
})
export class FinanceOverviewTab {
  protected readonly ctx = inject(FINANCE_CONTEXT);
  // Gemeinsame Werte und Aktionen unter ihrem gewohnten Namen (Template unverändert)
  protected readonly importOpen = this.ctx.importOpen;
  protected readonly section = this.ctx.section;
  protected readonly period = this.ctx.period;
  protected readonly periodDay = this.ctx.periodDay;
  protected readonly periodRange = this.ctx.periodRange;
  protected readonly dataVersion = this.ctx.dataVersion;
  protected readonly month = this.ctx.month;
  protected readonly summary = this.ctx.summary;
  protected readonly categories = this.ctx.categories;
  protected readonly transactions = this.ctx.transactions;
  protected readonly budgets = this.ctx.budgets;
  protected readonly goals = this.ctx.goals;
  protected readonly startSteps = this.ctx.startSteps;
  protected readonly showStart = this.ctx.showStart;
  protected readonly plannedHint = this.ctx.plannedHint;
  protected readonly savingsHint = this.ctx.savingsHint;
  protected readonly review = this.ctx.review;
  protected readonly reviewBudget = this.ctx.reviewBudget;
  protected readonly money = this.ctx.money;
  protected readonly plannedSaved = this.ctx.plannedSaved;
  protected readonly plannedTotal = this.ctx.plannedTotal;
  protected readonly spentNow = this.ctx.spentNow;
  protected readonly bookedSaved = this.ctx.bookedSaved;
  protected readonly overBudget = this.ctx.overBudget;
  protected readonly daysLeft = this.ctx.daysLeft;
  protected readonly perDay = this.ctx.perDay;
  protected readonly freeShare = this.ctx.freeShare;
  protected readonly dayGroupLabel = this.ctx.dayGroupLabel.bind(this.ctx);
  protected readonly Math = Math;
  protected readonly monthShort = this.ctx.monthShort;
  protected readonly incomeNow = this.ctx.incomeNow;
  protected readonly delta = this.ctx.delta.bind(this.ctx);
  protected readonly expenseDelta = this.ctx.expenseDelta;
  protected readonly savedNow = this.ctx.savedNow;
  protected readonly savedDelta = this.ctx.savedDelta;
  protected readonly catBudgets = this.ctx.catBudgets;
  protected readonly hints = this.ctx.hints;
  protected readonly goalPercent = this.ctx.goalPercent;
  protected readonly goalIcon = this.ctx.goalIcon;
  protected readonly categoryIcon = this.ctx.categoryIcon;
  protected readonly eur = this.ctx.eur.bind(this.ctx);
  protected readonly rowTitle = this.ctx.rowTitle.bind(this.ctx);
  protected readonly selectTab = this.ctx.selectTab.bind(this.ctx);
  protected readonly openCategories = this.ctx.openCategories.bind(this.ctx);
  protected readonly rows = this.ctx.rows;
  protected readonly monthLabel = this.ctx.monthLabel;
  protected readonly Number = Number;
  protected readonly span = this.ctx.span;
  protected readonly range = this.ctx.range;
  protected readonly categoryName = this.ctx.categoryName.bind(this.ctx);
  protected readonly categoryColor = this.ctx.categoryColor.bind(this.ctx);
  protected readonly open = this.ctx.open.bind(this.ctx);
  protected readonly amount = this.ctx.amount.bind(this.ctx);

  hideReview(month: string) {
    this.ctx.reviewHidden.update((list) => [...list, month]);
    try {
      localStorage.setItem(REVIEW_KEY, JSON.stringify(this.ctx.reviewHidden().slice(-12)));
    } catch {
      /* privater Modus: dann eben nur bis zum Neuladen ausgeblendet */
    }
  }
  /** Monat ohne Budget und ohne jede Bewegung — dann keine Kopfkarte aus Nullen, keine leeren Karten. */
  readonly emptyMonth = computed(() => {
    const s = this.ctx.summary();
    return !!s && s.total === null && !s.has_data;
  });
  readonly recentDays = computed(() => groupByDay(this.ctx.summary()?.recent ?? []));
  /**
   * Übersicht wie in Banking-Apps: Ausgabenkurve des Monats (aufsummiert bis heute, gestrichelt das Budget-Tempo) —
   * nur aus echten Transaktionen und dem Monatsstand, nichts hochgerechnet. Tagessatz: `perDay`.
   */
  readonly curve = computed(() => {
    const s = this.ctx.summary();
    return spendCurve(this.ctx.transactions(), this.ctx.month(), spendingBudget(s?.total, s?.saved));
  });
  readonly incomeDelta = computed(() => this.ctx.delta('INCOME'));
  /** Übersicht: ohne „Monatsbudget prüfen“ (sagt die Kopfkarte) und ohne „liegt im Plan“ (sagt die Zielkarte). */
  readonly overviewHints = computed(() => this.ctx.hints().filter((h) => h.key !== 'budget' && !h.key.startsWith('track-')));
  /** Zur vollständigen Liste im Reiter springen. */
  showAll(tab: FinanceTab | LegacyTab) {
    this.ctx.selectTab(tab);
    afterNextRender(() => document.getElementById('all-rows')?.scrollIntoView({ block: 'start' }), {
      injector: this.ctx.renderInjector,
    });
  }
}
