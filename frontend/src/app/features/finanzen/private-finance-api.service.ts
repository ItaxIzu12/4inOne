import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../core/api.config';
export interface FinanceCategory {
  id: number;
  name: string;
}
export interface FinanceTransaction {
  id: number;
  amount: string;
  type: 'INCOME' | 'EXPENSE';
  category: number;
  date: string;
  note: string;
  currency: string;
}
export interface FinanceBudget {
  id: number;
  /** Erster Monat, an dem das Budget gilt (immer der 1.). */
  month: string;
  /** Letzter Monat des Zeitraums; leer = nur `month` (oder unbegrenzt bei `open_ended`). */
  end_month: string | null;
  open_ended: boolean;
  amount: string;
  currency: string;
}
export interface SavingsGoal {
  id: number;
  title: string;
  target_amount: string;
  current_amount: string;
  target_date: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
  currency: string;
  /** Sparrate pro Monat und ihr Zeitraum — leer = keine Sparrate. */
  monthly_amount: string | null;
  plan_month: string | null;
  plan_end_month: string | null;
  plan_open_ended: boolean;
}
export interface FinanceSummary {
  month: string;
  currency: string;
  budget: string | null;
  /** Budget + Einnahmen des Monats; null ohne Monatsbudget. */
  total: string | null;
  /** In diesem Monat zurückgelegt (Änderungen des gesparten Betrags), mindert das verfügbare Budget. */
  saved: string;
  /** Davon nur geplant (Sparrate), noch nicht als gespart gebucht. */
  saved_planned: string;
  available: string | null;
  income: string;
  expenses: string;
  savings_target: string;
  savings_current: string;
  has_data: boolean;
  categories: { name: string; amount: string }[];
  recent: FinanceTransaction[];
}
/** Gilt dieses Budget im Monat `month` („JJJJ-MM“)? Wie backend MonthlyBudget.covers. */
export function budgetCovers(budget: FinanceBudget, month: string): boolean {
  const start = budget.month.slice(0, 7);
  if (month < start) return false;
  if (budget.open_ended) return true;
  return month <= (budget.end_month ? budget.end_month.slice(0, 7) : start);
}
/** „09.2026“ aus „2026-09-01“. */
function shortMonth(iso: string): string {
  return `${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}
/** Für Menschen: „Nur 09.2026“, „09.2026 bis 12.2026“, „Ab 09.2026, bis auf Weiteres“. */
export function budgetRange(budget: FinanceBudget): string {
  if (budget.open_ended) return `Ab ${shortMonth(budget.month)}, bis auf Weiteres`;
  if (budget.end_month && budget.end_month.slice(0, 7) !== budget.month.slice(0, 7))
    return `${shortMonth(budget.month)} bis ${shortMonth(budget.end_month)}`;
  return `Nur ${shortMonth(budget.month)}`;
}
/** Zeitraum der Sparrate für Menschen: „Nur 09.2026“, „09.2026 bis 12.2026“, „Ab 09.2026, bis das Ziel erreicht ist“. */
export function planRange(goal: SavingsGoal): string {
  if (!goal.plan_month) return '';
  if (goal.plan_open_ended) return `Ab ${shortMonth(goal.plan_month)}, bis das Ziel erreicht ist`;
  if (goal.plan_end_month && goal.plan_end_month.slice(0, 7) !== goal.plan_month.slice(0, 7))
    return `${shortMonth(goal.plan_month)} bis ${shortMonth(goal.plan_end_month)}`;
  return `Nur ${shortMonth(goal.plan_month)}`;
}
export function financeMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function euros(value: string | null | undefined) {
  if (value == null) return '—';
  const negative = value.startsWith('-');
  const [whole, decimal = '00'] = value.replace('-', '').split('.');
  return `${negative ? '−' : ''}${BigInt(whole).toLocaleString('de-DE')},${decimal.padEnd(2, '0')} €`;
}
@Injectable({ providedIn: 'root' })
export class PrivateFinanceApi {
  private http = inject(HttpClient);
  private base = `${API_BASE_URL}/finanzen/private`;
  summary(month = financeMonth()) {
    return this.http.get<FinanceSummary>(`${this.base}/summary/`, { params: { month } });
  }
  categories() {
    return this.http.get<FinanceCategory[]>(`${this.base}/categories/`);
  }
  setupCategories() {
    return this.http.post<FinanceCategory[]>(`${this.base}/categories/setup/`, {});
  }
  transactions() {
    return this.http.get<FinanceTransaction[]>(`${this.base}/transactions/`);
  }
  budgets() {
    return this.http.get<FinanceBudget[]>(`${this.base}/budgets/`);
  }
  goals() {
    return this.http.get<SavingsGoal[]>(`${this.base}/goals/`);
  }
  save(resource: 'transactions' | 'budgets' | 'goals', payload: object, id?: number) {
    return id
      ? this.http.patch(`${this.base}/${resource}/${id}/`, payload)
      : this.http.post(`${this.base}/${resource}/`, payload);
  }
  delete(resource: 'transactions' | 'budgets' | 'goals', id: number) {
    return this.http.delete(`${this.base}/${resource}/${id}/`);
  }
}
