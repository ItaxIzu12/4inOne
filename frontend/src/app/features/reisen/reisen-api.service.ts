import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs';
import { API_BASE_URL } from '../../core/api.config';

export interface Trip {
  id: number;
  title: string;
  destination: string;
  /** Pflichtfeld: eine Reise ohne konkreten Zeitraum wird in V1 nicht gespeichert (siehe
   * reisen/models.py Trip-Docstring). "Reiseideen" ohne Termin sind ein eigenständiges, noch nicht
   * gebautes Konzept. */
  start_date: string;
  end_date: string;
  notes: string;
  status: 'PLANNED' | 'ACTIVE' | 'DONE' | 'CANCELLED';
  /** Alle drei optional (leerer String = keine Angabe) — dienen nur dazu, die Smart-Setup-Vorschläge
   * (siehe trip-suggestions.ts) sinnvoller zu wählen; Reisen funktioniert auch ganz ohne sie. */
  travel_type: 'CITY_TRIP' | 'BEACH' | 'BUSINESS' | 'ROAD_TRIP' | 'ACTIVE' | 'FAMILY' | 'GENERAL' | '';
  transport_type: 'FLIGHT' | 'TRAIN' | 'CAR' | 'BUS' | 'OTHER' | '';
  baggage_type: 'HAND_LUGGAGE' | 'CHECKED_BAGGAGE' | 'CAR_LUGGAGE' | 'UNKNOWN' | '';
  budget_amount: string | null;
  /** Explizit statt eines impliziten Euro-Zwangs — kein Float, immer als String (Decimal) übertragen. */
  currency: 'EUR' | 'USD' | 'GBP' | 'CHF';
  created_at: string;
  updated_at: string;
  packing_total: number;
  packing_packed: number;
  tasks_open: number;
  tasks_total: number;
  events_count: number;
  budget_spent: string;
  participants: TripParticipant[];
  /** Eigene Rolle für diese Reise: 'OWNER' als Ersteller oder als Teilnehmer mit Rolle OWNER, sonst die eigene
   * Teilnehmerrolle, oder null ganz ohne Zugriff (kommt serverseitig nie vor, siehe reisen/views.py). */
  my_role: 'OWNER' | 'EDITOR' | 'VIEWER' | null;
}
export interface TripParticipant {
  id: number;
  trip: number;
  user: number;
  display_name: string;
  /** True für die Zeile des anfragenden Nutzers selbst — nötig, um "Reise verlassen" (immer erlaubt) von
   * "jemand anderen entfernen" (nur Ersteller/OWNER) zu unterscheiden, siehe reisen/serializers.py. */
  is_self: boolean;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  added_at: string;
}
export interface ContactOption {
  id: number;
  name: string;
}
export type PackingCategory = 'DOKUMENTE' | 'KLEIDUNG' | 'TECHNIK' | 'GESUNDHEIT' | 'HYGIENE' | 'SONSTIGES';
export interface PackingItem {
  id: number;
  trip: number;
  title: string;
  is_packed: boolean;
  quantity: number;
  /** Anders als bei Trip: nie leer — jeder Artikel gehört zu genau einer Kategorie, damit sich die Liste danach
   * gruppieren lässt ("Sonstiges" statt eines leeren Werts). */
  category: PackingCategory;
  note: string;
}
export interface TripTask {
  id: number;
  trip: number;
  title: string;
  due_date: string | null;
  status: 'OPEN' | 'DONE';
  note: string;
}
export interface TripEvent {
  id: number;
  trip: number;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
}
export interface TripExpense {
  id: number;
  trip: number;
  title: string;
  amount: string;
  date: string;
}
export type BudgetCategory = 'TRANSPORT' | 'UNTERKUNFT' | 'ESSEN' | 'AKTIVITAETEN' | 'SHOPPING' | 'SONSTIGES' | 'RESERVE';
/** Nur die Planung je Kategorie (siehe Trip-Budget-Anzeige) — tatsächliche Ausgaben bleiben bewusst
 * unkategorisiert in TripExpense, kein zweites vollständiges Finanzsystem. */
export interface TripBudgetCategory {
  id: number;
  trip: number;
  category: BudgetCategory;
  planned_amount: string;
}

@Injectable({ providedIn: 'root' })
export class ReisenApi {
  private http = inject(HttpClient);
  private base = `${API_BASE_URL}/reisen`;

