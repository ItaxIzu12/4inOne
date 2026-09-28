import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { API_BASE_URL } from '../../core/api.config';

export interface Trip {
  id: number;
  title: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  notes: string;
  status: 'PLANNED' | 'ACTIVE' | 'DONE' | 'CANCELLED';
  budget_amount: string | null;
  created_at: string;
  updated_at: string;
  packing_total: number;
  packing_packed: number;
  tasks_open: number;
  tasks_total: number;
  events_count: number;
  budget_spent: string;
}
export interface PackingItem {
  id: number;
  trip: number;
  title: string;
  is_packed: boolean;
  quantity: number;
}
export interface TripTask {
  id: number;
  trip: number;
  title: string;
  due_date: string | null;
  status: 'OPEN' | 'DONE';
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
}
