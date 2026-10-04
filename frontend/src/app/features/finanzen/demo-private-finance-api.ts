import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  CategoryPayload,
  FALLBACK_CATEGORY,
  FinanceBudget,
  FinanceCategory,
  FinanceSummary,
  FinanceTransaction,
  GoalPreview,
  SavingsContributionDto,
  SavingsGoal,
  financeMonth,
  goalCovers,
  winningBudget,
} from './private-finance-api.service';

// Sicherheitskritisch wie demo-finanzen-data-provider.ts (dieselbe Regel gilt hier): diese Datei importiert KEINEN
// HttpClient. Sie ersetzt PrivateFinanceApi nur für die öffentliche Demo-Route (siehe app.routes.ts) und hält ihren
// gesamten Zustand im Speicher dieser einen Instanz — ein Reload verwirft ihn, das ist im Demo-Modus korrekt.
//
// Die Beispieldaten sind relativ zu HEUTE aufgebaut (nicht an feste Kalenderdaten gebunden), damit die Demo egal an
// welchem Tag sie besucht wird für den LAUFENDEN Monat plausibel aussieht — und weil das Budget „ab Startmonat bis
// auf Weiteres“ gilt, zeigt auch jeder andere Monat echte, in sich stimmige Demo-Zahlen statt einer leeren Seite.

/** „JJJJ-MM-TT“ im Monat `monthsAgo` vor dem laufenden; der Tag wird auf heute begrenzt, wenn er im laufenden Monat
 * noch in der Zukunft läge (eine Demo-Buchung „von morgen“ sähe falsch aus). */
