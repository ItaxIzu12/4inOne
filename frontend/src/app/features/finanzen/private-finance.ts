import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { MobileAction } from '../../shared/mobile-action/mobile-action';
import { afterNextRender, forwardRef, Injector, Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppShell } from '../../layout/app-shell';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { formatMoneyInput, normalizeMoneyInput } from '../../shared/currency/money-input';
import { budgetBand, categoryVisual, daysLeftInMonth, splitAmount } from './shared/finance-overview';
import { axis, budgetsFromSummary, categoryIcon, dayLabel, compareDay, deltaEuro, deltaLabel, goalIcon, goalPercent, incomeSources, insights, monthName, monthReview, monthTotal, monthTotalUntil, recurringItems, savedInMonth, savedUntil, shiftYm, sourceIcon, weeklyBars } from './shared/finance-tabs';
import { defaultDateInMonth, display } from '../../shared/form/date-utils';
import { SelectOption } from '../../shared/form/select';
import { SaveFeedback } from '../../shared/save-feedback/save-feedback';
import { FinanceImportDialog } from './transactions/finance-import-dialog';
import { PrivateFinanceApi, FinanceCategory, FinanceTransaction, PlannedItem, FinanceBudget, SavingsGoal, FinanceSummary, FinanceYearSummary, SavingsContributionDto, financeMonth, budgetCovers, budgetRange, budgetSpan, planRange, euros, UNCATEGORISED_COLOR } from './data/private-finance-api.service';
import { CategoryManager } from './budgets/category-manager';
import { FinancePeriod, PeriodRange, todayIso } from './overview/finance-periods';
import { FINANCE_CONTEXT, FinanceTab, LegacyTab, ListRow, REVIEW_KEY, Resource, TRANSACTION_KINDS, TransactionKind } from './finance-context';
import { FinanceEditor } from './editor/finance-editor';
import { FinanceOverviewTab } from './overview/finance-overview-tab';
import { FinanceTransactionsTab } from './transactions/finance-transactions-tab';
import { FinanceBudgetsTab } from './budgets/finance-budgets-tab';
import { FinanceGoalsTab } from './goals/finance-goals-tab';
// Bisherige Exporte bleiben über diese Datei erreichbar
export type { FinanceTab, ListRow, TransactionKind } from './finance-context';
const FINANCE_TABS: { key: FinanceTab; label: string; icon: IconName }[] = [
  { key: 'overview', label: 'Übersicht', icon: 'home' },
  { key: 'transactions', label: 'Transaktionen', icon: 'list' },
  { key: 'budgets', label: 'Budgets', icon: 'bars' },
  { key: 'goals', label: 'Sparziele', icon: 'piggy' },
];
/** Ausgeblendete Monatsrückblicke („JJJJ-MM“) aus dem Browser — leer, wenn der Speicher nicht verfügbar ist. */
function readHiddenReviews(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(REVIEW_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((m): m is string => typeof m === 'string' && /^\d{4}-\d{2}$/.test(m)) : [];
  } catch {
    return [];
  }
}
/** „In diesem Monat“ / „Im 11.2026“ — nur wenn die Sparraten nicht reichen und nicht ohnehin das Budget überschritten ist. */
function planAlertMessage(summary: FinanceSummary | null, shownMonth: string): string | null {
  const alert = summary?.plan_alert;
  if (!alert) return null;
  const when = alert.month === shownMonth ? 'In diesem Monat' : `Im ${alert.month.slice(5)}.${alert.month.slice(0, 4)}`;
  return `${when} reicht das Monatsbudget nach Ausgaben nicht für alle Sparraten: Es fehlen ${euros(alert.over)}.`;
}
@Component({
  selector: 'app-private-finance',
  standalone: true,
  imports: [MobileAction, ErrorNoticeDirective, AppShell, AppIcon, SaveFeedback, CategoryManager, FinanceImportDialog, FinanceOverviewTab, FinanceTransactionsTab, FinanceBudgetsTab, FinanceGoalsTab, FinanceEditor],
  templateUrl: './private-finance.html',
  // Die Reiter lesen Zustand und Aktionen über FINANCE_CONTEXT (finance-context.ts)
  providers: [{ provide: FINANCE_CONTEXT, useExisting: forwardRef(() => PrivateFinance) }],
  // Reihenfolge wie vor der Aufteilung: Diagramme, Bausteine, Finanz-Look, späte Bausteine, eigene Regeln
  styleUrls: ['./shared/finance-charts.scss', './shared/finance-blocks.scss', './shared/finance-blocks-late.scss', './private-finance.scss'],
})
export class PrivateFinance {
  api = inject(PrivateFinanceApi);
  private fb = inject(FormBuilder);
  destroy = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  /** Reiter: Übersicht, Ausgaben, Einnahmen, Budgets, Sparziele. */
  readonly tab = signal<FinanceTab>('overview');
  readonly txKind = signal<TransactionKind>('all');
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
  readonly todayDay = todayIso();
  /** Wird nach jedem Laden hochgezählt, damit die Zeitraumansicht ihre Sparbeiträge neu holt. */
  readonly dataVersion = signal(0);
  /** Untertitel im Kopf: sagt, wofür der gewählte Reiter da ist. */
  readonly intro = computed(() => {
    const tab = this.tab();
    if (tab === 'transactions') return 'Alle Ein- und Ausgaben, nach Tagen sortiert.';
    if (tab === 'budgets') return 'Wie viel du ausgeben willst – pro Monat und Kategorie.';
    if (tab === 'goals') return 'Wofür du sparst und wie weit du schon bist.';
    return 'Was diesen Monat noch übrig ist – auf einen Blick.';
  });
  /**
   * Die eine Hauptaktion je Reiter (Kopf am Rechner, schwebender Knopf am Handy): Übersicht und Transaktionen →
   * Transaktion erfassen; Budgets → das Monatsbudget festlegen bzw. ändern; Sparziele → Sparziel erstellen.
   * `text` steht sichtbar im Kopf, `label` ist der volle Name (Screenreader, Handy-Knopf).
   */
  readonly headAction = computed((): { text: string; label: string; icon: IconName } => {
    if (this.tab() === 'budgets') {
      return this.activeBudget()
        ? { text: 'Budget', label: 'Budget ändern', icon: 'edit' }
        : { text: 'Budget', label: 'Budget festlegen', icon: 'plus' };
    }
    if (this.tab() === 'goals') return { text: 'Sparziel', label: 'Sparziel erstellen', icon: 'plus' };
    return { text: 'Transaktion', label: 'Transaktion erfassen', icon: 'plus' };
  });
  headActionClick() {
    if (this.tab() === 'budgets') return this.open('budgets', this.activeBudget() ?? undefined);
    if (this.tab() === 'goals') return this.open('goals');
    this.open('transactions');
    // Auf „Einnahmen“ ist die Einnahme vorausgewählt — sonst wie bisher die Ausgabe.
    if (this.section() === 'income') this.form.controls.type.setValue('INCOME');
  }
  readonly tabs = FINANCE_TABS;
  /** Der gemeinsame Dialog (editor/finance-editor) — open() setzt dort den Verbindungs-Baustein zurück. */
  private readonly editorDialog = viewChild(FinanceEditor);
  readonly month = signal(financeMonth());
  readonly summary = signal<FinanceSummary | null>(null);
  readonly categories = signal<FinanceCategory[]>([]);
  readonly transactions = signal<FinanceTransaction[]>([]);
  readonly budgets = signal<FinanceBudget[]>([]);
  readonly goals = signal<SavingsGoal[]>([]);
  /** Einzahlungen in Sparziele (neueste zuerst) — „Gespart“, „Letzte Einzahlungen“, Monatsverlauf. */
  readonly contributions = signal<SavingsContributionDto[]>([]);
  readonly loading = signal(true);
  /**
   * Erste Schritte für neue Konten (Übersicht): Budget festlegen, erste Transaktion (oder Kontoauszug), optional ein
   * Sparziel. Jeder Schritt hakt sich mit echten Daten ab; die Liste verschwindet, sobald Budget und Transaktion da
   * sind. Solange in diesem Monat weder Budget noch Daten existieren, ersetzt sie die Kopfkarte voller Nullen.
   */
  readonly startSteps = computed(() => {
    const budget = this.budgets().length > 0;
    const transaction = this.transactions().length > 0;
    const goal = this.goals().length > 0;
    return { budget, transaction, goal, done: [budget, transaction, goal].filter(Boolean).length };
  });
  readonly showStart = computed(() => !this.loading() && !this.error() && (!this.startSteps().budget || !this.startSteps().transaction));
  // Begriffe, die man nicht kennen muss — je ein Satz, an der Stelle erklärt, wo sie stehen (app-term-hint)
  readonly plannedHint =
    'Ausgaben, die in diesem Monat noch kommen: mit einem Datum nach heute oder wiederkehrend und noch nicht gebucht. Sie sind im Budget schon abgezogen, damit „Noch verfügbar“ nicht zu hoch ist.';
  readonly savingsHint =
    'Was du in diesem Monat für deine Sparziele zurücklegst. Das ist keine Ausgabe, steht aber nicht mehr zum Ausgeben zur Verfügung.';
  /**
   * Monatsrückblick: in den ersten 7 Tagen eines Monats oben in der Übersicht ein Rückblick auf den Vormonat (Ausgaben,
   * Top-Kategorien, Sparen, Budget). „Ausblenden“ merkt sich der Browser je Monat; danach zeigt der Vormonat selbst
   * (zurückblättern) dieselben Zahlen. Nur aus echten Daten — ohne Bewegungen im Vormonat kein Rückblick.
   */
  readonly reviewHidden = signal<string[]>(readHiddenReviews());
  readonly review = computed(() => {
    const now = financeMonth();
    if (this.month() !== now || new Date().getDate() > 7 || this.showStart()) return null;
    const previous = shiftYm(now, -1);
    if (this.reviewHidden().includes(previous)) return null;
    const review = monthReview(previous, this.transactions(), this.contributions(), (id) => this.categoryName(id as number));
    return review.hasData ? review : null;
  });
  /** Budget des Rückblick-Monats (vom Server): hat es gereicht? */
  readonly reviewBudget = signal<FinanceSummary | null>(null);
  /** Bestätigung nach Speichern/Löschen — mit dem neuen verfügbaren Betrag. */
  readonly notice = signal('');
  /** Gesetzt, wenn die Ausgabe im Dialog das verfügbare Budget überschreiten würde (wartet auf Bestätigung). */
  /** Sätze der Warnung vor dem Speichern eines Sparziels (wartet auf Bestätigung), sonst null. */
  readonly goalWarning = signal<string[] | null>(null);
  readonly overrun = signal<{ available: string; over: string } | null>(null);
  private pending: { text: string; month: string | null } | null = null;
  readonly error = signal('');
  readonly formError = signal('');
  readonly editor = signal<Resource | null>(null);
  readonly editId = signal<number | undefined>(undefined);
  readonly goalFormValue = signal({ title: '', scope: 'single', end: '', target: null as string | null });
  readonly typeFilter = signal('ALL');
  readonly money = euros;
  /** Davon nur eingeplante Sparraten (noch nicht verbucht) — getrennt ausgewiesen, nie als Ausgabe. */
  readonly plannedSaved = computed(() => Number(this.summary()?.saved_planned ?? 0));
  /** Geplante Ausgaben des Monats (Server): Datum nach heute oder wiederkehrend, noch nicht gebucht. */
  readonly plannedItems = computed(() => this.summary()?.planned_items ?? []);
  readonly plannedTotal = computed(() => Number(this.summary()?.planned ?? 0));
  /** Bis heute gebuchte Ausgaben (Server); fällt auf alle Ausgaben des Monats zurück, solange die Zahl fehlt. */
  readonly spentNow = computed(() => Number(this.summary()?.spent ?? this.summary()?.expenses ?? 0));
  /** Tatsächlich gespart (verbuchte Sparbeiträge) im Monat. */
  readonly bookedSaved = computed(() => Math.max(0, Number(this.summary()?.saved ?? 0) - this.plannedSaved()));
  readonly monthYear = computed(() => this.month().slice(0, 4));
  /** „Dein Jahr“ im Budgets-Reiter (summary/year/); null solange es lädt oder fehlt — dann bleibt die kurze Zeile. */
  readonly yearSummary = signal<FinanceYearSummary | null>(null);
  /** Neu laden, sobald der Budgets-Reiter offen ist und sich Jahr oder Daten ändern (jedes load() setzt summary neu). */
  // Nur die jüngste Anfrage zählt: eine ältere Antwort (z. B. von vor dem Speichern) überschreibt nie eine neuere.
  private yearRequest = 0;
  private readonly loadYearSummary = effect(() => {
    if (this.tab() !== 'budgets' || !this.summary()) return;
    const year = this.monthYear();
    untracked(() => {
      // Anderes Jahr: die Karte des alten Jahres nicht stehen lassen, solange das neue lädt
      if (this.yearSummary()?.year !== year) this.yearSummary.set(null);
      const request = ++this.yearRequest;
      this.api
        .yearSummary(year)
        .pipe(takeUntilDestroyed(this.destroy), catchError(() => of(null)))
        .subscribe((data) => {
          if (request === this.yearRequest) this.yearSummary.set(data && data.year === year ? data : null);
        });
    });
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
  /** „Heute“/„Gestern“ statt Wochentag für die jüngsten Tage, sonst „Dienstag, 20. Oktober“. */
  dayGroupLabel(date: string, fallback: string): string {
    const near = this.dayLabel(date);
    return near === 'Heute' || near === 'Gestern' ? near : fallback;
  }
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
  /** Vergleich mit dem Vormonat immer über gleich lange Zeiträume: im laufenden Monat bis heute gegen den Vormonat bis
   * zum selben Tag („… als bis 30. Sept.“), sonst ganzer Monat gegen ganzen Monat. */
  // todayIso() bei jeder Neuberechnung (Monatswechsel, Neuladen) — nicht das beim Öffnen gemerkte Datum, sonst
  // vergleicht ein über Mitternacht offener Tab mit dem falschen Tag
  readonly cmpDay = computed(() => (this.transactions(), compareDay(this.month(), todayIso())));
  delta(type: FinanceTransaction['type']) {
    const day = this.cmpDay();
    const rows = this.transactions();
    return deltaLabel(monthTotalUntil(rows, this.month(), type, day), monthTotalUntil(rows, this.prevMonth(), type, day), this.prevMonth(), day);
  }
  readonly expenseDelta = computed(() => this.delta('EXPENSE'));
  readonly savedNow = computed(() => savedInMonth(this.contributions(), this.month()));
  readonly savedDelta = computed(() => {
    const day = this.cmpDay();
    const c = this.contributions();
    return deltaEuro(savedUntil(c, this.month(), day), savedUntil(c, this.prevMonth(), day), this.prevMonth(), day);
  });
  readonly weeks = computed(() => weeklyBars(this.transactions(), this.contributions(), this.month()));
  readonly weekAxis = computed(() => axis(Math.max(0, ...this.weeks().flatMap((w) => [w.income, w.expense, w.saved]))));
  readonly incomeAxis = computed(() => axis(Math.max(0, ...this.weeks().map((w) => w.income))));
  readonly sources = computed(() => incomeSources(this.transactions(), this.categories(), this.month()));
  readonly recurringIncome = computed(() => recurringItems(this.transactions(), 'INCOME', this.month()));
  readonly fixedIncome = computed(() =>
    this.transactions()
      .filter((t) => t.type === 'INCOME' && t.recurring && t.date.startsWith(this.month()))
      .reduce((sum, t) => sum + Number(t.amount), 0),
  );
  readonly prevIncome = computed(() => monthTotal(this.transactions(), this.prevMonth(), 'INCOME'));
  /** Kategorie-Budgets vom Server: Limit, ausgegeben, geplant, verfügbar (keine eigene Rechnung im Browser). */
  readonly catBudgets = computed(() => budgetsFromSummary(this.summary()?.budget_categories, this.categories()));
  readonly monthExpenses = computed(() =>
    this.transactions().filter((t) => t.type === 'EXPENSE' && t.date.startsWith(this.month())).slice(0, 6),
  );
  readonly monthIncome = computed(() =>
    this.transactions().filter((t) => t.type === 'INCOME' && t.date.startsWith(this.month())).slice(0, 5),
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
  readonly categoryIcon = categoryIcon;
  readonly dayLabel = dayLabel;
  readonly monthName = monthName;
  readonly sourceIcon = sourceIcon;

  /** Beträge für Kennzahlen: runde ohne Cent („3.000 €“), sonst genau („2.951,68 €“). */
  eur(value: number | string | null | undefined): string {
    const n = Math.round(Number(value ?? 0) * 100) / 100;
    const digits = Number.isInteger(n) ? 0 : 2;
    return `${n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })}\u00a0€`; // geschütztes Leerzeichen: „€“ nie allein in der nächsten Zeile
  }
  /** Anteil (0–100) einer Zahl an einer anderen, gerundet. */
  share(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 100) : 0;
  }
  /** Hinweis im Formular, wenn eine geplante wiederkehrende Ausgabe als Transaktion erfasst wird. */
  readonly plannedSource = signal<PlannedItem | null>(null);
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
  cancelQuickCategory() {
    this.quickCategory.set(null);
    this.quickCategoryError.set('');
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
      .filter((i) => i.kind === 'RECURRING' || i.kind === 'CONTRACT')
      .map((i, n) => ({
        // Verträge: eigener ID-Bereich, damit sie nie mit wiederkehrenden Zeilen zusammenfallen
        id: i.kind === 'CONTRACT' ? -1_000_000 - n : -(i.source_id ?? 0), amount: i.amount, type: 'EXPENSE',
        category: i.category as number, date: i.date, note: i.title, currency: 'EUR', recurring: i.kind === 'RECURRING',
        planned: true, plannedItem: i,
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
  readonly rows = computed(() => this.matchingRows().slice(0, this.rowLimit()));
  /** Das Budget, das für den angezeigten Monat gilt: bei Überschneidung das mit dem späteren Start. */
  readonly activeBudget = computed(() =>
    this.budgets()
      .filter((b) => budgetCovers(b, this.month()))
      .sort((a, b) => b.month.localeCompare(a.month))[0],
  );
  readonly filterOptions: SelectOption[] = [
    { value: 'ALL', label: 'Alle Transaktionen' },
    { value: 'EXPENSE', label: 'Ausgaben' },
    { value: 'INCOME', label: 'Einnahmen' },
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
  readonly span = budgetSpan;
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
  private readonly loadReviewBudget = effect(() => {
    const review = this.review();
    if (!review || this.reviewBudget()?.month === review.month) return;
    untracked(() =>
      this.api
        .summary(review.month)
        .pipe(takeUntilDestroyed(this.destroy), catchError(() => of(null)))
        .subscribe((summary) => summary && this.reviewBudget.set(summary)),
    );
  });
  constructor() {
    // Reiter aus der Adresse (?tab=expenses …), wie in Haushalt, Organisation und Reisen.
    const linkedTab = this.route.snapshot.queryParamMap.get('tab');
    if (FINANCE_TABS.some((t) => t.key === linkedTab) || linkedTab === 'expenses' || linkedTab === 'income')
      this.selectTab(linkedTab as FinanceTab | LegacyTab);
    const linkedKind = this.route.snapshot.queryParamMap.get('art');
    if (linkedTab === 'transactions' && TRANSACTION_KINDS.some((k) => k.key === linkedKind)) this.selectKind(linkedKind as TransactionKind);
    this.load();
    // Ändert sich etwas im Dialog, gilt die Warnung nicht mehr.
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      const raw = this.form.getRawValue();
      const target = this.editor() === 'goals' ? (this.goals().find((g) => g.id === this.editId())?.target_date ?? null) : null;
      this.goalFormValue.set({ title: raw.title, scope: raw.plan_scope, end: raw.plan_end, target });
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
  remember(text: string, month: string | null) {
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
    // Dauer und Ausblenden übernimmt app-save-feedback (pausiert bei Zeiger/Fokus)
    this.notice.set(text);
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
  readonly renderInjector = inject(Injector);
  budgetFocus: 'year' | 'month' | null = null;
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
      current_amount: '0,00',
      status: 'ACTIVE',
    });
    // Beträge kommen von der API als „6.50“ / „3000.00“ — im Feld deutsch zeigen („6,50“ / „3.000,00“); beim
    // Speichern liest normalizeMoneyInput beides wieder richtig.
    const de = (value: string | number | null | undefined) => (value == null || value === '' ? '' : formatMoneyInput(String(value)));
    this.editor.set(resource);
    this.plannedSource.set(null);
    this.cancelQuickCategory();
    this.overrun.set(null);
    this.goalWarning.set(null);
    this.editId.set(item?.id);
    this.editorDialog()?.resetLinks();
    this.formError.set('');
    if (item) {
      if ('type' in item) this.form.patchValue({ ...item, amount: de(item.amount), category: String(item.category), recurring: !!item.recurring });
      else if ('month' in item)
        this.form.patchValue({
          amount: de(item.amount),
          month: item.month.slice(0, 7),
          scope: item.open_ended ? 'open' : item.end_month && item.end_month !== item.month ? 'until' : 'single',
          end_month: item.end_month ? item.end_month.slice(0, 7) : '',
        });
      else
        this.form.patchValue({
          ...item,
          target_amount: de(item.target_amount),
          current_amount: de(item.current_amount),
          rate: de(item.monthly_amount),
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
  amount(value: string, allowZero = false) {
    const cleaned = normalizeMoneyInput(value) ?? 'x';
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(cleaned)) return null;
    const [whole, fraction = ''] = cleaned.split('.');
    const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    if (!allowZero && cents === 0n) return null;
    return `${BigInt(whole)}.${fraction.padEnd(2, '0')}`;
  }
}
