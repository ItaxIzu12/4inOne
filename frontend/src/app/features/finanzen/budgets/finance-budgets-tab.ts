import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { AppIcon } from '../../../shared/icons/app-icon';
import { Modal } from '../../../shared/modal/modal';
import { TermHint } from '../../../shared/term-hint/term-hint';
import { winningBudget } from '../data/private-finance-api.service';
import { FinanceDateNav } from '../shared/finance-date-nav';
import { categoryBudgetStatus, categoryIcon } from '../shared/finance-tabs';
import { BudgetYearOverview } from './budget-timeline';
import { BudgetYearCard } from './budget-year-card';
import { FINANCE_CONTEXT, TransactionKind } from '../finance-context';

/** Finanzen › Budgets: Monatsbudget, Kategorie-Budgets, Budgetstatus und „Dein Jahr“.
 * Gemeinsamer Zustand (Monat, Daten, Dialog) über FINANCE_CONTEXT von PrivateFinance; Verhalten unverändert. */
@Component({
  selector: 'app-finance-budgets-tab',
  standalone: true,
  imports: [AppIcon, BudgetYearCard, BudgetYearOverview, FinanceDateNav, Modal, TermHint],
  templateUrl: './finance-budgets-tab.html',
  // Reihenfolge wie vor der Aufteilung: Diagramme, Bausteine, Finanz-Look, späte Bausteine, eigene Regeln
  styleUrls: ['../shared/finance-charts.scss', '../shared/finance-blocks.scss', '../shared/_fin-look.scss', '../shared/finance-blocks-late.scss', './finance-budgets-tab.scss'],
})
export class FinanceBudgetsTab {
  protected readonly ctx = inject(FINANCE_CONTEXT);
  // Gemeinsame Werte und Aktionen unter ihrem gewohnten Namen (Template unverändert)
  protected readonly section = this.ctx.section;
  protected readonly month = this.ctx.month;
  protected readonly budgets = this.ctx.budgets;
  protected readonly savingsHint = this.ctx.savingsHint;
  protected readonly plannedSaved = this.ctx.plannedSaved;
  protected readonly plannedItems = this.ctx.plannedItems;
  protected readonly plannedTotal = this.ctx.plannedTotal;
  protected readonly spentNow = this.ctx.spentNow;
  protected readonly bookedSaved = this.ctx.bookedSaved;
  protected readonly monthYear = this.ctx.monthYear;
  protected readonly yearSummary = this.ctx.yearSummary;
  protected readonly overBudget = this.ctx.overBudget;
  protected readonly daysLeft = this.ctx.daysLeft;
  protected readonly perDay = this.ctx.perDay;
  protected readonly freeShare = this.ctx.freeShare;
  protected readonly Math = Math;
  protected readonly monthShort = this.ctx.monthShort;
  protected readonly savedNow = this.ctx.savedNow;
  protected readonly catBudgets = this.ctx.catBudgets;
  protected readonly categoryIcon = this.ctx.categoryIcon;
  protected readonly eur = this.ctx.eur.bind(this.ctx);
  protected readonly share = this.ctx.share.bind(this.ctx);
  protected readonly openCategories = this.ctx.openCategories.bind(this.ctx);
  protected readonly rows = this.ctx.rows;
  protected readonly activeBudget = this.ctx.activeBudget;
  protected readonly monthLabel = this.ctx.monthLabel;
  protected readonly span = this.ctx.span;
  protected readonly plan = this.ctx.plan;
  protected readonly open = this.ctx.open.bind(this.ctx);
  protected readonly amount = this.ctx.amount.bind(this.ctx);
  protected readonly summary = this.ctx.summary;

  /** Gebundenes Budget: Ausgaben plus Gespartes — Sparen ist nicht „verbraucht“, bindet aber Budget (Balken der Rest-Karte). */
  readonly used = computed(() =>
    String(Number(this.ctx.summary()?.spent ?? this.ctx.summary()?.expenses ?? 0) + Number(this.ctx.summary()?.planned ?? 0) + Number(this.ctx.summary()?.saved ?? 0)),
  );
  readonly budgetStatus = categoryBudgetStatus;
  /** Jahresübersicht als Dialog statt dauerhaft unter dem Budget. */
  readonly yearOpen = signal(false);
  readonly yearPlanned = computed(() => {
    const year = this.ctx.monthYear();
    return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`).filter((m) =>
      winningBudget(this.ctx.budgets(), m),
    ).length;
  });
  readonly spentShare = computed(() => this.ctx.percent(this.used(), this.ctx.summary()?.total));
  /** Budgetstatus nur bei echten Überschreitungen — „fast ausgeschöpft“ steht schon in der Kategorie-Zeile. */
  readonly overCategories = computed(() => this.ctx.catBudgets().filter((b) => b.left < 0));
  readonly showBudgetStatus = computed(() => this.overCategories().length > 0 || !!this.ctx.overBudget());
  /** Drilldown: aus einer Budgetzahl direkt zur passenden, gefilterten Transaktionsliste desselben Monats — ein Klick. */
  showTransactions(kind: TransactionKind, categoryId?: number) {
    this.ctx.tab.set('transactions');
    this.ctx.selectKind(kind);
    if (categoryId !== undefined) this.ctx.categoryFilter.set(String(categoryId));
    afterNextRender(() => document.getElementById('all-rows')?.focus({ preventScroll: false }), { injector: this.ctx.renderInjector });
  }
  /** Monat aus der Jahresübersicht: Dialog schließen, Monat anzeigen; ein Jahreswechsel im Dialog lädt nur nach. */
  pickYearMonth(value: string) {
    if (value === this.ctx.month()) return this.yearOpen.set(false);
    const sameYear = value.slice(0, 4) === this.ctx.month().slice(0, 4);
    // Jahr gewechselt: der Dialog bleibt offen, der Fokus kehrt zur Jahresauswahl zurück.
    this.ctx.budgetFocus = sameYear ? null : 'year';
    this.ctx.setMonth(value);
    if (sameYear) this.yearOpen.set(false);
  }
  /** „Budgets je Monat“ öffnen; die Liste scrollt selbst — der gewählte Monat wird in den sichtbaren Teil geholt. */
  openYear() {
    this.yearOpen.set(true);
    afterNextRender(
      () => document.querySelector('app-budget-year .budget-month.is-selected')?.scrollIntoView({ block: 'nearest' }),
      { injector: this.ctx.renderInjector },
    );
  }
  /** Säule in „Dein Jahr“: Monat anzeigen und zur Budget-Kopfkarte scrollen, damit der Wechsel sichtbar ist (Fokus
   * bleibt auf der Säule — Tastatur- und Screenreader-Nutzer verlieren ihre Stelle nicht). */
  pickYearBar(value: string) {
    if (value !== this.ctx.month()) this.ctx.setMonth(value);
    const motion = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    afterNextRender(() => document.querySelector('.fin-hero--budget')?.scrollIntoView({ block: 'start', behavior: motion }), {
      injector: this.ctx.renderInjector,
    });
  }
}
