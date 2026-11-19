import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { API_BASE_URL } from '../../core/api.config';

export type Area = 'finanzen' | 'haushalt' | 'organisation' | 'reisen';
export interface Category {
  id: number;
  name: string;
  color: string;
}

/**
 * Der erste echte Eintrag im Onboarding (Schritt 3) — mit so wenigen Feldern wie möglich, über dieselben Endpunkte
 * wie die Bereiche selbst (Rechte prüft das Backend). Getestet: backend/core/test_onboarding.py
 * › test_first_real_entry_from_onboarding_works_with_minimal_input.
 */
@Injectable({ providedIn: 'root' })
export class FirstEntryService {
  private readonly http = inject(HttpClient);

  /** Eigene Ausgaben-Kategorien; ein neues Konto bekommt bei Bedarf die Standardkategorien. */
  categories(): Observable<Category[]> {
    const base = `${API_BASE_URL}/finanzen/private/categories/`;
    return this.http.get<Category[]>(base).pipe(
      switchMap((list) => (list.length ? of(list) : this.http.post<Category[]>(`${base}setup/`, {}))),
    );
  }

  expense(amount: number, note: string, category: number, date: string, currency: string): Observable<string> {
    return this.http
      .post(`${API_BASE_URL}/finanzen/private/transactions/`, {
        amount: amount.toFixed(2),
        type: 'EXPENSE',
        category,
        date,
        note,
        currency,
      })
      .pipe(map(() => 'finanzen'));
  }

  chore(title: string, dueDate: string | null): Observable<string> {
    return this.http.post(`${API_BASE_URL}/haushalt/aufgaben/`, { title, due_date: dueDate }).pipe(map(() => 'haushalt'));
  }

  todo(title: string, dueDate: string | null): Observable<string> {
    return this.http.post(`${API_BASE_URL}/organisation/tasks/`, { title, due_date: dueDate }).pipe(map(() => 'organisation'));
  }

  trip(destination: string, start: string, end: string): Observable<string> {
    return this.http
      .post(`${API_BASE_URL}/reisen/trips/`, { title: destination, destination, start_date: start, end_date: end })
      .pipe(map(() => 'reisen'));
  }
}
