import { Component, computed, inject } from '@angular/core';
import { formatMoneyInput } from '../../../shared/currency/money-input';
import { AppSelect, SelectOption } from '../../../shared/form/select';
import { AppIcon } from '../../../shared/icons/app-icon';
import { TermHint } from '../../../shared/term-hint/term-hint';
import { FinanceTransaction } from '../data/private-finance-api.service';
import { todayIso } from '../overview/finance-periods';
import { FinanceDateNav } from '../shared/finance-date-nav';
import { dayLabel as weekdayLabel } from '../shared/finance-overview';
import { axis, categoryIcon, categorySlices, dayLabel, donut, expenseSplit, fixedKey, monthTotalUntil, monthlyBars, recurringItems } from '../shared/finance-tabs';
import { of } from 'rxjs';
import { FINANCE_CONTEXT, ListRow, TRANSACTION_KINDS } from '../finance-context';

/** Finanzen › Transaktionen: Alle/Ausgaben/Einnahmen/Geplant, Kennzahlen, Fixkosten und die vollständige Liste.
 * Gemeinsamer Zustand (Monat, Daten, Dialog) über FINANCE_CONTEXT von PrivateFinance; Verhalten unverändert. */
@Component({
  selector: 'app-finance-transactions-tab',
  standalone: true,
  imports: [AppIcon, AppSelect, FinanceDateNav, TermHint],
  templateUrl: './finance-transactions-tab.html',
  // Reihenfolge wie vor der Aufteilung: Diagramme, Bausteine, Finanz-Look, späte Bausteine, eigene Regeln
  styleUrls: ['../shared/finance-charts.scss', '../shared/finance-blocks.scss', '../shared/_fin-look.scss', '../shared/finance-blocks-late.scss', './finance-transactions-tab.scss'],
})
export class FinanceTransactionsTab {
  protected readonly ctx = inject(FINANCE_CONTEXT);
  // Gemeinsame Werte und Aktionen unter ihrem gewohnten Namen (Template unverändert)
  protected readonly txKind = this.ctx.txKind;
  protected readonly importOpen = this.ctx.importOpen;
  protected readonly section = this.ctx.section;
  protected readonly month = this.ctx.month;
  protected readonly transactions = this.ctx.transactions;
  protected readonly plannedHint = this.ctx.plannedHint;
  protected readonly money = this.ctx.money;
  protected readonly spentNow = this.ctx.spentNow;
  protected readonly Math = Math;
  protected readonly monthShort = this.ctx.monthShort;
  protected readonly incomeNow = this.ctx.incomeNow;
  protected readonly expenseDelta = this.ctx.expenseDelta;
  protected readonly savedNow = this.ctx.savedNow;
  protected readonly categoryIcon = this.ctx.categoryIcon;
  protected readonly dayLabel = this.ctx.dayLabel;
  protected readonly eur = this.ctx.eur.bind(this.ctx);
  protected readonly share = this.ctx.share.bind(this.ctx);
  protected readonly rowTitle = this.ctx.rowTitle.bind(this.ctx);
  protected readonly selectKind = this.ctx.selectKind.bind(this.ctx);
  protected readonly categoryFilter = this.ctx.categoryFilter;
  protected readonly transactionSearch = this.ctx.transactionSearch;
  protected readonly rows = this.ctx.rows;
  protected readonly monthLabel = this.ctx.monthLabel;
  protected readonly span = this.ctx.span;
  protected readonly categoryName = this.ctx.categoryName.bind(this.ctx);
  protected readonly categoryColor = this.ctx.categoryColor.bind(this.ctx);
  protected readonly open = this.ctx.open.bind(this.ctx);
  protected readonly amount = this.ctx.amount.bind(this.ctx);

