import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AnalysenDto,
  BerichtDownload,
  BerichtPeriod,
  CategoryDto,
  OverviewDto,
  RecurringDeductionDto,
  TransactionDto,
  TransactionPage,
} from './finanzen-api.service';

export interface NewTransactionInput {
  amount: number;
  description: string;
  categoryId: number | string;
  // Ausgabedatum als "YYYY-MM-DD" (kein Zeitstempel) — wählbar, Standardwert
  // "heute" wird von der Komponente gesetzt (finanzen.ts), nicht hier.
  // Serverseitig validiert (finanzen/serializers.py validate_datum): nicht
  // in der Zukunft, nicht mehr als 12 Monate zurück.
  datum: string;
}

/**
 * Trennt die Finanzen-Komponente von der Frage "echte API oder Demo-Daten?"
 * — sie kennt nur dieses Interface, welche Implementierung tatsächlich
 * verwendet wird, entscheidet die Route (siehe app.routes.ts: providers pro
 * Route, / bekommt DemoFinanzenDataProvider, /app RealFinanzenDataProvider).
 */
export interface FinanzenDataProvider {
  getOverview(): Observable<OverviewDto>;
  searchTransactions(query: string, cursorUrl?: string | null): Observable<TransactionPage>;
  addTransaction(input: NewTransactionInput): Observable<TransactionDto>;
  updateTransaction(id: number | string, input: NewTransactionInput): Observable<TransactionDto>;
  deleteTransaction(id: number | string): Observable<void>;
  getCategories(): Observable<CategoryDto[]>;
  updateCategoryGoal(id: number | string, monthlyGoal: number | null): Observable<CategoryDto>;
  createCategory(name: string, color: string, iconKey: string, monthlyGoal: number | null): Observable<CategoryDto>;

  // ---------- Analysen-Tab (Verfügbares Einkommen) ----------
  getAnalysen(): Observable<AnalysenDto>;
  updateOwnIncome(monthlyIncome: number | null): Observable<{ monthly_income: string | null }>;
  updateHouseholdBuffer(monthlyBuffer: number): Observable<{ monthly_buffer: string }>;
  addRecurringDeduction(name: string, amount: number, categoryId: number | string | null): Observable<RecurringDeductionDto>;
  updateRecurringDeduction(
    id: number | string,
    name: string,
    amount: number,
    categoryId: number | string | null,
    active: boolean,
  ): Observable<RecurringDeductionDto>;
  deleteRecurringDeduction(id: number | string): Observable<void>;

  // ---------- Bericht-Download (CSV/PDF, Monat oder Jahr) ----------
  // Zum Archivieren/Ausdrucken — NICHT zu verwechseln mit dem "Für
  // KI-Analyse exportieren"-Textblock (der erzeugt keine Datei, siehe
  // FinanzenTab.md §2.6). Im Demo-Modus ist NUR CSV verfügbar (siehe
  // demo-finanzen-data-provider.ts) — ein PDF-Renderer allein für die
  // öffentliche Demo wäre eine neue Abhängigkeit ohne echten Gegenwert.
  downloadBericht(format: 'csv' | 'pdf', period: BerichtPeriod): Observable<BerichtDownload>;
}

export const FINANZEN_DATA_PROVIDER = new InjectionToken<FinanzenDataProvider>('FinanzenDataProvider');
