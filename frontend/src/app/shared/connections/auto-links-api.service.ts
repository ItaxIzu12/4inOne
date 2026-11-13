import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api.config';

/** Connection Engine V2 (backend connections/auto_links.py): abgeleitete Verbindungen — eine Quelle, kein Kopieren. */
export type AutoKind = 'CONTRACT_FINANCE' | 'CONTRACT_REMINDER' | 'DEVICE_MAINTENANCE' | 'TRIP_CALENDAR' | 'TRIP_ITINERARY' | 'SAVINGS_REMINDER' | 'HOUSEHOLD_TASKS';
export type AutoSourceType = 'CONTRACT' | 'DEVICE' | 'TRIP' | 'SAVINGS_GOAL' | 'HOUSEHOLD';
export type AutoStatus = 'ACTIVE' | 'PAUSED';

export interface AutoLinkState {
  kind: AutoKind;
  label: string;
  link_id: number | null;
  status: AutoStatus | null;
  /** Was genau wo erscheint, z. B. „Finanzen › Geplant: 39,99 € monatlich ab Juli 2026 — keine Buchung.“ */
  preview: string;
  /** Warum (noch) nichts erscheinen kann — es wird nie etwas geraten. */
  problem: string;
  available: boolean;
}

/** Abgeleiteter, nur lesbarer Kalendereintrag in Organisation. */
export interface DerivedCalendarItem {
  key: string;
  kind: AutoKind;
  title: string;
  date: string;
  end_date: string | null;
  /** false bei Programmpunkten einer Reise (TRIP_ITINERARY) – dann mit Uhrzeit */
  all_day: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  /** Ort (Reiseziel bzw. Ort des Programmpunkts) */
  location?: string;
  /** Zusammenhang: beim Reisezeitraum „Städtereise · Zug“, beim Programmpunkt der Name der Reise */
  context?: string;
  source_type: AutoSourceType;
  source_id: number;
  domain: 'haushalt' | 'reisen' | 'finanzen';
}

export interface LinkedHouseholdTask {
  id: number | string;
  title: string;
  due_date: string | null;
  room: string;
  assigned_to_me: boolean;
}

@Injectable({ providedIn: 'root' })
export class AutoLinksApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/connections/auto`;

  states(sourceType: AutoSourceType, sourceId: number | string): Observable<AutoLinkState[]> {
    return this.http.get<AutoLinkState[]>(`${this.base}/`, { params: { source_type: sourceType, source_id: String(sourceId) } });
  }
  create(kind: AutoKind, sourceId: number | string): Observable<AutoLinkState> {
    return this.http.post<AutoLinkState>(`${this.base}/`, { kind, source_id: sourceId });
  }
  setStatus(linkId: number, status: AutoStatus): Observable<AutoLinkState> {
    return this.http.patch<AutoLinkState>(`${this.base}/${linkId}/`, { status });
  }
  unlink(linkId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${linkId}/`);
  }
  calendar(start: string, end: string): Observable<DerivedCalendarItem[]> {
    return this.http.get<DerivedCalendarItem[]>(`${this.base}/calendar/`, { params: { start, end } });
  }
  householdTasks(): Observable<{ household_id: number | null; tasks: LinkedHouseholdTask[] }> {
    return this.http.get<{ household_id: number | null; tasks: LinkedHouseholdTask[] }>(`${this.base}/household-tasks/`);
  }
  /** Erledigen über die Haushalt-API — derselbe Datensatz, keine Kopie (CON-03). */
  completeHouseholdTask(id: number | string): Observable<unknown> {
    return this.http.post(`${API_BASE_URL}/haushalt/aufgaben/${id}/erledigt/`, {});
  }
}