  readonly txKinds = TRANSACTION_KINDS;
  readonly fixedHint = 'Ausgaben, die jeden Monat wiederkommen (als „monatlich“ markiert), z. B. Miete, Strom, Abos.';
  private readonly plannedRecurringKeys = computed(
    () => new Set(this.ctx.plannedItems().filter((i) => i.kind === 'RECURRING').map((i) => i.key)),
  );
  /** Status eines wiederkehrenden Postens im angezeigten Monat: geplant (im Budget berücksichtigt) oder gebucht. */
  fixedStatus(item: { last: FinanceTransaction }): 'planned' | 'booked' | null {
    if (this.plannedRecurringKeys().has(fixedKey(item.last.note, item.last.category))) return 'planned';
    if (this.ctx.transactions().some((t) => t.type === item.last.type && t.date.startsWith(this.ctx.month())
      && fixedKey(t.note, t.category) === fixedKey(item.last.note, item.last.category))) return 'booked';
    return null;
  }
  readonly expenseMonths = computed(() => monthlyBars(this.ctx.transactions(), this.ctx.month(), 'EXPENSE'));
  readonly expenseMonthsAxis = computed(() => axis(Math.max(0, ...this.expenseMonths().map((m) => m.value))));
  readonly expenseSlices = computed(() => categorySlices(this.ctx.transactions(), this.ctx.categories(), this.ctx.month()));
  readonly expenseDonut = computed(() => donut(this.expenseSlices()));
  readonly recurringExpenses = computed(() => recurringItems(this.ctx.transactions(), 'EXPENSE', this.ctx.month()));
  /** Ausgaben-Ansicht: bis heute gebucht (wie „Bereits ausgegeben“ und der Vormonatsvergleich); künftig datierte
   * Ausgaben stehen unter „Geplant“. In abgeschlossenen Monaten ist das der ganze Monat. */
  readonly expenseBooked = computed(() => monthTotalUntil(this.ctx.transactions(), this.ctx.month(), 'EXPENSE', this.ctx.cmpDay()));
  readonly split = computed(() => {
    const today = todayIso();
    const booked = this.ctx.cmpDay() === null ? this.ctx.transactions() : this.ctx.transactions().filter((t) => t.date <= today);
    return expenseSplit(booked, this.ctx.month());
  });
  /** Fixkosten: Summe der wiederkehrenden Ausgaben (je Posten der zuletzt gebuchte Betrag), pro Monat und aufs Jahr. */
  readonly fixedMonthly = computed(() => this.recurringExpenses().reduce((sum, item) => sum + item.amount, 0));
  /** Höhe eines Balkens in Prozent der Achse. */
  barHeight(value: number, top: number): number {
    return top > 0 ? Math.max(value > 0 ? 2 : 0, (value / top) * 100) : 0;
  }
  /** Klick auf eine Zeile: echte Transaktion bearbeiten — eine geplante wiederkehrende öffnet das Formular vorbelegt,
   * Speichern erfasst sie für ihr Datum (danach zählt sie als gebucht statt geplant, nie doppelt). */
  openRow(row: ListRow) {
    if (!row.plannedItem) return this.ctx.open('transactions', row);
    const item = row.plannedItem;
    this.ctx.open('transactions');
    // Vertrag: einmalig buchen (der Vertrag plant weiter) — „monatlich“ würde eine zweite Planung erzeugen und doppelt zählen
    this.ctx.form.patchValue({ amount: formatMoneyInput(String(item.amount)), type: 'EXPENSE', category: String(item.category ?? ''), date: item.date, note: item.title, recurring: item.kind === 'RECURRING' });
    this.ctx.plannedSource.set(item);
  }
  /** Summe der sichtbaren geplanten Zeilen (für die Überschrift unter „Geplant“). */
  readonly matchingPlannedTotal = computed(() =>
    this.ctx.matchingRows().filter((r) => r.planned).reduce((sum, r) => sum + Number(r.amount), 0),
  );
  readonly moreRowsCount = computed(() => Math.max(0, this.ctx.matchingRows().length - this.ctx.rowLimit()));
  /** Die Liste nach Tagen gruppiert (wie im Kontoauszug). Die Tagessumme zählt nur gebuchte Transaktionen — Geplantes
   * ist noch nicht passiert; ein Tag nur mit Geplantem zeigt „geplant“ statt einer Summe. */
  readonly rowGroups = computed(() => {
    const groups: { date: string; label: string; total: number; booked: boolean; rows: ListRow[] }[] = [];
    for (const row of this.ctx.rows()) {
      let group = groups.find((g) => g.date === row.date);
      if (!group) {
        group = { date: row.date, label: this.ctx.dayGroupLabel(row.date, weekdayLabel(row.date)), total: 0, booked: false, rows: [] };
        groups.push(group);
      }
      group.rows.push(row);
      if (!row.planned) {
        group.booked = true;
        group.total += (row.type === 'INCOME' ? 1 : -1) * Number(row.amount);
      }
    }
    return groups;
  });
  /** Kategorien-Filter der Buchungen: nur Kategorien, die im Monat tatsächlich vorkommen — eine leere Auswahl
   * (Kategorie ohne Buchungen im Monat) wäre nur verwirrend. */
  readonly categoryFilterOptions = computed<SelectOption[]>(() => {
    const used = new Set(this.ctx.monthRows().map((t) => t.category));
    return [
      { value: '', label: 'Alle Kategorien' },
      ...this.ctx.categories()
        .filter((c) => used.has(c.id))
        .map((c) => ({ value: String(c.id), label: c.name, color: c.color })),
    ];
  });
  protected showMoreRows(): void {
    this.ctx.rowLimit.update((n) => n + 5);
  }
}
