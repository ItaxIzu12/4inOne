import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  AnalysenDto,
  CategoryDto,
  FairnessEntryDto,
  HouseholdMemberDto,
  OverviewDto,
  RecurringDeductionDto,
  TransactionDto,
  TransactionPage,
} from './finanzen-api.service';
import { berechneInsightsDemo } from './demo-insights';
import { FinanzenDataProvider, NewTransactionInput } from './finanzen-data-provider';

// Sicherheitskritisch (siehe app.routes.ts-Kommentar bei der Provider-
// Registrierung): DIESE Datei darf zu KEINEM Zeitpunkt HttpClient oder einen
// anderen netzwerkfähigen Service importieren. Das ist keine Konvention,
// sondern strukturell erzwungen — es gibt hier schlicht kein `inject()`,
// keinen Konstruktor-Parameter und kein Feld, über das ein HTTP-Aufruf
// überhaupt möglich wäre. Alle Daten unten sind reine In-Memory-Literale.

// Farben/icon_keys exakt wie die Standard-Kategorien, die echte Haushalte
// bei der Registrierung automatisch bekommen (finanzen/signals.py) — Demo
// und echter Erstzustand sollen sich nicht unterscheiden. is_default: true
// wie bei echten Standard-Kategorien, damit die Demo auch den Namensschutz
// zeigt (siehe submitCategoryGoal() in finanzen.ts — ändert nie den Namen,
// betrifft die Demo also ohnehin nicht, aber konsistent gehalten).
// monthly_goal nur bei Fixkosten gesetzt, damit die Ziel-Anzeige sichtbar ist.
function seedCategories(): CategoryDto[] {
  return [
    { id: 'demo-fixkosten', name: 'Fixkosten', color: '#5b3fd6', icon_key: 'fixkosten', monthly_goal: '900', is_default: true },
    { id: 'demo-haushalt', name: 'Haushalt', color: '#ffb75e', icon_key: 'haushalt', monthly_goal: null, is_default: true },
    { id: 'demo-sonstiges', name: 'Sonstiges', color: '#c23b52', icon_key: 'sonstiges', monthly_goal: null, is_default: true },
  ];
}

const DEMO_BUDGET_TOTAL = 1950;
const DEMO_HOUSEHOLD_NAME = 'Haushalt Zuhause';
const DEMO_MEMBERS: HouseholdMemberDto[] = [
  { id: 'demo-member-anna', name: 'Anna' },
  { id: 'demo-member-jonas', name: 'Jonas' },
];
// Statisch statt aus den Demo-Transaktionen berechnet — die haben kein
// created_by-Konzept, das wäre für Demo-Zwecke unnötiger Mehraufwand.
const DEMO_FAIRNESS: FairnessEntryDto[] = [
  { user_id: 'demo-member-anna', name: 'Anna', percentage: 58 },
  { user_id: 'demo-member-jonas', name: 'Jonas', percentage: 42 },
];

// Analysen-Tab: "eigenes" Einkommen (Anna, die Demo-Perspektive) + Jonas'
// Einkommen NUR als Teil der Summe — dieselbe Regel wie im echten Backend
// (finanzen/serializers.py HouseholdMembershipIncomeSerializer), hier als
// fester Wert statt einer zweiten Membership, weil die Demo kein echtes
// Mehrpersonen-Datenmodell hat.
const DEMO_OWN_INCOME = 3200;
const DEMO_OTHER_MEMBERS_INCOME_TOTAL = 2400;
const DEMO_BUFFER_INITIAL = 300;

