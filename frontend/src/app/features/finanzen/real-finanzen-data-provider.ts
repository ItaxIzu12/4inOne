import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AnalysenDto,
  CategoryDto,
  FinanzenApiService,
  OverviewDto,
  RecurringDeductionDto,
  TransactionDto,
  TransactionPage,
} from './finanzen-api.service';
import { FinanzenDataProvider, NewTransactionInput } from './finanzen-data-provider';

/** Dünner Adapter auf den bestehenden FinanzenApiService (echte
 * /api/v1/finanzen/-Endpunkte) hinter dem FinanzenDataProvider-Interface —
 * für /app registriert (siehe app.routes.ts). */
@Injectable()
export class RealFinanzenDataProvider implements FinanzenDataProvider {
  private readonly api = inject(FinanzenApiService);

  getOverview(): Observable<OverviewDto> {
    return this.api.getOverview();
  }

  searchTransactions(query: string, cursorUrl?: string | null): Observable<TransactionPage> {
    return this.api.searchTransactions(query, cursorUrl);
  }

  getCategories(): Observable<CategoryDto[]> {
    return this.api.listCategories();
  }

  addTransaction(input: NewTransactionInput): Observable<TransactionDto> {
    // POSITIVER Betrag: OverviewView.total_spent (finanzen/views.py) rechnet
    // Sum('amount') OHNE abs() — ein negativer Wert hätte den Budget-
    // "planned"-Betrag verringert statt erhöht. Das Vorzeichen "-" in der
    // Tabelle (finanzen.html) ist eine reine Anzeige-Konvention (MVP kennt
    // nur Ausgaben, kein Einnahmen-Konzept), keine gespeicherte Eigenschaft.
    return this.api.addTransaction(Math.abs(input.amount), input.description, input.categoryId);
  }

  updateTransaction(id: number | string, input: NewTransactionInput): Observable<TransactionDto> {
    return this.api.updateTransaction(id, Math.abs(input.amount), input.description, input.categoryId);
  }

  deleteTransaction(id: number | string): Observable<void> {
    return this.api.deleteTransaction(id);
  }

  updateCategoryGoal(id: number | string, monthlyGoal: number | null): Observable<CategoryDto> {
    return this.api.updateCategoryGoal(id, monthlyGoal);
  }

  createCategory(name: string, color: string, iconKey: string, monthlyGoal: number | null): Observable<CategoryDto> {
    return this.api.createCategory(name, color, iconKey, monthlyGoal);
  }

  getAnalysen(): Observable<AnalysenDto> {
    return this.api.getAnalysen();
  }

  updateOwnIncome(monthlyIncome: number | null): Observable<{ monthly_income: string | null }> {
    return this.api.updateOwnIncome(monthlyIncome);
  }

  updateHouseholdBuffer(monthlyBuffer: number): Observable<{ monthly_buffer: string }> {
    return this.api.updateHouseholdBuffer(monthlyBuffer);
  }

  addRecurringDeduction(
    name: string,
    amount: number,
    categoryId: number | string | null,
  ): Observable<RecurringDeductionDto> {
    return this.api.addRecurringDeduction(name, amount, categoryId);
  }

  updateRecurringDeduction(
    id: number | string,
    name: string,
    amount: number,
    categoryId: number | string | null,
    active: boolean,
  ): Observable<RecurringDeductionDto> {
    return this.api.updateRecurringDeduction(id, name, amount, categoryId, active);
  }

  deleteRecurringDeduction(id: number | string): Observable<void> {
    return this.api.deleteRecurringDeduction(id);
  }
}
