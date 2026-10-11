import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { isInCalendarWeek } from '../../shared/dates/calendar-week';
import { MobileAction } from '../../shared/mobile-action/mobile-action';
import { AmountInput } from '../../shared/directives/amount-input';
import { afterNextRender, Injector, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { catchError, forkJoin, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppShell } from '../../layout/app-shell';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { normalizeMoneyInput } from '../../shared/currency/money-input';
import { ConnectionsSection } from '../../shared/connections/connections-section';
import { AppDatePicker } from '../../shared/form/date-picker';
import { BudgetYearOverview } from './budget-timeline';
import { budgetBand, categoryVisual, daysLeftInMonth, groupByDay, shiftMonth, splitAmount } from './finance-overview';
import {
  axis,
  categoryBudgetStatus,
  budgetsFromSummary,
  categoryIcon,
  categorySlices,
  dayLabel,
  deltaEuro,
  deltaLabel,
  donut,
  expenseSplit,
  goalIcon,
  goalNearlyDone,
  goalOnTrack,
  goalPercent,
  incomeSources,
  insights,
  monthName,
  monthTotal,
  monthlyBars,
  fixedKey,
  recurringItems,
  savedInMonth,
  shiftYm,
  shortMonthYear,
  sourceIcon,
  weeklyBars,
} from './finance-tabs';
import { defaultDateInMonth, display } from '../../shared/form/date-utils';
import { Field } from '../../shared/form/field';
import { AppSelect, SelectOption } from '../../shared/form/select';
import { SaveFeedback } from '../../shared/save-feedback/save-feedback';
import { FinanceImportDialog } from './finance-import-dialog';
import { ModalForm } from '../../shared/form/modal-form';
import { Modal } from '../../shared/modal/modal';
import {
  PrivateFinanceApi,
  FinanceCategory,
  FinanceTransaction,
  PlannedItem,
  FinanceBudget,
  SavingsGoal,
  FinanceSummary,
  SavingsContributionDto,
  financeMonth,
  budgetCovers,
  budgetRange,
  budgetSpan,
  winningBudget,
  budgetOverride,
  planRange,
  goalCovers,
  GoalPreview,
  euros,
  MAX_CATEGORY_NAME,
  UNCATEGORISED_COLOR,
} from './private-finance-api.service';
import { CategoryManager } from './category-manager';
import { FinancePeriodView } from './finance-period';
import { FinancePeriod, PeriodRange, addDays, customRangeError, todayIso, weekTitle } from './finance-periods';
type Resource = 'transactions' | 'budgets' | 'goals';
/** Hauptreiter. Ausgaben und Einnahmen sind keine eigenen Reiter mehr, sondern Ansichten unter „Transaktionen“ —
 * dieselben Daten (ein Transaction-Modell mit type EXPENSE/INCOME), nur anders gruppiert. */
export type FinanceTab = 'overview' | 'transactions' | 'budgets' | 'goals';
/** Ansicht innerhalb von „Transaktionen“ */
export type TransactionKind = 'all' | 'expenses' | 'income' | 'planned';
/** Frühere Reiter-Schlüssel (Links, Lesezeichen, interne Sprünge) → neue Navigation */
type LegacyTab = 'expenses' | 'income';
const FINANCE_TABS: { key: FinanceTab; label: string; icon: IconName }[] = [
  { key: 'overview', label: 'Übersicht', icon: 'home' },
  { key: 'transactions', label: 'Transaktionen', icon: 'list' },
  { key: 'budgets', label: 'Budgets', icon: 'bars' },
  { key: 'goals', label: 'Sparziele', icon: 'piggy' },
];
const TRANSACTION_KINDS: { key: TransactionKind; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'expenses', label: 'Ausgaben' },
  { key: 'income', label: 'Einnahmen' },
  { key: 'planned', label: 'Geplant' },
];
/** Eine Zeile der Transaktionsliste: echte Transaktion oder geplante wiederkehrende Ausgabe (noch keine Transaktion). */
export type ListRow = FinanceTransaction & { planned?: boolean; plannedItem?: PlannedItem };
/** Die erste verständliche Fehlermeldung aus der API-Antwort (z. B. „gespart darf das Ziel nicht überschreiten“). */
function apiMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  for (const value of Object.values(body as Record<string, unknown>)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string' && first.length < 200) return first;
  }
  return null;
}
/** „In diesem Monat“ / „Im 11.2026“ — nur wenn die Sparraten nicht reichen und nicht ohnehin das Budget überschritten ist. */
function planAlertMessage(summary: FinanceSummary | null, shownMonth: string): string | null {
  const alert = summary?.plan_alert;
  if (!alert) return null;
  const when = alert.month === shownMonth ? 'In diesem Monat' : `Im ${alert.month.slice(5)}.${alert.month.slice(0, 4)}`;
  return `${when} reicht das Monatsbudget nach Ausgaben nicht für alle Sparraten: Es fehlen ${euros(alert.over)}.`;
}
/** Die Sätze der Warnung vor dem Speichern eines Sparziels; leer = alles in Ordnung. */
function goalWarningSentences(preview: GoalPreview): string[] {
  const sentences: string[] = [];
  if (preview.month_over)
    sentences.push(
      `${preview.month_over.month === new Date().toLocaleDateString('sv-SE').slice(0, 7) ? 'In diesem Monat' : `Im ${preview.month_over.month.slice(5)}.${preview.month_over.month.slice(0, 4)}`} reicht das Monatsbudget nach Ausgaben dafür nicht: Es fehlen ${euros(preview.month_over.over)}.`,
    );
  const alert = preview.plan_alert;
  if (alert && !(preview.month_over && alert.month === preview.month_over.month)) {
    sentences.push(
      `Im ${alert.month.slice(5)}.${alert.month.slice(0, 4)} reicht das Monatsbudget nach Ausgaben nicht für alle Sparraten: Es fehlen ${euros(alert.over)}.`,
    );
  }
  return sentences;
}
function payloadAmount(payload: object): string {
  return (payload as { current_amount?: string }).current_amount ?? '0';
}
@Component({
  selector: 'app-private-finance',
  standalone: true,
  imports: [Modal, NgTemplateOutlet, MobileAction, ErrorNoticeDirective, AmountInput, ReactiveFormsModule, DatePipe, AppShell, AppIcon, ConnectionsSection, Field, ModalForm, SaveFeedback, AppSelect, AppDatePicker, BudgetYearOverview, CategoryManager, FinancePeriodView, FinanceImportDialog],
  templateUrl: './private-finance.html',
  // Abschnitte zuerst, damit die Handy-Regeln in private-finance.scss sie überschreiben.
  styleUrls: ['./finance-sections.scss', './private-finance.scss'],
})
export class PrivateFinance {
  private api = inject(PrivateFinanceApi);
  private fb = inject(FormBuilder);
  private destroy = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  /** Reiter: Übersicht, Ausgaben, Einnahmen, Budgets, Sparziele. */
  readonly tab = signal<FinanceTab>('overview');
  readonly txKind = signal<TransactionKind>('all');
  readonly txKinds = TRANSACTION_KINDS;
  /** Kontoauszug-Import (CSV) geöffnet. */
  readonly importOpen = signal(false);
  /** Was gerade zu sehen ist: Übersicht, Alle/Ausgaben/Einnahmen (unter Transaktionen), Budgets oder Sparziele. */
  readonly section = computed(() => (this.tab() === 'transactions' ? this.txKind() : this.tab()));
  /** Zeitraum der Übersicht: Monat ist die Budgetansicht (Standard), Tag/Woche/eigener Zeitraum zeigen nur Bewegungen. */
  readonly period = signal<FinancePeriod>('month');
  readonly periodDay = signal(todayIso());
  readonly periodRange = signal<PeriodRange>({ from: `${todayIso().slice(0, 7)}-01`, to: todayIso() });
  /** Die Monatsauswahl im Kopf gilt überall — außer in der Übersicht mit Tag, Woche oder eigenem Zeitraum. */
  readonly monthNavigation = computed(() => this.tab() !== 'overview' || this.period() === 'month');
  /** Welche Datumsauswahl oben steht: in der Übersicht folgt sie dem Zeitraum, sonst immer der Monat. */
  readonly navMode = computed<FinancePeriod>(() => (this.tab() === 'overview' ? this.period() : 'month'));
  readonly todayDay = todayIso();
  /** Zurück zum aktuellen Zeitraum der Ansicht — nur, wenn man ihn verlassen hat (wie im Organisation-Kalender):
   * „Aktueller Tag“, „Aktuelle Woche“ (Mo–So) oder „Aktueller Monat“. Der eigene Zeitraum hat keinen. */
  readonly jumpLabel = computed(() => {
    switch (this.navMode()) {
      case 'day':
        return this.periodDay() !== this.todayDay ? 'Aktueller Tag' : '';
      case 'week':
        return isInCalendarWeek(this.periodDay(), this.todayDay) ? '' : 'Aktuelle Woche';
      case 'month':
        return this.month() !== this.todayDay.slice(0, 7) ? 'Aktueller Monat' : '';
      default:
        return '';
    }
  });
  jumpToCurrent() {
    if (this.navMode() === 'month') this.setMonth(this.todayDay.slice(0, 7));
    else this.setDay(this.todayDay);
  }
  readonly weekLabel = computed(() => weekTitle(this.periodDay()));
  readonly rangeIssue = computed(() => (this.navMode() === 'custom' ? customRangeError(this.periodRange()) : null));
  stepPeriod(delta: number) {
    this.setDay(addDays(this.periodDay(), this.period() === 'week' ? delta * 7 : delta));
  }
  /** Tag und Woche teilen sich mit dem Monat EIN Bezugsdatum: wandert der Tag in einen anderen Monat,
   * folgt der Monat (Budgets, Transaktionen, Sparziele zeigen dann diesen Monat). */
  setDay(day: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    this.periodDay.set(day);
    if (day.slice(0, 7) !== this.month()) this.setMonth(day.slice(0, 7), false);
  }
  setRangeFrom(value: string) {
    this.periodRange.update((r) => ({ ...r, from: value }));
  }
  setRangeTo(value: string) {
    this.periodRange.update((r) => ({ ...r, to: value }));
  }
  /** Wird nach jedem Laden hochgezählt, damit die Zeitraumansicht ihre Sparbeiträge neu holt. */
  readonly dataVersion = signal(0);
  /** Eine feste Hauptaktion im ganzen Bereich (Kopf am Rechner, fest unten am Handy): „+ Transaktion“.
   * Budget ändern und Sparziel erstellen stehen als Sekundäraktionen in ihren Reitern. */
  readonly headAction = computed(() => 'Transaktion');
  headActionClick() {
    this.open('transactions');
    // Auf „Einnahmen“ ist die Einnahme vorausgewählt — sonst wie bisher die Ausgabe.
    if (this.section() === 'income') this.form.controls.type.setValue('INCOME');
  }
  readonly tabs = FINANCE_TABS;
  readonly month = signal(financeMonth());
  readonly summary = signal<FinanceSummary | null>(null);
  readonly categories = signal<FinanceCategory[]>([]);
  readonly transactions = signal<FinanceTransaction[]>([]);
  readonly budgets = signal<FinanceBudget[]>([]);
  readonly goals = signal<SavingsGoal[]>([]);
  /** Einzahlungen in Sparziele (neueste zuerst) — „Gespart“, „Letzte Einzahlungen“, Monatsverlauf. */
  readonly contributions = signal<SavingsContributionDto[]>([]);
  readonly loading = signal(true);
  /** Bestätigung nach Speichern/Löschen — mit dem neuen verfügbaren Betrag. */
  readonly notice = signal('');
  /** Gesetzt, wenn die Ausgabe im Dialog das verfügbare Budget überschreiten würde (wartet auf Bestätigung). */
  /** Sätze der Warnung vor dem Speichern eines Sparziels (wartet auf Bestätigung), sonst null. */
  readonly goalWarning = signal<string[] | null>(null);
  readonly overrun = signal<{ available: string; over: string } | null>(null);
  private pending: { text: string; month: string | null } | null = null;
  private noticeTimer?: ReturnType<typeof setTimeout>;
  readonly error = signal('');
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly editor = signal<Resource | null>(null);
  readonly editId = signal<number | undefined>(undefined);
  readonly typeFilter = signal('ALL');
  readonly money = euros;
  readonly goalStatus = { ACTIVE: 'Aktiv', COMPLETED: 'Erreicht', PAUSED: 'Pausiert' };
  readonly editorTitle = computed(() => {
    const noun = { transactions: 'Transaktion', budgets: 'Budget', goals: 'Sparziel' }[this.editor() ?? 'goals'];
    return `${noun} ${this.editId() ? 'bearbeiten' : 'erstellen'}`;
  });
  /** Gebundenes Budget: Ausgaben plus Gespartes — Sparen ist nicht „verbraucht“, bindet aber Budget (Balken der Rest-Karte). */
  readonly used = computed(() =>
    String(Number(this.summary()?.spent ?? this.summary()?.expenses ?? 0) + Number(this.summary()?.planned ?? 0) + Number(this.summary()?.saved ?? 0)),
  );
  /** Davon nur eingeplante Sparraten (noch nicht verbucht) — getrennt ausgewiesen, nie als Ausgabe. */
  readonly plannedSaved = computed(() => Number(this.summary()?.saved_planned ?? 0));
  /** Geplante Ausgaben des Monats (Server): Datum nach heute oder wiederkehrend, noch nicht gebucht. */
  readonly plannedItems = computed(() => this.summary()?.planned_items ?? []);
  readonly plannedTotal = computed(() => Number(this.summary()?.planned ?? 0));
  /** Bis heute gebuchte Ausgaben (Server); fällt auf alle Ausgaben des Monats zurück, solange die Zahl fehlt. */
  readonly spentNow = computed(() => Number(this.summary()?.spent ?? this.summary()?.expenses ?? 0));
  private readonly plannedRecurringKeys = computed(
    () => new Set(this.plannedItems().filter((i) => i.kind === 'RECURRING').map((i) => i.key)),
  );
  /** Status eines wiederkehrenden Postens im angezeigten Monat: geplant (im Budget berücksichtigt) oder gebucht. */
  fixedStatus(item: { last: FinanceTransaction }): 'planned' | 'booked' | null {
    if (this.plannedRecurringKeys().has(fixedKey(item.last.note, item.last.category))) return 'planned';
    if (this.transactions().some((t) => t.type === item.last.type && t.date.startsWith(this.month())
      && fixedKey(t.note, t.category) === fixedKey(item.last.note, item.last.category))) return 'booked';
    return null;
  }
  /** Tatsächlich gespart (verbuchte Sparbeiträge) im Monat. */
  readonly bookedSaved = computed(() => Math.max(0, Number(this.summary()?.saved ?? 0) - this.plannedSaved()));
  readonly budgetStatus = categoryBudgetStatus;
  /** Jahresübersicht als Dialog statt dauerhaft unter dem Budget. */
  readonly yearOpen = signal(false);
  readonly monthYear = computed(() => this.month().slice(0, 4));
  readonly yearPlanned = computed(() => {
    const year = this.monthYear();
    return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`).filter((m) =>
      winningBudget(this.budgets(), m),
    ).length;
  });
  /** Um wie viel das verfügbare Budget überschritten ist (positiver Betrag), sonst null. */
  readonly overBudget = computed(() => {
    const available = this.summary()?.available;
    return available?.startsWith('-') ? available.slice(1) : null;
  });
  /** Hinweis, wenn die Sparraten zusammen mehr reservieren als das Monatsbudget nach Ausgaben hergeben. */
  readonly planAlertText = computed(() => planAlertMessage(this.summary(), this.month()));

  // ---------- Übersicht ----------
  /** Der große Betrag der Monatsbühne, die Cents getrennt (kleiner gesetzt). */
  readonly heroAmount = computed(() => {
    const over = this.overBudget();
    return splitAmount(this.money(over ?? this.summary()?.available ?? '0'));
  });
  /** Tage bis Monatsende (heute mitgezählt); 0 für vergangene Monate. */
  readonly daysLeft = computed(() => daysLeftInMonth(this.month()));
  /** Was pro verbleibendem Tag frei ist — nur, wenn es etwas zu verteilen gibt. */
  readonly perDay = computed(() => {
    const available = Number(this.summary()?.available ?? 0);
    const days = this.daysLeft();
    return available > 0 && days > 0 ? String(Math.floor(available / days)) : null;
  });
  readonly freeShare = computed(() => this.percent(this.summary()?.available, this.summary()?.total));
  readonly band = computed(() => budgetBand(this.summary()));
  readonly recentDays = computed(() => groupByDay(this.summary()?.recent ?? []));
  readonly categoryVisual = categoryVisual;
  /** Anteil einer Kategorie an allen Ausgaben, für die Rangliste. */
  categoryShare(amount: string) {
    return this.percent(amount, this.summary()?.expenses);
  }
  /** Wie viele Ausgaben dieses Monats in die Kategorie fallen (ohne Kategorie: id null). */
  bookingCount(categoryId: number | null) {
    return this.transactions().filter(
      (t) => t.type === 'EXPENSE' && t.date.startsWith(this.month()) && (t.category ?? null) === categoryId,
    ).length;
  }
  readonly bandLabel = computed(() =>
    this.band().map((seg) => `${seg.label} ${this.money(seg.amount.toFixed(2))}`).join(', '),
  );
  protected readonly Math = Math;

  // ---------- Reiter: Kennzahlen und Diagramme (finance-tabs.ts) ----------
  readonly prevMonth = computed(() => shiftYm(this.month(), -1));
  readonly monthShort = computed(() => monthName(this.month()));
  readonly incomeNow = computed(() => monthTotal(this.transactions(), this.month(), 'INCOME'));
  readonly expenseNow = computed(() => monthTotal(this.transactions(), this.month(), 'EXPENSE'));
  readonly incomeDelta = computed(() =>
    deltaLabel(this.incomeNow(), monthTotal(this.transactions(), this.prevMonth(), 'INCOME'), this.prevMonth()),
  );
  readonly expenseDelta = computed(() =>
    deltaLabel(this.expenseNow(), monthTotal(this.transactions(), this.prevMonth(), 'EXPENSE'), this.prevMonth()),
  );
  readonly savedNow = computed(() => savedInMonth(this.contributions(), this.month()));
  readonly savedDelta = computed(() =>
    deltaEuro(this.savedNow(), savedInMonth(this.contributions(), this.prevMonth()), this.prevMonth()),
  );
  readonly weeks = computed(() => weeklyBars(this.transactions(), this.contributions(), this.month()));
  readonly weekAxis = computed(() => axis(Math.max(0, ...this.weeks().flatMap((w) => [w.income, w.expense, w.saved]))));
  readonly incomeAxis = computed(() => axis(Math.max(0, ...this.weeks().map((w) => w.income))));
  readonly expenseMonths = computed(() => monthlyBars(this.transactions(), this.month(), 'EXPENSE'));
  readonly expenseMonthsAxis = computed(() => axis(Math.max(0, ...this.expenseMonths().map((m) => m.value))));
  readonly expenseSlices = computed(() => categorySlices(this.transactions(), this.categories(), this.month()));
  readonly expenseDonut = computed(() => donut(this.expenseSlices()));
  readonly sources = computed(() => incomeSources(this.transactions(), this.categories(), this.month()));
  readonly recurringExpenses = computed(() => recurringItems(this.transactions(), 'EXPENSE', this.month()));
  readonly recurringIncome = computed(() => recurringItems(this.transactions(), 'INCOME', this.month()));
  readonly split = computed(() => expenseSplit(this.transactions(), this.month()));
  readonly fixedIncome = computed(() =>
    this.transactions()
      .filter((t) => t.type === 'INCOME' && t.recurring && t.date.startsWith(this.month()))
      .reduce((sum, t) => sum + Number(t.amount), 0),
  );
  readonly prevIncome = computed(() => monthTotal(this.transactions(), this.prevMonth(), 'INCOME'));
  /** Kategorie-Budgets vom Server: Limit, ausgegeben, geplant, verfügbar (keine eigene Rechnung im Browser). */
  readonly catBudgets = computed(() => budgetsFromSummary(this.summary()?.budget_categories, this.categories()));
  readonly spentShare = computed(() => this.percent(this.used(), this.summary()?.total));
  readonly monthExpenses = computed(() =>
    this.transactions().filter((t) => t.type === 'EXPENSE' && t.date.startsWith(this.month())).slice(0, 6),
  );
  readonly monthIncome = computed(() =>
    this.transactions().filter((t) => t.type === 'INCOME' && t.date.startsWith(this.month())).slice(0, 5),
  );
  readonly activeGoals = computed(() => this.goals().filter((g) => g.status === 'ACTIVE'));
  readonly goalsOnTrack = computed(() => this.activeGoals().filter((g) => goalOnTrack(g, this.month())).length);
  readonly goalsNearlyDone = computed(() => this.activeGoals().filter(goalNearlyDone).length);
  readonly plannedRate = computed(() =>
    this.activeGoals().reduce((sum, g) => sum + Number(g.monthly_amount ?? 0), 0),
  );
  readonly hints = computed(() =>
    insights({
      month: this.month(),
      budget: this.summary()?.total ? Number(this.summary()!.total) : null,
      available: this.summary()?.available != null ? Number(this.summary()!.available) : null,
      categoryBudgets: this.catBudgets(),
      goals: this.goals(),
    }),
  );
  readonly goalPercent = goalPercent;
  readonly goalIcon = goalIcon;
  readonly goalOnTrack = (goal: SavingsGoal) => goalOnTrack(goal, this.month());
  readonly categoryIcon = categoryIcon;
  readonly dayLabel = dayLabel;
  readonly monthName = monthName;
  readonly shortMonthYear = shortMonthYear;
  readonly sourceIcon = sourceIcon;

  /** Beträge für Kennzahlen: runde ohne Cent („3.000 €“), sonst genau („2.951,68 €“). */
  eur(value: number | string | null | undefined): string {
    const n = Math.round(Number(value ?? 0) * 100) / 100;
    const digits = Number.isInteger(n) ? 0 : 2;
    return `${n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })} €`;
  }
  /** Anteil (0–100) einer Zahl an einer anderen, gerundet. */
  share(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 100) : 0;
  }
  /** Höhe eines Balkens in Prozent der Achse. */
  barHeight(value: number, top: number): number {
    return top > 0 ? Math.max(value > 0 ? 2 : 0, (value / top) * 100) : 0;
  }
  /** Hinweis im Formular, wenn eine geplante wiederkehrende Ausgabe als Transaktion erfasst wird. */
  readonly plannedSource = signal<PlannedItem | null>(null);
  /** Klick auf eine Zeile: echte Transaktion bearbeiten — eine geplante wiederkehrende öffnet das Formular vorbelegt,
   * Speichern erfasst sie für ihr Datum (danach zählt sie als gebucht statt geplant, nie doppelt). */
  openRow(row: ListRow) {
    if (!row.plannedItem) return this.open('transactions', row);
    const item = row.plannedItem;
    this.open('transactions');
    this.form.patchValue({ amount: item.amount, type: 'EXPENSE', category: String(item.category ?? ''), date: item.date, note: item.title, recurring: true });
    this.plannedSource.set(item);
  }
  rowTitle(row: FinanceTransaction): string {
    return row.note || this.categoryName(row.category);
  }
  /** Hauptreiter wählen. Die früheren Schlüssel „expenses“/„income“ führen zu Transaktionen › Ausgaben/Einnahmen. */
  selectTab(tab: FinanceTab | LegacyTab) {
    if (tab === 'expenses' || tab === 'income') {
      this.tab.set('transactions');
      this.selectKind(tab);
      return;
    }
    this.tab.set(tab);
    if (tab === 'transactions') this.selectKind(this.txKind());
    else this.resetListFilters('ALL');
  }
  /** Ansicht unter „Transaktionen“: die Liste zeigt nur den passenden Typ. */
  selectKind(kind: TransactionKind) {
    this.txKind.set(kind);
    this.resetListFilters(kind === 'expenses' || kind === 'planned' ? 'EXPENSE' : kind === 'income' ? 'INCOME' : 'ALL');
  }
  /** Drilldown: aus einer Budgetzahl direkt zur passenden, gefilterten Transaktionsliste desselben Monats — ein Klick. */
  showTransactions(kind: TransactionKind, categoryId?: number) {
    this.tab.set('transactions');
    this.selectKind(kind);
    if (categoryId !== undefined) this.categoryFilter.set(String(categoryId));
    afterNextRender(() => document.getElementById('all-rows')?.focus({ preventScroll: false }), { injector: this.renderInjector });
  }
  private resetListFilters(type: string) {
    this.typeFilter.set(type);
    this.categoryFilter.set('');
    this.transactionSearch.set('');
  }
  onTabKeydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const keys = FINANCE_TABS.map((t) => t.key);
    const index = keys.indexOf(this.tab());
    const next = keys[(index + (event.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length];
    this.selectTab(next);
    queueMicrotask(() => document.getElementById(`fin-tab-${next}`)?.focus());
  }
  /** Zur vollständigen Liste im Reiter springen. */
  showAll(tab: FinanceTab | LegacyTab) {
    this.selectTab(tab);
    afterNextRender(() => document.getElementById('all-rows')?.scrollIntoView({ block: 'start' }), {
      injector: this.renderInjector,
    });
  }

  // ---------- Kategorien verwalten (Name, Limit, eigene, löschen) ----------
  readonly categoriesOpen = signal(false);
  openCategories() {
    this.categoriesOpen.set(true);
  }
  categoriesSaved(message: string) {
    this.categoriesOpen.set(false);
    this.remember(message, null);
    this.load();
  }

  // ---------- Neue Kategorie direkt im Buchungsformular ----------
  readonly quickCategory = signal<string | null>(null);
  readonly quickCategoryError = signal('');
  readonly maxCategoryName = MAX_CATEGORY_NAME;
  startQuickCategory() {
    this.quickCategory.set('');
    this.quickCategoryError.set('');
    afterNextRender(() => document.getElementById('quick-category')?.focus(), { injector: this.renderInjector });
  }
  cancelQuickCategory() {
    this.quickCategory.set(null);
    this.quickCategoryError.set('');
  }
  createQuickCategory() {
    const name = (this.quickCategory() ?? '').trim().replace(/\s+/g, ' ');
    if (this.saving()) return;
    if (!name) {
      this.quickCategoryError.set('Gib der Kategorie einen Namen.');
      return;
    }
    const existing = this.categories().find((c) => c.name.toLocaleLowerCase('de') === name.toLocaleLowerCase('de'));
    if (existing) {
      // Gibt es schon: einfach auswählen statt einen Fehler zu zeigen.
      this.form.controls.category.setValue(String(existing.id));
      this.cancelQuickCategory();
      return;
    }
    this.saving.set(true);
    this.api
      .createCategory({ name, monthly_goal: null })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (created) => {
          this.saving.set(false);
          this.categories.update((all) => [...all, created].sort((a, b) => a.name.localeCompare(b.name, 'de')));
          this.form.controls.category.setValue(String(created.id));
          this.cancelQuickCategory();
          afterNextRender(() => document.getElementById('booking-new-category')?.focus(), { injector: this.renderInjector });
        },
        error: (e) => {
          this.saving.set(false);
          this.quickCategoryError.set(
            (e?.status === 400 && apiMessage(e.error)) || 'Die Kategorie konnte nicht angelegt werden. Bitte versuche es erneut.',
          );
        },
      });
  }

  stepMonth(delta: number) {
    this.setMonth(shiftMonth(this.month(), delta));
  }
  readonly categoryFilter = signal('');
  readonly transactionSearch = signal('');
  /** Wie viele der gefilterten/gesuchten Buchungen aktuell sichtbar sind — „Weitere anzeigen“ erhöht ihn um 5,
   * ein Wechsel von Monat, Filter, Kategorie oder Suche setzt ihn zurück. */
  readonly rowLimit = signal(5);
  /** Alle Zeilen des Monats: Transaktionen (mit Datum nach heute als „geplant“ markiert) plus geplante wiederkehrende
   * Ausgaben, die noch keine Transaktion sind — so steht jede geplante Ausgabe auch in der Liste. */
  readonly monthRows = computed<ListRow[]>(() => {
    const today = todayIso();
    const real: ListRow[] = this.transactions()
      .filter((t) => t.date.startsWith(this.month()))
      .map((t) => (t.type === 'EXPENSE' && t.date > today ? { ...t, planned: true } : t));
    const virtual: ListRow[] = this.plannedItems()
      .filter((i) => i.kind === 'RECURRING')
      .map((i) => ({
        id: -(i.source_id ?? 0), amount: i.amount, type: 'EXPENSE', category: i.category as number, date: i.date,
        note: i.title, currency: 'EUR', recurring: true, planned: true, plannedItem: i,
      }));
    // Reihenfolge der echten Zeilen bleibt wie von der API (neueste zuerst); geplante wiederkehrende werden nach
    // Datum dazwischen eingefügt.
    const merged = [...real];
    for (const row of virtual.sort((a, b) => b.date.localeCompare(a.date))) {
      const at = merged.findIndex((r) => r.date < row.date);
      merged.splice(at === -1 ? merged.length : at, 0, row);
    }
    return merged;
  });
  readonly matchingRows = computed(() => {
    const query = this.transactionSearch().trim().toLocaleLowerCase('de');
    const category = this.categoryFilter();
    const plannedOnly = this.txKind() === 'planned' && this.tab() === 'transactions';
    return this.monthRows().filter(
      (t) =>
        (plannedOnly ? !!t.planned : this.typeFilter() === 'ALL' || t.type === this.typeFilter()) &&
        (!category || String(t.category) === category) &&
        (!query || (t.note || this.categoryName(t.category)).toLocaleLowerCase('de').includes(query)),
    );
  });
  /** Summe der sichtbaren geplanten Zeilen (für die Überschrift unter „Geplant“). */
  readonly matchingPlannedTotal = computed(() =>
    this.matchingRows().filter((r) => r.planned).reduce((sum, r) => sum + Number(r.amount), 0),
  );
  readonly rows = computed(() => this.matchingRows().slice(0, this.rowLimit()));
  readonly moreRowsCount = computed(() => Math.max(0, this.matchingRows().length - this.rowLimit()));
  /** Kategorien-Filter der Buchungen: nur Kategorien, die im Monat tatsächlich vorkommen — eine leere Auswahl
   * (Kategorie ohne Buchungen im Monat) wäre nur verwirrend. */
  readonly categoryFilterOptions = computed<SelectOption[]>(() => {
    const used = new Set(this.monthRows().map((t) => t.category));
    return [
      { value: '', label: 'Alle Kategorien' },
      ...this.categories()
        .filter((c) => used.has(c.id))
        .map((c) => ({ value: String(c.id), label: c.name, color: c.color })),
    ];
  });
  /** Das Budget, das für den angezeigten Monat gilt: bei Überschneidung das mit dem späteren Start. */
  readonly activeBudget = computed(() =>
    this.budgets()
      .filter((b) => budgetCovers(b, this.month()))
      .sort((a, b) => b.month.localeCompare(a.month))[0],
  );
  // Auswahllisten der Dropdowns; die Kategorien tragen ihre feste Farbe als Punkt.
  readonly typeOptions: SelectOption[] = [
    { value: 'EXPENSE', label: 'Ausgabe' },
    { value: 'INCOME', label: 'Einnahme' },
  ];
  readonly filterOptions: SelectOption[] = [
    { value: 'ALL', label: 'Alle Transaktionen' },
    { value: 'EXPENSE', label: 'Ausgaben' },
    { value: 'INCOME', label: 'Einnahmen' },
  ];
  readonly scopeOptions: SelectOption[] = [
    { value: 'single', label: 'Nur diesen Monat' },
    { value: 'until', label: 'Mehrere Monate' },
    { value: 'open', label: 'Bis auf Weiteres' },
  ];
  readonly statusOptions: SelectOption[] = [
    { value: 'ACTIVE', label: 'Aktiv' },
    { value: 'COMPLETED', label: 'Erreicht' },
    { value: 'PAUSED', label: 'Pausiert' },
  ];
  /** Kategorien als Chips im Buchungsformular — die zuletzt am häufigsten genutzten zuerst, damit die übliche Wahl
   * ein Tipp ist (Schnellerfassung). Gleichstand: Reihenfolge der Kategorienliste. */
  readonly categoryChips = computed(() => {
    const uses = new Map<number, number>();
    for (const t of this.transactions()) uses.set(t.category, (uses.get(t.category) ?? 0) + 1);
    return this.categories()
      .map((c, index) => ({ c, index, n: uses.get(c.id) ?? 0 }))
      .sort((a, b) => b.n - a.n || a.index - b.index)
      .map(({ c }) => ({ value: String(c.id), label: c.name, color: c.color }));
  });
  /** „September 2026“ für Überschriften, die den gewählten Monat nennen. */
  readonly monthLabel = computed(() => display(this.month(), 'month'));
  protected readonly Number = Number;
  readonly span = budgetSpan;
  /** Only records in the selected month belong in this contextual deletion note. */
  readonly budgetImpact = computed(() => {
    if (this.editor() !== 'budgets' || !this.editId()) return null;
    return {
      transactions: this.transactions().filter(row => row.date.startsWith(this.month())).length,
      goals: this.goals().filter(goal => goalCovers(goal, this.month())).length,
    };
  });
  budgetImpactNote(): string | null {
    const impact = this.budgetImpact();
    if (!impact || (!impact.transactions && !impact.goals)) return null;
    const parts = [
      impact.transactions ? `${impact.transactions} ${impact.transactions === 1 ? 'Transaktion' : 'Transaktionen'}` : '',
      impact.goals ? `${impact.goals} ${impact.goals === 1 ? 'Sparziel' : 'Sparziele'}` : '',
    ].filter(Boolean);
    return `Im ${this.monthLabel()} sind ${parts.join(' und ')} vorhanden. Beim Löschen dieses Budgets bleiben diese Einträge erhalten.`;
  }
  /** Hinweis im Budget-Dialog, wenn ein anderes, später beginnendes Budget einen Teil des Zeitraums übernimmt. */
  budgetOverrideNote(): string | null {
    const v = this.form.getRawValue();
    if (this.editor() !== 'budgets' || !v.month) return null;
    const others = this.budgets().filter((b) => b.id !== this.editId());
    const found = budgetOverride({ start: v.month, end: v.scope === 'until' ? v.end_month : '', open: v.scope === 'open' }, others);
    if (!found) return null;
    const from = display(found.from, 'month');
    const when = found.to === null ? `Ab ${from}` : found.to === found.from ? `Im ${from}` : `Von ${from} bis ${display(found.to, 'month')}`;
    return `${when} gilt bereits ein anderes Budget und hat dort Vorrang. Dieses Budget zählt in diesem Zeitraum nicht.`;
  }
  range = budgetRange;
  readonly plan = planRange;
  readonly form = this.fb.nonNullable.group({
    amount: [''],
    type: ['EXPENSE'],
    category: [''],
    date: [''],
    note: ['', Validators.maxLength(255)],
    recurring: [false],
    month: [''],
    scope: ['single'],
    end_month: [''],
    rate: [''],
    plan_scope: ['single'],
    plan_start: [''],
    plan_end: [''],
    title: ['', Validators.maxLength(120)],
    target_amount: [''],
    current_amount: ['0.00'],
    status: ['ACTIVE'],
  });
  private readonly resetRowLimit = effect(() => {
    this.month();
    this.typeFilter();
    this.categoryFilter();
    this.transactionSearch();
    untracked(() => this.rowLimit.set(5));
  });
  protected showMoreRows(): void {
    this.rowLimit.update((n) => n + 5);
  }
  constructor() {
    // Reiter aus der Adresse (?tab=expenses …), wie in Haushalt, Organisation und Reisen.
    const linkedTab = this.route.snapshot.queryParamMap.get('tab');
    if (FINANCE_TABS.some((t) => t.key === linkedTab) || linkedTab === 'expenses' || linkedTab === 'income')
      this.selectTab(linkedTab as FinanceTab | LegacyTab);
    const linkedKind = this.route.snapshot.queryParamMap.get('art');
    if (linkedTab === 'transactions' && TRANSACTION_KINDS.some((k) => k.key === linkedKind)) this.selectKind(linkedKind as TransactionKind);
    this.load();
    this.destroy.onDestroy(() => clearTimeout(this.noticeTimer));
    // Ändert sich etwas im Dialog, gilt die Warnung nicht mehr.
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      this.overrun.set(null);
      this.goalWarning.set(null);
    });
  }
  /** Nach dem Import: Daten neu laden und kurz bestätigen, wie viele Buchungen dazugekommen sind. */
  onImported(created: number) {
    this.notice.set(created === 1 ? '1 Transaktion importiert.' : `${created} Transaktionen importiert.`);
    this.load();
  }
  load() {
    // Nur beim ersten Laden den Ladezustand zeigen: beim Blättern bleibt die Seite (samt Datumsleiste) stehen,
    // sonst verschwindet die Leiste kurz und der Fokus auf dem Pfeil geht verloren.
    this.loading.set(this.summary() === null);
    this.error.set('');
    forkJoin({
      summary: this.api.summary(this.month()),
      categories: this.api.categories(),
      transactions: this.api.transactions(),
      budgets: this.api.budgets(),
      goals: this.api.goals(this.month()),
      // Nur Zusatzinformation: fehlt sie, bleibt die Seite trotzdem nutzbar.
      contributions: this.api.contributions().pipe(catchError(() => of([] as SavingsContributionDto[]))),
    })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.summary.set(r.summary);
          this.categories.set(r.categories);
          this.transactions.set(r.transactions);
          this.budgets.set(r.budgets);
          this.goals.set(r.goals);
          this.contributions.set(r.contributions);
          this.dataVersion.update((v) => v + 1);
          this.loading.set(false);
          this.announcePending(r.summary);
          this.openGoalFromQuery();
          this.openNewFromQuery();
          if (this.budgetFocus) {
            const target = this.budgetFocus;
            this.budgetFocus = null;
            afterNextRender(() => {
              document.querySelector<HTMLElement>(target === 'year'
                ? 'app-budget-year select'
                : 'app-budget-year .budget-month.is-selected')?.focus({ preventScroll: true });
            }, { injector: this.renderInjector });
          }
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Deine Finanzen konnten nicht geladen werden. Bitte versuche es erneut.');
        },
      });
  }
  /** Merkt sich die Meldung; sie erscheint, sobald die neuen Zahlen geladen sind. `month`: der Monat der
   * Buchung — nur wenn er angezeigt wird, ändert sich der verfügbare Betrag sichtbar. null = kein Bezug. */
  private remember(text: string, month: string | null) {
    this.pending = { text, month };
  }
  private announcePending(summary: FinanceSummary) {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    let text = pending.text;
    if (pending.month !== null) {
      if (pending.month !== this.month()) {
        text += ` Sie zählt zu ${pending.month.slice(5)}.${pending.month.slice(0, 4)}, nicht zum angezeigten Monat.`;
      } else if (summary.available !== null) {
        text += ` Vom Monatsbudget übrig: ${euros(summary.available)}.`;
      }
    }
    const alertText = planAlertMessage(summary, this.month());
    if (alertText) text += ` Achtung: ${alertText}`;
    if (pending.month === this.month() && summary.available?.startsWith('-')) {
      text += ` Achtung: Du liegst ${euros(summary.available.slice(1))} über deinem Monatsbudget.`;
    }
    clearTimeout(this.noticeTimer);
    this.notice.set(text);
    this.noticeTimer = setTimeout(() => this.notice.set(''), 6000);
  }
  /** Deep-Link (?goal=<id>) aus „Verknüpft“: zeigt das Sparziel und öffnet es.
   * ?goal=new&title=… öffnet ein neues Sparziel mit vorgeschlagenem Titel (z. B. aus einer Reise in Fremdwährung). */
  /** Schnellerfassung von der Startseite (?neu=buchung): öffnet das bestehende Buchungsformular. Nur dieser feste
   * Wert wird angenommen; die Adresse wird danach aufgeräumt. */
  private openNewFromQuery() {
    if (this.route.snapshot.queryParamMap.get('neu') !== 'buchung') return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { neu: null }, queryParamsHandling: 'merge', replaceUrl: true });
    this.selectTab('transactions');
    this.open('transactions');
  }
  private openGoalFromQuery() {
    const params = this.route.snapshot.queryParamMap;
    const raw = params.get('goal');
    if (!raw) return;
    const title = (params.get('title') ?? '').slice(0, 120);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { goal: null, title: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (raw === 'new') {
      this.tab.set('goals');
      this.open('goals');
      if (title) this.form.patchValue({ title });
      return;
    }
    const id = Number(raw);
    if (!id) return;
    const goal = this.goals().find((g) => g.id === id);
    if (goal) {
      this.tab.set('goals');
      this.open('goals', goal);
    }
  }
  private readonly renderInjector = inject(Injector);
  private budgetFocus: 'year' | 'month' | null = null;
  /** Monat aus der Jahresübersicht: Dialog schließen, Monat anzeigen; ein Jahreswechsel im Dialog lädt nur nach. */
  pickYearMonth(value: string) {
    if (value === this.month()) return this.yearOpen.set(false);
    const sameYear = value.slice(0, 4) === this.month().slice(0, 4);
    // Jahr gewechselt: der Dialog bleibt offen, der Fokus kehrt zur Jahresauswahl zurück.
    this.budgetFocus = sameYear ? null : 'year';
    this.setMonth(value);
    if (sameYear) this.yearOpen.set(false);
  }
  /** Monat wechseln. Der Tag folgt (gemeinsames Bezugsdatum): im laufenden Monat heute, sonst der zuletzt
   * gewählte Tag, wenn er im Monat liegt, sonst der 1. — so landet man in Tag und Woche dort, wo man ist. */
  setMonth(value: string, moveDay = true) {
    if (!/^\d{4}-\d{2}$/.test(value)) return;
    this.month.set(value);
    if (moveDay && this.periodDay().slice(0, 7) !== value) {
      this.periodDay.set(value === this.todayDay.slice(0, 7) ? this.todayDay : `${value}-01`);
    }
    this.load();
  }
  percent(current: string | null | undefined, target: string | null | undefined) {
    return target && Number(target) > 0
      ? Math.min(100, Math.max(0, Math.round((Number(current || 0) / Number(target)) * 100)))
      : target != null && Number(current || 0) > 0 ? 100 : 0;
  }
  categoryName(id: number) {
    return this.categories().find((c) => c.id === id)?.name || 'Sonstiges';
  }
  /** Feste Farbe der Kategorie, überall gleich (Übersicht, Buchungen). */
  categoryColor(id: number | null) {
    return this.categories().find((c) => c.id === id)?.color || UNCATEGORISED_COLOR;
  }
  open(resource: Resource, item?: FinanceTransaction | FinanceBudget | SavingsGoal) {
    this.form.reset({
      amount: '',
      type: 'EXPENSE',
      // Vorauswahl: die meistgenutzte Kategorie (erster Chip) — oft genügen dann Betrag und Speichern.
      category: this.categoryChips()[0]?.value ?? '',
      date: defaultDateInMonth(this.month()),
      note: '',
      recurring: false,
      month: this.month(),
      scope: 'single',
      end_month: '',
      rate: '',
      plan_scope: 'single',
      plan_start: this.month(),
      plan_end: '',
      title: '',
      target_amount: '',
      current_amount: '0.00',
      status: 'ACTIVE',
    });
    this.editor.set(resource);
    this.plannedSource.set(null);
    this.cancelQuickCategory();
    this.overrun.set(null);
    this.goalWarning.set(null);
    this.editId.set(item?.id);
    this.formError.set('');
    if (item) {
      if ('type' in item) this.form.patchValue({ ...item, category: String(item.category), recurring: !!item.recurring });
      else if ('month' in item)
        this.form.patchValue({
          amount: item.amount,
          month: item.month.slice(0, 7),
          scope: item.open_ended ? 'open' : item.end_month && item.end_month !== item.month ? 'until' : 'single',
          end_month: item.end_month ? item.end_month.slice(0, 7) : '',
        });
      else
        this.form.patchValue({
          ...item,
          rate: item.monthly_amount ?? '',
          plan_scope: item.plan_open_ended
            ? 'open'
            : item.plan_end_month && item.plan_end_month !== item.plan_month
              ? 'until'
              : 'single',
          plan_start: item.plan_month ? item.plan_month.slice(0, 7) : this.month(),
          plan_end: item.plan_end_month ? item.plan_end_month.slice(0, 7) : '',
        });
    }
  }
  close() {
    if (!this.saving()) this.editor.set(null);
  }
  setup() {
    if (this.saving()) return;
    this.saving.set(true);
    this.api
      .setupCategories()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (rows) => {
          this.categories.set(rows);
          this.form.controls.category.setValue(String(rows[0]?.id || ''));
          this.saving.set(false);
        },
        error: () => {
          this.saving.set(false);
          this.formError.set('Die Kategorien konnten nicht angelegt werden.');
        },
      });
  }
  amount(value: string, allowZero = false) {
    const cleaned = normalizeMoneyInput(value) ?? 'x';
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(cleaned)) return null;
    const [whole, fraction = ''] = cleaned.split('.');
    const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    if (!allowZero && cents === 0n) return null;
    return `${BigInt(whole)}.${fraction.padEnd(2, '0')}`;
  }
  save() {
    const resource = this.editor();
    if (!resource || this.saving()) return;
    const v = this.form.getRawValue();
    let payload: object;
    const amount = this.amount(v.amount, resource === 'budgets');
    if (resource === 'transactions') {
      if (!amount || !v.date || !v.category) {
        this.formError.set('Bitte Betrag, Kategorie und Datum prüfen.');
        return;
      }
      payload = {
        amount,
        type: v.type,
        category: Number(v.category),
        date: v.date,
        note: v.note,
        currency: 'EUR',
        recurring: v.recurring,
      };
    } else if (resource === 'budgets') {
      if (amount === null || !v.month) {
        this.formError.set('Bitte Monat und Budgetbetrag prüfen.');
        return;
      }
      if (v.scope === 'until' && (!v.end_month || v.end_month < v.month)) {
        this.formError.set('Bitte wähle einen Endmonat, der nicht vor dem Startmonat liegt.');
        return;
      }
      payload = {
        month: v.month + '-01',
        amount,
        currency: 'EUR',
        open_ended: v.scope === 'open',
        end_month: v.scope === 'until' ? v.end_month + '-01' : null,
      };
    } else {
      const target = this.amount(v.target_amount),
        current = this.amount(v.current_amount, true);
      if (!v.title.trim() || !target || current === null) {
        this.formError.set('Bitte Titel und Beträge des Sparziels prüfen.');
        return;
      }
      if (Number(current) > Number(target)) {
        this.formError.set(
          'Der gesparte Betrag darf das Sparziel nicht überschreiten. Erhöhe zuerst das Sparziel.',
        );
        return;
      }
      const rate = v.rate.trim() ? this.amount(v.rate) : null;
      if (v.rate.trim() && rate === null) {
        this.formError.set('Bitte gib eine Sparrate größer als 0 ein.');
        return;
      }
      if (rate !== null && Number(rate) > Number(target)) {
        this.formError.set('Die Sparrate darf nicht höher sein als das Sparziel.');
        return;
      }
      if (!v.plan_start || (v.plan_scope === 'until' && (!v.plan_end || v.plan_end < v.plan_start))) {
        this.formError.set('Bitte wähle einen Startmonat und einen Endmonat, der nicht davor liegt.');
        return;
      }
      payload = {
        title: v.title.trim(),
        target_amount: target,
        current_amount: current,
        status: v.status,
        currency: 'EUR',
        monthly_amount: rate,
        // Der Zeitraum gehört zum Ziel (wann es gilt und angezeigt wird) — unabhängig von einer Sparrate.
        plan_month: v.plan_start + '-01',
        plan_end_month: v.plan_scope === 'until' ? v.plan_end + '-01' : null,
        plan_open_ended: v.plan_scope === 'open',
      };
    }
    if ((resource === 'transactions' && v.note.length > 255) || (resource === 'goals' && v.title.length > 120)) {
      this.formError.set('Bitte prüfe die Länge deiner Angaben.');
      return;
    }
    // Only the current validation result may accompany the budget preview.
    // Clear an earlier failed attempt once every field has passed validation.
    this.formError.set('');
    if (resource === 'transactions' && v.type === 'EXPENSE' && !this.overrun()) {
      this.checkOverrun(v.date.slice(0, 7), Number(amount), () => this.persist(resource, payload, v, amount));
      return;
    }
    if (resource === 'goals' && !this.goalWarning()) {
      this.checkGoal(payload, () => this.persist(resource, payload, v, amount));
      return;
    }
    this.persist(resource, payload, v, amount);
  }
  /** Fragt VOR dem Speichern, ob das Sparziel (Gespartes oder Sparrate) das Budget sprengt; gespeichert wird erst nach Bestätigung. */
  private checkGoal(payload: object, proceed: () => void) {
    this.saving.set(true);
    this.api
      .previewGoal(payload, this.editId())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (preview) => {
          this.saving.set(false);
          const sentences = goalWarningSentences(preview);
          if (sentences.length) this.goalWarning.set(sentences);
          else proceed();
        },
        error: (e) => {
          this.saving.set(false);
          // Ungültige Angaben meldet die Vorschau wie das Speichern; jede andere Störung hält das Speichern nicht auf.
          if (e.status === 400) this.formError.set(apiMessage(e.error) ?? 'Bitte prüfe deine Angaben.');
          else proceed();
        },
      });
  }
  /** Warnt vor dem Speichern, wenn die Ausgabe das verfügbare Budget ihres Monats überschreiten würde.
   * Sie wird nicht verboten (das Geld ist ja ausgegeben), aber erst nach Bestätigung gebucht. */
  private checkOverrun(month: string, amount: number, proceed: () => void) {
    const editing = this.transactions().find((t) => t.id === this.editId());
    // Beim Ändern zählt nur der Mehrbetrag gegenüber der alten Ausgabe im selben Monat.
    const previous = editing && editing.type === 'EXPENSE' && editing.date.startsWith(month) ? Number(editing.amount) : 0;
    const extra = amount - previous;
    if (extra <= 0) return proceed();
    this.saving.set(true);
    const summary$ = month === this.month() && this.summary() ? of(this.summary()!) : this.api.summary(month);
    summary$.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (summary) => {
        this.saving.set(false);
        // Ist die Ausgabe ein vorgemerkter fester Posten, ersetzt sie die Vormerkung — der Betrag ist schon abgezogen.
        const v = this.form.getRawValue();
        const reserved = summary.planned_items?.find((i) => i.kind === 'RECURRING' && i.key === fixedKey(v.note, v.category));
        const effective = extra - (reserved && v.type === 'EXPENSE' ? Number(reserved.amount) : 0);
        if (effective <= 0) return proceed();
        const after = summary.available === null ? null : Number(summary.available) - effective;
        if (summary.available !== null && after !== null && after < 0) {
          this.overrun.set({ available: summary.available, over: (-after).toFixed(2) });
          return;
        }
        proceed();
      },
      // Die Prüfung ist eine Hilfe, keine Bedingung: schlägt sie fehl, wird normal gebucht.
      error: () => {
        this.saving.set(false);
        proceed();
      },
    });
  }
  private persist(resource: Resource, payload: object, v: ReturnType<typeof this.form.getRawValue>, amount: string | null) {
    this.saving.set(true);
    this.formError.set('');
    this.api
      .save(resource, payload, this.editId())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editor.set(null);
          if (resource === 'transactions') {
            const what = v.type === 'INCOME' ? 'Einnahme' : 'Ausgabe';
            // Liegt das Datum außerhalb des angezeigten Monats, taucht die Buchung hier nicht auf — das sagen wir dazu.
            const elsewhere =
              v.date.slice(0, 7) === this.month() ? '' : ` Sie liegt im ${display(v.date.slice(0, 7), 'month')} und steht deshalb nicht in der aktuellen Liste.`;
            this.remember(`${what} von ${euros(amount)} gespeichert.${elsewhere}`, v.date.slice(0, 7));
          } else if (resource === 'budgets') {
            this.remember('Budget gespeichert.', this.month());
          } else {
            // Sparbeträge werden separat geplant; das Monatsbudget bleibt gleich.
            const previous = Number(this.goals().find((g) => g.id === this.editId())?.current_amount ?? 0);
            const changed = Number(payloadAmount(payload)) !== previous;
            const hasPlan = !!(payload as { monthly_amount?: string | null }).monthly_amount;
            const period = payload as { plan_month: string; plan_end_month: string | null; plan_open_ended: boolean };
            const shown = goalCovers(period, this.month());
            this.remember(
              (hasPlan
                ? 'Sparziel gespeichert. Die Sparrate wird in den gewählten Monaten im Restbudget berücksichtigt.'
                : changed
                  ? 'Sparziel gespeichert. Das bereits Gesparte wird im Zeitraum des Sparziels vom Restbudget abgezogen.'
                  : 'Sparziel gespeichert.') +
                (shown
                  ? ''
                  : ` Es gilt nicht im angezeigten Monat und erscheint erst im Zeitraum: ${planRange({ ...(period as object), monthly_amount: null } as SavingsGoal)}.`),
              changed || hasPlan ? this.month() : null,
            );
          }
          this.load();
        },
        error: (e) => {
          this.saving.set(false);
          this.formError.set(
            e.status === 400
              ? (apiMessage(e.error) ??
                  (resource === 'budgets'
                    ? 'Bitte prüfe deine Angaben. Pro Startmonat ist ein Budget möglich.'
                    : 'Bitte prüfe deine Angaben.'))
              : 'Speichern fehlgeschlagen. Bitte versuche es erneut.',
          );
        },
      });
  }
  remove() {
    const resource = this.editor(),
      id = this.editId();
    if (!resource || !id || this.saving()) return;
    this.saving.set(true);
    this.api
      .delete(resource, id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editor.set(null);
          const noun = { transactions: 'Transaktion', budgets: 'Monatsbudget', goals: 'Sparziel' }[resource];
          this.remember(`${noun} gelöscht.`, resource === 'goals' ? null : this.month());
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.formError.set('Löschen fehlgeschlagen. Bitte versuche es erneut.');
        },
      });
  }
}