function seedDeductions(categories: CategoryDto[]): RecurringDeductionDto[] {
  return [
    { id: 'demo-deduction-miete', name: 'Miete', amount: '900', category: categories[0], active: true },
    { id: 'demo-deduction-versicherung', name: 'Versicherung', amount: '65', category: categories[0], active: true },
  ];
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

/** Feste Beispieldaten für die öffentliche Demo-Route (/, siehe
 * app.routes.ts) — add-/update-/deleteTransaction() und updateCategoryGoal()
 * ändern NUR den In-Memory-Zustand dieser einen Instanz (Router-Provider
 * erzeugt pro Aktivierung der Route eine frische Instanz, siehe providedIn
 * fehlt bewusst: kein 'root', damit kein Zustand zwischen Besuchen übrig
 * bleibt). categories/transactions sind deshalb bewusst INSTANZ-Felder (eine
 * frische Kopie pro Provider-Instanz), nicht die Modul-Konstanten direkt —
 * sonst würde eine Änderung in einer Instanz alle anderen ebenfalls
 * beeinflussen. Ein Reload der Seite verwirft den Zustand komplett — das ist
 * im Demo-Modus korrekt, kein Bug. */
@Injectable()
export class DemoFinanzenDataProvider implements FinanzenDataProvider {
  private categories: CategoryDto[] = seedCategories();
  private transactions: TransactionDto[] = this.seedTransactions();
  private nextId = 100;

  // ---------- Analysen-Tab (Verfügbares Einkommen) ----------
  private ownIncome: number | null = DEMO_OWN_INCOME;
  private buffer = DEMO_BUFFER_INITIAL;
  private deductions: RecurringDeductionDto[] = seedDeductions(this.categories);
  private nextDeductionId = 100;

  // Beträge POSITIV gespeichert — dieselbe Konvention wie das echte Backend
  // (OverviewView.total_spent = Sum('amount') OHNE abs(), siehe
  // finanzen/views.py). Das "-" vor dem Betrag ist reine Anzeige-Konvention
  // im Template (finanzen.html), keine gespeicherte Eigenschaft.
  private seedTransactions(): TransactionDto[] {
    return [
      { id: 'demo-1', account: 0, category: this.categories[0], amount: '850', description: 'Miete', occurred_at: daysAgo(3), created_at: daysAgo(3) },
      { id: 'demo-2', account: 0, category: this.categories[1], amount: '186', description: 'Wocheneinkauf', occurred_at: daysAgo(2), created_at: daysAgo(2) },
      { id: 'demo-3', account: 0, category: this.categories[1], amount: '74', description: 'Drogerie', occurred_at: daysAgo(1), created_at: daysAgo(1) },
      { id: 'demo-4', account: 0, category: this.categories[2], amount: '68.5', description: 'Restaurant', occurred_at: daysAgo(0), created_at: daysAgo(0) },
      { id: 'demo-5', account: 0, category: this.categories[2], amount: '61.5', description: 'Streaming-Abo', occurred_at: daysAgo(0), created_at: daysAgo(0) },
    ];
  }

  getOverview(): Observable<OverviewDto> {
    const planned = this.transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

    // ALLE Kategorien, nicht nur die mit Ausgaben — dieselbe LEFT-JOIN-
    // Semantik wie OverviewView im echten Backend (finanzen/views.py), damit
    // eine Kategorie mit Ziel aber (noch) ohne Ausgabe trotzdem erscheint.
    const spentByCategory = new Map<string, number>();
    for (const tx of this.transactions) {
      if (!tx.category) continue;
      const key = String(tx.category.id);
      spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + Number(tx.amount));
    }

    return of({
      budget: { planned: String(planned), total: String(DEMO_BUDGET_TOTAL) },
      categories: [...this.categories]
        .map((category) => ({
          id: category.id,
          name: category.name,
          color: category.color,
          icon_key: category.icon_key,
          monthly_goal: category.monthly_goal,
          amount: String(spentByCategory.get(String(category.id)) ?? 0),
        }))
        .sort((a, b) => Number(b.amount) - Number(a.amount)),
      member_count: DEMO_MEMBERS.length,
      household_name: DEMO_HOUSEHOLD_NAME,
      members: DEMO_MEMBERS,
      fairness: DEMO_FAIRNESS,
    });
  }

  searchTransactions(query: string): Observable<TransactionPage> {
    const q = query.trim().toLowerCase();
    const results = q
      ? this.transactions.filter(
          (tx) => tx.description.toLowerCase().includes(q) || (tx.category?.name.toLowerCase().includes(q) ?? false),
        )
      : this.transactions;

    // Demo-Datensatz ist klein genug, um immer als eine Seite zurückzukommen
    // — kein cursorUrl-Parameter nötig, "Weitere laden" erscheint dadurch nie.
    return of({ next: null, previous: null, results: [...results].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)) });
  }

  getCategories(): Observable<CategoryDto[]> {
    return of(this.categories);
  }

  addTransaction(input: NewTransactionInput): Observable<TransactionDto> {
    const category = this.categories.find((c) => String(c.id) === String(input.categoryId)) ?? null;
    const transaction: TransactionDto = {
      id: `demo-new-${this.nextId++}`,
      account: 0,
      category,
      amount: String(Math.abs(input.amount)),
      description: input.description || 'Ausgabe',
      occurred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    this.transactions = [transaction, ...this.transactions];
    return of(transaction);
  }

  updateTransaction(id: number | string, input: NewTransactionInput): Observable<TransactionDto> {
    const index = this.transactions.findIndex((tx) => String(tx.id) === String(id));
    if (index === -1) {
      return throwError(() => new Error('Demo-Transaktion nicht gefunden.'));
    }
    const category = this.categories.find((c) => String(c.id) === String(input.categoryId)) ?? null;
    const updated: TransactionDto = {
      ...this.transactions[index],
      amount: String(Math.abs(input.amount)),
      description: input.description || 'Ausgabe',
      category,
    };
    this.transactions = [...this.transactions.slice(0, index), updated, ...this.transactions.slice(index + 1)];
    return of(updated);
  }

  deleteTransaction(id: number | string): Observable<void> {
    this.transactions = this.transactions.filter((tx) => String(tx.id) !== String(id));
    return of(undefined);
  }

  updateCategoryGoal(id: number | string, monthlyGoal: number | null): Observable<CategoryDto> {
    const index = this.categories.findIndex((c) => String(c.id) === String(id));
    if (index === -1) {
      return throwError(() => new Error('Demo-Kategorie nicht gefunden.'));
    }
    const updated: CategoryDto = { ...this.categories[index], monthly_goal: monthlyGoal !== null ? String(monthlyGoal) : null };
    this.categories = [...this.categories.slice(0, index), updated, ...this.categories.slice(index + 1)];
    return of(updated);
  }

  // ---------- Analysen-Tab (Verfügbares Einkommen) ----------

  getAnalysen(): Observable<AnalysenDto> {
    const householdTotalIncome = (this.ownIncome ?? 0) + DEMO_OTHER_MEMBERS_INCOME_TOTAL;
    const activeDeductionsTotal = this.deductions
      .filter((d) => d.active)
      .reduce((sum, d) => sum + Number(d.amount), 0);
    const verfuegbaresEinkommen = householdTotalIncome - activeDeductionsTotal - this.buffer;

    return of({
      monthly_income: this.ownIncome !== null ? String(this.ownIncome) : null,
      household_total_income: String(householdTotalIncome),
      monthly_buffer: String(this.buffer),
      recurring_deductions: [...this.deductions],
      verfuegbares_einkommen: String(verfuegbaresEinkommen),
      insights: berechneInsightsDemo(householdTotalIncome, activeDeductionsTotal, this.buffer),
    });
  }

  updateOwnIncome(monthlyIncome: number | null): Observable<{ monthly_income: string | null }> {
    this.ownIncome = monthlyIncome;
    return of({ monthly_income: monthlyIncome !== null ? String(monthlyIncome) : null });
  }

  updateHouseholdBuffer(monthlyBuffer: number): Observable<{ monthly_buffer: string }> {
    this.buffer = monthlyBuffer;
    return of({ monthly_buffer: String(monthlyBuffer) });
  }

  addRecurringDeduction(
    name: string,
    amount: number,
    categoryId: number | string | null,
  ): Observable<RecurringDeductionDto> {
    const category = this.categories.find((c) => String(c.id) === String(categoryId)) ?? null;
    const deduction: RecurringDeductionDto = {
      id: `demo-deduction-new-${this.nextDeductionId++}`,
      name,
      amount: String(amount),
      category,
      active: true,
    };
    this.deductions = [...this.deductions, deduction];
    return of(deduction);
  }

  updateRecurringDeduction(
    id: number | string,
    name: string,
    amount: number,
    categoryId: number | string | null,
    active: boolean,
  ): Observable<RecurringDeductionDto> {
    const index = this.deductions.findIndex((d) => String(d.id) === String(id));
    if (index === -1) {
      return throwError(() => new Error('Demo-Abzug nicht gefunden.'));
    }
    const category = this.categories.find((c) => String(c.id) === String(categoryId)) ?? null;
    const updated: RecurringDeductionDto = { ...this.deductions[index], name, amount: String(amount), category, active };
    this.deductions = [...this.deductions.slice(0, index), updated, ...this.deductions.slice(index + 1)];
    return of(updated);
  }

  deleteRecurringDeduction(id: number | string): Observable<void> {
    this.deductions = this.deductions.filter((d) => String(d.id) !== String(id));
    return of(undefined);
  }
}
