import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  FinanceBudget,
  FinanceCategory,
  FinanceSummary,
  FinanceTransaction,
  GoalPreview,
  SavingsGoal,
  budgetCovers,
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
// auf Weiteres“ gilt, zeigt auch jeder andere Monat (Vergangenheit ohne Buchungen, Zukunft) echte, in sich stimmige
// Demo-Zahlen statt eines Fehlers oder einer leeren Seite, die wie ein Bug aussehen würde.

function ym(monthsAgo: number, day = 1): string {
  const d = new Date();
  d.setDate(1); // erst auf den 1. setzen, sonst überspringt setMonth() bei Monaten mit weniger Tagen einen Monat
  d.setMonth(d.getMonth() - monthsAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function money(n: number): string {
  return n.toFixed(2);
}

const CATEGORIES: FinanceCategory[] = [
  { id: 1, name: 'Wohnen', color: '#164c49' },
  { id: 2, name: 'Lebensmittel', color: '#8a5a23' },
  { id: 3, name: 'Mobilität', color: '#2f5aa8' },
  { id: 4, name: 'Freizeit', color: '#7a4fb5' },
  { id: 5, name: 'Gesundheit', color: '#b5384f' },
  { id: 6, name: 'Sonstiges', color: '#8a93a3' },
];

/** Feste Beispieldaten für die öffentliche Finanzen-Demo (aktuelles Design, siehe app.routes.ts). Bucht Ausgaben,
 * Budgets und Sparziele nur in dieser einen In-Memory-Instanz (kein providedIn:'root'), genau wie
 * DemoFinanzenDataProvider für den älteren Haushalts-Finanzen-Bereich. */
@Injectable()
export class DemoPrivateFinanceApi {
  private nextId = 100;
  private txs: FinanceTransaction[] = [
    // Vor drei Monaten
    { id: 1, amount: '2800.00', type: 'INCOME', category: 6, date: ym(3, 1), note: 'Gehalt', currency: 'EUR' },
    { id: 2, amount: '850.00', type: 'EXPENSE', category: 1, date: ym(3, 3), note: 'Miete', currency: 'EUR' },
    { id: 3, amount: '62.40', type: 'EXPENSE', category: 2, date: ym(3, 6), note: 'Supermarkt', currency: 'EUR' },
    { id: 4, amount: '39.00', type: 'EXPENSE', category: 3, date: ym(3, 12), note: 'Tankstelle', currency: 'EUR' },
    // Vor zwei Monaten
    { id: 5, amount: '2800.00', type: 'INCOME', category: 6, date: ym(2, 1), note: 'Gehalt', currency: 'EUR' },
    { id: 6, amount: '850.00', type: 'EXPENSE', category: 1, date: ym(2, 3), note: 'Miete', currency: 'EUR' },
    { id: 7, amount: '58.10', type: 'EXPENSE', category: 2, date: ym(2, 5), note: 'Supermarkt', currency: 'EUR' },
    { id: 8, amount: '45.00', type: 'EXPENSE', category: 4, date: ym(2, 14), note: 'Kino', currency: 'EUR' },
    { id: 9, amount: '29.90', type: 'EXPENSE', category: 5, date: ym(2, 20), note: 'Apotheke', currency: 'EUR' },
    // Letzter Monat
    { id: 10, amount: '2800.00', type: 'INCOME', category: 6, date: ym(1, 1), note: 'Gehalt', currency: 'EUR' },
    { id: 11, amount: '850.00', type: 'EXPENSE', category: 1, date: ym(1, 3), note: 'Miete', currency: 'EUR' },
    { id: 12, amount: '71.85', type: 'EXPENSE', category: 2, date: ym(1, 4), note: 'Supermarkt', currency: 'EUR' },
    { id: 13, amount: '39.00', type: 'EXPENSE', category: 3, date: ym(1, 9), note: 'Tankstelle', currency: 'EUR' },
    { id: 14, amount: '18.50', type: 'EXPENSE', category: 4, date: ym(1, 22), note: 'Streaming-Abo', currency: 'EUR' },
    // Laufender Monat
    { id: 15, amount: '2800.00', type: 'INCOME', category: 6, date: ym(0, 1), note: 'Gehalt', currency: 'EUR' },
    { id: 16, amount: '850.00', type: 'EXPENSE', category: 1, date: ym(0, 3), note: 'Miete', currency: 'EUR' },
    { id: 17, amount: '54.30', type: 'EXPENSE', category: 2, date: ym(0, 5), note: 'Supermarkt', currency: 'EUR' },
  ];
  private budgetList: FinanceBudget[] = [
    { id: 1, month: ym(6, 1), end_month: null, open_ended: true, amount: '3200.00', currency: 'EUR' },
  ];
  private goalList: SavingsGoal[] = [
    {
      id: 1,
      title: 'Urlaub',
      target_amount: '2000.00',
      current_amount: '450.00',
      target_date: null,
      status: 'ACTIVE',
      currency: 'EUR',
      monthly_amount: null,
      plan_month: ym(2, 1),
      plan_end_month: null,
      plan_open_ended: true,
    },
    {
      id: 2,
      title: 'Neue Kopfhörer',
      target_amount: '150.00',
      current_amount: '150.00',
      target_date: null,
      status: 'COMPLETED',
      currency: 'EUR',
      monthly_amount: null,
      plan_month: ym(1, 1),
      plan_end_month: null,
      plan_open_ended: true,
    },
  ];

  // Kopien statt der Live-Referenz — sonst hält Angular ein signal.set() derselben (nur in-place veränderten) Array-
  // Referenz fälschlich für unverändert und Berechnungen bleiben stehen, bis irgendetwas anderes die Signale
  // erneut anstößt (siehe dieselbe Korrektur in demo-organisation-api.ts).
  categories(): Observable<FinanceCategory[]> {
    return of(CATEGORIES);
  }
  setupCategories(): Observable<FinanceCategory[]> {
    return of(CATEGORIES);
  }
  transactions(): Observable<FinanceTransaction[]> {
    return of([...this.txs]);
  }
  budgets(): Observable<FinanceBudget[]> {
    return of([...this.budgetList]);
  }
  goals(month: string): Observable<SavingsGoal[]> {
    return of(this.goalList.filter((g) => goalCovers(g, month)));
  }
  // Wie PrivateFinanceApi.summary(): ohne Angabe gilt der laufende Monat — DemoPrivateFinanceApi ersetzt
  // PrivateFinanceApi nur per Dependency Injection (keine gemeinsame Basisklasse), deshalb muss dieser
  // Standardwert hier eigens wiederholt werden, sonst bekäme ein Aufruf ohne Argument (z. B. im Dashboard)
  // month=undefined und damit eine falsche Zusammenfassung.
  summary(month: string = financeMonth()): Observable<FinanceSummary> {
    return of(this.buildSummary(month));
  }
  budgetImpact(id: number): Observable<{ transactions: number; goals: number }> {
    // Nur ein Budget in der Demo: fällt es weg, hätte jeder Monat mit Buchungen oder haltenden Zielen keines mehr.
    if (!this.budgetList.some((b) => b.id === id)) return throwError(() => ({ status: 404 }));
    const months = new Set(this.txs.map((t) => t.date.slice(0, 7)));
    const goals = this.goalList.filter((g) => g.status !== 'PAUSED' && Number(g.current_amount) > 0).length;
    return of({ transactions: this.txs.filter((t) => months.has(t.date.slice(0, 7))).length, goals });
  }
  previewGoal(payload: object, id?: number): Observable<GoalPreview> {
    const draft = payload as Pick<SavingsGoal, 'current_amount' | 'monthly_amount' | 'plan_month' | 'plan_end_month' | 'plan_open_ended' | 'status'>;
    const goals = id
      ? this.goalList.map((g) => (g.id === id ? { ...g, ...draft } : g))
      : [...this.goalList, { ...draft, id: -1, title: '', target_amount: '0', currency: 'EUR', target_date: null } as SavingsGoal];
    const month = ym(0, 1).slice(0, 7);
    const before = Number(this.buildSummary(month, this.goalList).available ?? 0);
    const after = Number(this.buildSummary(month, goals).available ?? 0);
    const month_over = after < 0 && after < before ? { month, over: money(-after) } : null;
    return of({ month_over, plan_alert: null });
  }
  save(resource: 'transactions' | 'budgets' | 'goals', payload: object, id?: number): Observable<unknown> {
    const list = this.listFor(resource);
    if (id) {
      const index = list.findIndex((row) => (row as { id: number }).id === id);
      if (index === -1) return throwError(() => ({ status: 404 }));
      list[index] = { ...list[index], ...payload };
      return of(list[index]);
    }
    const created = { id: this.nextId++, ...payload };
    (list as unknown[]).push(created);
    return of(created);
  }
  delete(resource: 'transactions' | 'budgets' | 'goals', id: number): Observable<void> {
    const list = this.listFor(resource) as { id: number }[];
    const index = list.findIndex((row) => row.id === id);
    if (index === -1) return throwError(() => ({ status: 404 }));
    list.splice(index, 1);
    return of(undefined);
  }

  private listFor(resource: 'transactions' | 'budgets' | 'goals') {
    if (resource === 'transactions') return this.txs;
    if (resource === 'budgets') return this.budgetList;
    return this.goalList;
  }

  /** Rechnet wie das Backend: verfügbar = Budget + Einnahmen − Ausgaben − Gehaltenes. „Gehaltenes“ vereinfacht die
   * Sparraten-Simulation von savings.py auf den bisher gesparten Betrag jedes Ziels, das den Monat abdeckt und nicht
   * pausiert ist — für die Demo genau genug, ohne die ganze Backend-Engine nachzubauen. */
  private buildSummary(month: string, goals: SavingsGoal[] = this.goalList): FinanceSummary {
    const rows = this.txs.filter((t) => t.date.startsWith(month));
    const income = rows.filter((t) => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = rows.filter((t) => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
    const budget = winningBudget(this.budgetList, month);
    const covering = goals.filter((g) => g.status !== 'PAUSED' && goalCovers(g, month));
    const saved = covering.reduce((sum, g) => sum + Number(g.current_amount), 0);
    const byCategory = new Map<number, number>();
    for (const t of rows.filter((t) => t.type === 'EXPENSE')) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + Number(t.amount));
    const categories = [...byCategory.entries()]
      .map(([id, amount]) => ({ id, name: CATEGORIES.find((c) => c.id === id)?.name ?? 'Sonstiges', color: CATEGORIES.find((c) => c.id === id)?.color ?? '#8a93a3', amount: money(amount) }))
      .sort((a, b) => Number(b.amount) - Number(a.amount));
    const target = covering.reduce((sum, g) => sum + Number(g.target_amount), 0);
    return {
      month,
      currency: 'EUR',
      budget: budget ? budget.amount : null,
      total: budget ? money(Number(budget.amount) + income) : null,
      saved: money(saved),
      saved_planned: '0.00',
      plan_alert: null,
      available: budget ? money(Number(budget.amount) + income - expense - saved) : null,
      income: money(income),
      expenses: money(expense),
      savings_target: money(target),
      savings_current: money(saved),
      has_data: !!budget || rows.length > 0 || covering.length > 0,
      categories,
      recent: rows
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
        .slice(0, 5),
    };
  }
}
