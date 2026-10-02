import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api.config';

export interface PrivateCategoryCreated {
  id: number;
  name: string;
  color: string;
}

/** Minimaler Client für den "Kategorie anlegen"-Onboarding-Schritt
 * (shared/onboarding). Legt die Kategorie in den PRIVATEN Finanzen an
 * (ADR-001) — die alten Haushaltsfinanzen sind eingefroren. Die Farbe vergibt
 * das Backend fest nach Namen (finanzen/category_colors.py). */
@Injectable({ providedIn: 'root' })
export class CategoryApiService {
  private readonly http = inject(HttpClient);

  create(name: string): Observable<PrivateCategoryCreated> {
    return this.http.post<PrivateCategoryCreated>(`${API_BASE_URL}/finanzen/private/categories/`, { name });
  }
}
