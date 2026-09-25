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
  month: string;
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
}
export interface FinanceSummary {
  month: string;
  currency: string;
  budget: string | null;
  available: string | null;
  income: string;
  expenses: string;
  savings_target: string;
  savings_current: string;
  has_data: boolean;
  categories: { name: string; amount: string }[];
  recent: FinanceTransaction[];
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