  trips() {
    return this.http.get<Trip[]>(`${this.base}/trips/`);
  }
  saveTrip(data: Partial<Omit<Trip, 'id'>>, id?: number) {
    return id
      ? this.http.patch<Trip>(`${this.base}/trips/${id}/`, data)
      : this.http.post<Trip>(`${this.base}/trips/`, data);
  }
  removeTrip(id: number) {
    return this.http.delete<void>(`${this.base}/trips/${id}/`);
  }
  /** Reisen desselben Nutzers, deren Zeitraum sich mit dem übergebenen überschneidet (siehe
   * reisen/views.py TripViewSet.overlaps) — rein informativ, blockiert das Speichern nicht. */
  checkTripOverlaps(startDate: string, endDate: string, excludeId?: number) {
    let params = new HttpParams().set('start_date', startDate).set('end_date', endDate);
    if (excludeId) params = params.set('exclude', excludeId);
    return this.http.get<Trip[]>(`${this.base}/trips/overlaps/`, { params });
  }

  packingItems(tripId: number) {
    return this.http.get<PackingItem[]>(`${this.base}/packing-items/`, {
      params: new HttpParams().set('trip', tripId),
    });
  }
  savePackingItem(data: Partial<Omit<PackingItem, 'id'>>, id?: number) {
    return id
      ? this.http.patch<PackingItem>(`${this.base}/packing-items/${id}/`, data)
      : this.http.post<PackingItem>(`${this.base}/packing-items/`, data);
  }
  removePackingItem(id: number) {
    return this.http.delete<void>(`${this.base}/packing-items/${id}/`);
  }

  tasks(tripId: number) {
    return this.http.get<TripTask[]>(`${this.base}/tasks/`, {
      params: new HttpParams().set('trip', tripId),
    });
  }
  saveTask(data: Partial<Omit<TripTask, 'id'>>, id?: number) {
    return id
      ? this.http.patch<TripTask>(`${this.base}/tasks/${id}/`, data)
      : this.http.post<TripTask>(`${this.base}/tasks/`, data);
  }
  removeTask(id: number) {
    return this.http.delete<void>(`${this.base}/tasks/${id}/`);
  }

  events(tripId: number) {
    return this.http.get<TripEvent[]>(`${this.base}/events/`, {
      params: new HttpParams().set('trip', tripId),
    });
  }
  saveEvent(data: Partial<Omit<TripEvent, 'id'>>, id?: number) {
    return id
      ? this.http.patch<TripEvent>(`${this.base}/events/${id}/`, data)
      : this.http.post<TripEvent>(`${this.base}/events/`, data);
  }
  removeEvent(id: number) {
    return this.http.delete<void>(`${this.base}/events/${id}/`);
  }

  expenses(tripId: number) {
    return this.http.get<TripExpense[]>(`${this.base}/expenses/`, {
      params: new HttpParams().set('trip', tripId),
    });
  }
  saveExpense(data: Partial<Omit<TripExpense, 'id'>>, id?: number) {
    return id
      ? this.http.patch<TripExpense>(`${this.base}/expenses/${id}/`, data)
      : this.http.post<TripExpense>(`${this.base}/expenses/`, data);
  }
  removeExpense(id: number) {
    return this.http.delete<void>(`${this.base}/expenses/${id}/`);
  }

  budgetCategories(tripId: number) {
    return this.http.get<TripBudgetCategory[]>(`${this.base}/budget-categories/`, {
      params: new HttpParams().set('trip', tripId),
    });
  }
  saveBudgetCategory(data: Partial<Omit<TripBudgetCategory, 'id'>>, id?: number) {
    return id
      ? this.http.patch<TripBudgetCategory>(`${this.base}/budget-categories/${id}/`, data)
      : this.http.post<TripBudgetCategory>(`${this.base}/budget-categories/`, data);
  }
  removeBudgetCategory(id: number) {
    return this.http.delete<void>(`${this.base}/budget-categories/${id}/`);
  }

  /** Eigene Kontakte (core/contact_views.py) als Auswahl zum Hinzufügen eines Teilnehmers — kein Endpunkt, der
   * beliebige E-Mails gegen bestehende Konten prüft (siehe reisen/serializers.py). */
  contacts() {
    return this.http
      .get<{ contacts: { id: number; name: string }[] }>(`${API_BASE_URL}/contacts/`)
      .pipe(map((r) => r.contacts.map((c) => ({ id: c.id, name: c.name }))));
  }
  participants(tripId: number) {
    return this.http.get<TripParticipant[]>(`${this.base}/participants/`, {
      params: new HttpParams().set('trip', tripId),
    });
  }
  addParticipant(tripId: number, contactId: number, role: TripParticipant['role']) {
    return this.http.post<TripParticipant>(`${this.base}/participants/`, { trip: tripId, contact_id: contactId, role });
  }
  updateParticipantRole(id: number, role: TripParticipant['role']) {
    return this.http.patch<TripParticipant>(`${this.base}/participants/${id}/`, { role });
  }
  removeParticipant(id: number) {
    return this.http.delete<void>(`${this.base}/participants/${id}/`);
  }
}