function ym(monthsAgo: number, day = 1): string {
  const d = new Date();
  const today = d.getDate();
  d.setDate(1); // erst auf den 1. setzen, sonst überspringt setMonth() bei Monaten mit weniger Tagen einen Monat
  d.setMonth(d.getMonth() - monthsAgo);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  // Laufender Monat: die Tage verteilen sich auf die Zeit bis heute, damit nichts „in der Zukunft“ liegt
  // und nicht alles auf „Heute“ fällt.
  const safe = monthsAgo === 0 ? Math.max(1, Math.min(today, Math.round((day * today) / last))) : Math.min(day, last);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(safe).padStart(2, '0')}`;
}
/** Monate in die Zukunft — für Zieltermine. */
function ahead(months: number): string {
  return ym(-months, 1);
}
function money(n: number): string {
  return n.toFixed(2);
}

const CATEGORIES: FinanceCategory[] = [
  { id: 1, name: 'Wohnen', color: '#164c49', monthly_goal: '800.00' },
  { id: 2, name: 'Lebensmittel', color: '#8a5a23', monthly_goal: '400.00' },
  { id: 3, name: 'Mobilität', color: '#2f5aa8', monthly_goal: '200.00' },
  { id: 4, name: 'Freizeit', color: '#7a4fb5', monthly_goal: '300.00' },
  { id: 5, name: 'Gesundheit', color: '#b5384f', monthly_goal: '100.00' },
  { id: 6, name: 'Sonstiges', color: '#8a93a3', monthly_goal: '200.00' },
];

type Row = Omit<FinanceTransaction, 'id' | 'currency'>;
const EXPENSE = 'EXPENSE' as const;
const INCOME = 'INCOME' as const;

/** Ein typischer Monat: feste Posten (wiederkehrend) plus Einkäufe, die von Monat zu Monat leicht schwanken. */
function monthRows(monthsAgo: number): Row[] {
  const wobble = [1, 0.92, 1.08, 0.96, 1.04, 0.9][monthsAgo] ?? 1;
  const r = (n: number) => money(n * wobble);
  const rows: Row[] = [
    { amount: '3000.00', type: INCOME, category: 6, date: ym(monthsAgo, 1), note: 'Gehalt', recurring: true },
    { amount: '500.00', type: EXPENSE, category: 1, date: ym(monthsAgo, 1), note: 'Miete', recurring: true },
    { amount: '67.40', type: EXPENSE, category: 1, date: ym(monthsAgo, 1), note: 'Strom', recurring: true },
    { amount: '49.00', type: EXPENSE, category: 3, date: ym(monthsAgo, 2), note: 'Deutschlandticket', recurring: true },
    { amount: '12.99', type: EXPENSE, category: 4, date: ym(monthsAgo, 28), note: 'Netflix', recurring: true },
    { amount: r(62.4), type: EXPENSE, category: 2, date: ym(monthsAgo, 3), note: 'REWE' },
    { amount: r(48.23), type: EXPENSE, category: 2, date: ym(monthsAgo, 9), note: 'REWE' },
    { amount: r(54.1), type: EXPENSE, category: 2, date: ym(monthsAgo, 16), note: 'Wochenmarkt' },
    { amount: r(55.3), type: EXPENSE, category: 2, date: ym(monthsAgo, 23), note: 'REWE' },
    { amount: r(32.99), type: EXPENSE, category: 6, date: ym(monthsAgo, 4), note: 'Amazon' },
    { amount: r(78), type: EXPENSE, category: 4, date: ym(monthsAgo, 12), note: 'Konzert' },
    { amount: r(39.5), type: EXPENSE, category: 4, date: ym(monthsAgo, 19), note: 'Restaurant' },
    { amount: r(71), type: EXPENSE, category: 3, date: ym(monthsAgo, 14), note: 'Tankstelle' },
    { amount: r(48.9), type: EXPENSE, category: 5, date: ym(monthsAgo, 7), note: 'Apotheke' },
    { amount: r(41.1), type: EXPENSE, category: 5, date: ym(monthsAgo, 21), note: 'Physiotherapie' },
    { amount: r(77), type: EXPENSE, category: 6, date: ym(monthsAgo, 25), note: 'Geschenk' },
  ];
  if (monthsAgo === 0) {
    rows.push(
      { amount: '220.00', type: INCOME, category: 6, date: ym(0, 3), note: 'Freelance' },
      { amount: '100.00', type: INCOME, category: 6, date: ym(0, 2), note: 'Verkauf' },
      { amount: '80.00', type: INCOME, category: 6, date: ym(0, 2), note: 'Rückerstattung' },
      { amount: '20.00', type: INCOME, category: 6, date: ym(0, 1), note: 'Bonus' },
    );
  } else if (monthsAgo === 1) {
    rows.push({ amount: '50.00', type: INCOME, category: 6, date: ym(1, 18), note: 'Verkauf' });
  }
  return rows;
}

/** Feste Beispieldaten für die öffentliche Finanzen-Demo (siehe app.routes.ts). Bucht Ausgaben, Budgets und
 * Sparziele nur in dieser einen In-Memory-Instanz (kein providedIn:'root'). */
@Injectable()
export class DemoPrivateFinanceApi {
  private nextId = 1000;
  private categoryList: FinanceCategory[] = CATEGORIES.map((c) => ({ ...c }));
  private txs: FinanceTransaction[] = [5, 4, 3, 2, 1, 0]
    .flatMap((monthsAgo) => monthRows(monthsAgo))
    .map((row, index) => ({ ...row, id: index + 1, currency: 'EUR' }));
  private budgetList: FinanceBudget[] = [
    { id: 1, month: ym(6, 1), end_month: null, open_ended: true, amount: '3000.00', currency: 'EUR' },
  ];
  private goalList: SavingsGoal[] = [
    this.goal(1, 'Japan', '3000.00', '1800.00', '300.00', ahead(6)),
    this.goal(2, 'Notgroschen', '2000.00', '1200.00', '200.00', ahead(9)),
    this.goal(3, 'Badmintonschuhe', '150.00', '80.00', '25.00', ahead(3)),
    this.goal(4, 'Wohnung', '30000.00', '12000.00', '500.00', ahead(38)),
  ];
  /** Wann sich das Gesparte geändert hat — wie backend SavingsContribution. Steuert, was ein Monat für
   * Sparziele zurücklegt („Gespart“) und füllt „Letzte Einzahlungen“. */
  private contributionList: SavingsContributionDto[] = [
    ...[2, 1, 0].flatMap((monthsAgo) => [
      { goal: 1, goal_title: 'Japan', amount: '300.00', date: ym(monthsAgo, 1) },
      { goal: 2, goal_title: 'Notgroschen', amount: '200.00', date: ym(monthsAgo, 1) },
      { goal: 4, goal_title: 'Wohnung', amount: '500.00', date: ym(monthsAgo, 1) },
      { goal: 3, goal_title: 'Badmintonschuhe', amount: '25.00', date: ym(monthsAgo, 1) },
    ]),
    { goal: 3, goal_title: 'Badmintonschuhe', amount: '50.00', date: ym(1, 26) },
  ].map((c, index) => ({ ...c, id: index + 1 }));

  private goal(id: number, title: string, target: string, current: string, rate: string, date: string): SavingsGoal {
    return {
      id,
      title,
      target_amount: target,
      current_amount: current,
      target_date: date,
      status: 'ACTIVE',
      currency: 'EUR',
      monthly_amount: rate,
      plan_month: ym(6, 1),
      plan_end_month: null,
      plan_open_ended: true,
    };
  }

  // Kopien statt der Live-Referenz — sonst hält Angular ein signal.set() derselben (nur in-place veränderten) Array-
  // Referenz fälschlich für unverändert und Berechnungen bleiben stehen.
  categories(): Observable<FinanceCategory[]> {
    return of(this.categoryList.map((c) => ({ ...c })));
  }
  setupCategories(): Observable<FinanceCategory[]> {
    return this.categories();
  }
  setCategoryLimit(id: number, monthlyGoal: string | null): Observable<FinanceCategory> {
    const found = this.categoryList.find((c) => c.id === id);
    if (!found) return throwError(() => ({ status: 404 }));
    found.monthly_goal = monthlyGoal;
    return of({ ...found });
  }
  createCategory(payload: CategoryPayload): Observable<FinanceCategory> {
    const name = payload.name.trim();
    if (this.categoryList.some((c) => c.name.toLocaleLowerCase('de') === name.toLocaleLowerCase('de')))
      return throwError(() => ({ status: 400, error: { name: ['Diese Kategorie gibt es schon.'] } }));
    // Wie das Backend: unbekannte eigene Kategorien bekommen das neutrale Grau.
    const created: FinanceCategory = { id: this.nextId++, name, color: '#8a93a3', monthly_goal: payload.monthly_goal };
    this.categoryList.push(created);
    return of({ ...created });
  }
  updateCategory(id: number, payload: Partial<CategoryPayload>): Observable<FinanceCategory> {
    const found = this.categoryList.find((c) => c.id === id);
    if (!found) return throwError(() => ({ status: 404 }));
    const name = payload.name?.trim();
    if (name !== undefined && name !== found.name) {
      if (found.name === FALLBACK_CATEGORY)
        return throwError(() => ({ status: 400, error: { name: [`„${FALLBACK_CATEGORY}“ behält seinen Namen.`] } }));
      if (this.categoryList.some((c) => c.id !== id && c.name.toLocaleLowerCase('de') === name.toLocaleLowerCase('de')))
        return throwError(() => ({ status: 400, error: { name: ['Diese Kategorie gibt es schon.'] } }));
      found.name = name;
    }
    if (payload.monthly_goal !== undefined) found.monthly_goal = payload.monthly_goal;
    return of({ ...found });
  }
  deleteCategory(id: number): Observable<void> {
    const found = this.categoryList.find((c) => c.id === id);
    if (!found) return throwError(() => ({ status: 404 }));
    if (found.name === FALLBACK_CATEGORY) return throwError(() => ({ status: 400 }));
    if (this.txs.some((t) => t.category === id)) {
      let fallback = this.categoryList.find((c) => c.name === FALLBACK_CATEGORY);
      if (!fallback) {
        fallback = { id: this.nextId++, name: FALLBACK_CATEGORY, color: '#8a93a3', monthly_goal: null };
        this.categoryList.push(fallback);
      }
      for (const t of this.txs) if (t.category === id) t.category = fallback.id;
    }
    this.categoryList = this.categoryList.filter((c) => c.id !== id);
    return of(undefined);
  }
  transactions(): Observable<FinanceTransaction[]> {
    return of([...this.txs].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id));
  }
  budgets(): Observable<FinanceBudget[]> {
    return of([...this.budgetList]);
  }
  goals(month: string): Observable<SavingsGoal[]> {
    return of(this.goalList.filter((g) => goalCovers(g, month)));
  }
  contributions(): Observable<SavingsContributionDto[]> {
    return of([...this.contributionList].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id));
  }
  // Wie PrivateFinanceApi.summary(): ohne Angabe gilt der laufende Monat.
  summary(month: string = financeMonth()): Observable<FinanceSummary> {
    return of(this.buildSummary(month));
  }
  budgetImpact(id: number): Observable<{ transactions: number; goals: number }> {
    if (!this.budgetList.some((b) => b.id === id)) return throwError(() => ({ status: 404 }));
    const months = new Set(this.txs.map((t) => t.date.slice(0, 7)));
    const goals = this.goalList.filter((g) => g.status !== 'PAUSED' && Number(g.current_amount) > 0).length;
    return of({ transactions: this.txs.filter((t) => months.has(t.date.slice(0, 7))).length, goals });
  }
  previewGoal(payload: object, id?: number): Observable<GoalPreview> {
    const draft = payload as Pick<SavingsGoal, 'current_amount'>;
    const previous = id ? Number(this.goalList.find((g) => g.id === id)?.current_amount ?? 0) : 0;
    const extra = Number(draft.current_amount ?? 0) - previous;
    const month = financeMonth();
    const available = this.buildSummary(month).available;
    const after = available === null ? null : Number(available) - Math.max(0, extra);
    const month_over = after !== null && after < 0 && extra > 0 ? { month, over: money(-after) } : null;
    return of({ month_over, plan_alert: null });
  }
  save(resource: 'transactions' | 'budgets' | 'goals', payload: object, id?: number): Observable<unknown> {
    const list = this.listFor(resource);
    if (id) {
      const index = list.findIndex((row) => (row as { id: number }).id === id);
      if (index === -1) return throwError(() => ({ status: 404 }));
      const before = list[index];
      list[index] = { ...before, ...payload };
      if (resource === 'goals') this.record(list[index] as SavingsGoal, Number((before as SavingsGoal).current_amount));
      return of(list[index]);
    }
    const created = { id: this.nextId++, ...payload };
    (list as unknown[]).push(created);
    if (resource === 'goals') this.record(created as SavingsGoal, 0);
    return of(created);
  }
  delete(resource: 'transactions' | 'budgets' | 'goals', id: number): Observable<void> {
    const list = this.listFor(resource) as { id: number }[];
    const index = list.findIndex((row) => row.id === id);
    if (index === -1) return throwError(() => ({ status: 404 }));
    list.splice(index, 1);
    // Wie im Backend: ein gelöschtes Ziel nimmt seine Einzahlungen mit, das Geld ist wieder frei.
    if (resource === 'goals') this.contributionList = this.contributionList.filter((c) => c.goal !== id);
    return of(undefined);
  }

  /** Jede Änderung des gesparten Betrags zählt in dem Monat, in dem sie passiert (backend _record). */
  private record(goal: SavingsGoal, before: number): void {
    const change = Number(goal.current_amount ?? 0) - before;
    if (!change) return;
    this.contributionList.push({
      id: this.nextId++,
      goal: goal.id,
      goal_title: goal.title,
      amount: money(change),
      date: new Date().toLocaleDateString('sv-SE'),
    });
  }

  private listFor(resource: 'transactions' | 'budgets' | 'goals') {
    if (resource === 'transactions') return this.txs;
    if (resource === 'budgets') return this.budgetList;
    return this.goalList;
  }

  /** Rechnet wie das Backend: Restbudget = Monatsbudget − Ausgaben − für Sparziele Zurückgelegtes. Zurückgelegt ist,
   * was in diesem Monat in nicht pausierte Ziele eingezahlt wurde (vereinfachte Sparraten-Simulation). */
  private buildSummary(month: string): FinanceSummary {
    const rows = this.txs.filter((t) => t.date.startsWith(month));
    const income = rows.filter((t) => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = rows.filter((t) => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
    const budget = winningBudget(this.budgetList, month);
    const active = new Set(this.goalList.filter((g) => g.status !== 'PAUSED').map((g) => g.id));
    const saved = this.contributionList
      .filter((c) => c.date.startsWith(month) && active.has(c.goal))
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const covering = this.goalList.filter((g) => g.status !== 'PAUSED' && goalCovers(g, month));
    const byCategory = new Map<number, number>();
    for (const t of rows.filter((t) => t.type === 'EXPENSE')) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + Number(t.amount));
    const categories = [...byCategory.entries()]
      .map(([id, amount]) => {
        const category = this.categoryList.find((c) => c.id === id);
        return { id, name: category?.name ?? 'Sonstiges', color: category?.color ?? '#8a93a3', amount: money(amount) };
      })
      .sort((a, b) => Number(b.amount) - Number(a.amount));
    return {
      month,
      currency: 'EUR',
      budget: budget ? budget.amount : null,
      total: budget ? money(Number(budget.amount)) : null,
      saved: money(saved),
      saved_planned: '0.00',
      plan_alert: null,
      available: budget ? money(Number(budget.amount) - expense - saved) : null,
      income: money(income),
      expenses: money(expense),
      savings_target: money(covering.reduce((sum, g) => sum + Number(g.target_amount), 0)),
      savings_current: money(covering.reduce((sum, g) => sum + Number(g.current_amount), 0)),
      has_data: !!budget || rows.length > 0 || covering.length > 0,
      categories,
      recent: rows
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
        .slice(0, 5),
    };
  }
}
