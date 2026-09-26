import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../core/api.config';
export interface FinanceCategory {
  id: number;
  name: string;
  /** Feste Farbe der Kategorie (backend finanzen/category_colors.py), nie nach Listenposition. */
  color: string;
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
  /** Erster Monat (12 Monate voraus), in dem die Sparraten das Budget sprengen — sonst null. */
  plan_alert: { month: string; over: string; planned: string } | null;
  available: string | null;
  income: string;
  expenses: string;
  savings_target: string;
  savings_current: string;
  has_data: boolean;
  /** Nach Betrag sortiert; id ist null für Ausgaben ohne Kategorie. */
  categories: { id: number | null; name: string; color: string; amount: string }[];
  recent: FinanceTransaction[];
}
export interface GoalPreview {
  /** Im laufenden Monat reicht das verfügbare Budget nach der Änderung nicht. */
  month_over: { month: string; over: string } | null;
  /** In einem der nächsten Monate reichen Budget und Einnahmen nicht für alle Sparraten. */
  plan_alert: { month: string; over: string; planned: string } | null;
}
/** Farbe für Ausgaben ohne Kategorie (erscheinen als „Sonstiges“) — wie backend category_colors.UNCATEGORISED_COLOR. */
export const UNCATEGORISED_COLOR = '#8a93a3';
/** Gilt dieses Budget im Monat `month` („JJJJ-MM“)? Wie backend MonthlyBudget.covers. */
export function budgetCovers(budget: FinanceBudget, month: string): boolean {
  const start = budget.month.slice(0, 7);
  if (month < start) return false;
  if (budget.open_ended) return true;
  return month <= (budget.end_month ? budget.end_month.slice(0, 7) : start);
}
/** Das Budget, das in `month` gilt: unter allen abdeckenden das mit dem spätesten Start (wie im Backend). */
export function winningBudget(budgets: FinanceBudget[], month: string): FinanceBudget | null {
  return budgets.filter((b) => budgetCovers(b, month)).sort((a, b) => b.month.localeCompare(a.month))[0] ?? null;
}
const shiftYm = (ym: string, delta: number) => {
  const total = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
};
/** Der Zeitraum eines Budgets, den ein ANDERES, später beginnendes Budget übernimmt (`to` null = bis auf Weiteres) —
 * sonst null. Rein zur Warnung im Dialog: `draft` ist, was gerade eingegeben wird (`end` leer = nur der Startmonat,
 * `open` = bis auf Weiteres). Nur die erste zusammenhängende Überdeckung wird gemeldet. */
export function budgetOverride(
  draft: { start: string; end: string; open: boolean },
  others: FinanceBudget[],
): { from: string; to: string | null; amount: string } | null {
  const last = draft.open ? null : draft.end || draft.start;
  let from: string | null = null;
  let amount = '';
  for (let i = 0; i < 240; i++) {
    const month = shiftYm(draft.start, i);
    if (last !== null && month > last) return from ? { from, to: last, amount } : null;
    const taker = others
      .filter((b) => b.month.slice(0, 7) > draft.start && budgetCovers(b, month))
      .sort((a, b) => b.month.localeCompare(a.month))[0];
    if (taker && !from) [from, amount] = [month, taker.amount];
    if (!taker && from) return { from, to: shiftYm(month, -1), amount };
  }
  return from ? { from, to: null, amount } : null;
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
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const longMonth = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
/** Ohne Fachjargon: „August 2026“, „März – Juni 2026“, „November 2025 – Februar 2026“, „Ab November 2025, unbefristet“. */
export function budgetSpan(budget: FinanceBudget): string {
  if (budget.open_ended) return `Ab ${longMonth(budget.month)}, unbefristet`;
  if (budget.end_month && budget.end_month.slice(0, 7) !== budget.month.slice(0, 7)) {
    const sameYear = budget.month.slice(0, 4) === budget.end_month.slice(0, 4);
    const from = sameYear ? MONTHS[Number(budget.month.slice(5, 7)) - 1] : longMonth(budget.month);
    return `${from} – ${longMonth(budget.end_month)}`;
  }
  return longMonth(budget.month);
}
/** Zeitraum des Sparziels für Menschen: „Nur 09.2026“, „09.2026 bis 12.2026“, „Ab 09.2026, bis auf Weiteres“. */
/** Gilt dieses Ziel (bzw. dieser Zeitraum aus dem Formular) im Monat `month` („JJJJ-MM“)? Wie backend SavingsGoal.covers. */
export function goalCovers(
  period: { plan_month: string | null; plan_end_month: string | null; plan_open_ended: boolean },
  month: string,
): boolean {
  if (!period.plan_month) return true;
  const start = period.plan_month.slice(0, 7);
  if (month < start) return false;
  if (period.plan_open_ended) return true;
  return month <= (period.plan_end_month ? period.plan_end_month.slice(0, 7) : start);
}
export function planRange(goal: SavingsGoal): string {
  if (!goal.plan_month) return '';
  if (goal.plan_open_ended) return `Ab ${shortMonth(goal.plan_month)}, bis auf Weiteres`;
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
  /** Die Sparziele, die in diesem Monat („JJJJ-MM“) gelten. */
  goals(month: string) {
    return this.http.get<SavingsGoal[]>(`${this.base}/goals/`, { params: { month } });
  }
  save(resource: 'transactions' | 'budgets' | 'goals', payload: object, id?: number) {
    return id
      ? this.http.patch(`${this.base}/${resource}/${id}/`, payload)
      : this.http.post(`${this.base}/${resource}/`, payload);
  }
  /** Was hängt an diesem Budget? Buchungen/Sparziele in Monaten, die ohne es gar kein Budget mehr hätten. */
  budgetImpact(id: number) {
    return this.http.get<{ transactions: number; goals: number }>(`${this.base}/budgets/${id}/impact/`);
  }
  /** Vorschau VOR dem Speichern: würde die Änderung das Budget sprengen? Speichert nichts. */
  previewGoal(payload: object, id?: number) {
    const url = id ? `${this.base}/goals/${id}/preview/` : `${this.base}/goals/preview/`;
    return this.http.post<GoalPreview>(url, payload);
  }
  delete(resource: 'transactions' | 'budgets' | 'goals', id: number) {
    return this.http.delete(`${this.base}/${resource}/${id}/`);
  }
}
