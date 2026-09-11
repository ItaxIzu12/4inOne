import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api.config';
import { CategoryDto } from './finanzen-api.service';

/** Minimaler Client für CategoryViewSet (finanzen/views.py) — nur create(),
 * für den "Kategorie anlegen"-Onboarding-Schritt (shared/onboarding). Farbe/
 * Icon nutzen bewusst die Model-Defaults (siehe finanzen/models.py Category)
 * statt einer eigenen Auswahl-UI — das wäre für einen Onboarding-Schritt
 * mehr, als der Zweck ("überhaupt eine erste Kategorie haben") braucht. */
@Injectable({ providedIn: 'root' })
export class CategoryApiService {
  private readonly http = inject(HttpClient);

  create(name: string): Observable<CategoryDto> {
    return this.http.post<CategoryDto>(`${API_BASE_URL}/finanzen/kategorien/`, { name });
  }
}
