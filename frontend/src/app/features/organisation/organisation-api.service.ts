import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../core/api.config';
import { EventImportRow } from './org-import';
/** Art eines Termins — backend organisation/models.py EventCategory. */
export type EventCategory = 'gesundheit' | 'sport' | 'familie' | 'arbeit' | 'freizeit' | 'sonstiges';
/** Wiederholung eines Termins oder einer Aufgabe — backend core/recurrence.py SIMPLE. */
export type Repeat = 'daily' | 'weekly' | 'monthly' | 'yearly';
export interface PersonalEvent {
  id: number;
  title: string;
  /** In der Zeitraum-Liste: Beginn dieses Vorkommens (bei Wiederholungen). */
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  recurrence: Repeat | '';
  location: string;
  description: string;
  category?: EventCategory;
  /** Nur in der Zeitraum-Liste: Beginn der Serie (zum Bearbeiten). */
  series_starts_at?: string;
}
export type EventInput = Omit<PersonalEvent, 'id' | 'series_starts_at'>;
/** Ergebnis von POST events/import/ — je Termin „new“, „duplicate“ oder „invalid“ (mit Grund). */
export interface EventImportResult {
  new: number;
  duplicates: number;
  invalid: number;
  created: number;
  rows: { row: number; status: 'new' | 'duplicate' | 'invalid'; message: string }[];
}
export interface PersonalTask {
  id: number;
  title: string;
  description: string;
  due_date: string | null;
  due_time: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  /** Freies Projekt zum Gruppieren („Familie“, „Hausbau“); leer = ohne Projekt. */
  project?: string;
  /** Lesend: die Wiederholung; 'custom' für ältere Intervalle. */
  repeat?: Repeat | 'custom' | null;
  recurrence_days?: number | null;
  recurrence_months?: number | null;
  last_done_at?: string | null;
  updated_at?: string;
}
/** Schreibend: `recurrence` setzt die Wiederholung (null = einmalig). */
export type TaskInput = Partial<Omit<PersonalTask, 'id' | 'repeat'>> & { recurrence?: Repeat | null };
export interface PersonalNote {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}
export interface TodayItem {
  kind: 'event' | 'task';
  id: number;
  title: string;
  at: string;
  overdue: boolean;
  all_day?: boolean;
  location?: string;
  status?: PersonalTask['status'];
}
export interface TodayData {
  date: string;
  timezone: string;
  items: TodayItem[];
  event_count: number;
  open_task_count: number;
  overdue_count: number;
}
/** GET /organisation/summary/ — Kennzahlen für das Dashboard. */
export interface OrganisationSummary {
  date: string;
  events_today: number;
  tasks_today: number;
  overdue_tasks: number;
}
export interface DayRange {
  start: string;
  end: string;
}
export const organisationTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
@Injectable({ providedIn: 'root' })
export class OrganisationApi {
  private http = inject(HttpClient);
  private base = `${API_BASE_URL}/organisation`;
  /** Termine des Zeitraums (Tage einschließlich), wiederkehrende einmal pro Vorkommen. */
  events(range: DayRange) {
    return this.http.get<PersonalEvent[]>(`${this.base}/events/`, {
      params: { start: range.start, end: range.end, timezone: organisationTimezone() },
    });
  }
  event(id: number) {
    return this.http.get<PersonalEvent>(`${this.base}/events/${id}/`);
  }
  /** Kalenderdatei übernehmen (Termine aus org-import.ts); dryRun = nur prüfen für die Vorschau. */
  importEvents(rows: EventImportRow[], dryRun: boolean) {
    return this.http.post<EventImportResult>(`${this.base}/events/import/`, { rows, dry_run: dryRun });
  }
  summary() {
    return this.http.get<OrganisationSummary>(`${this.base}/summary/`, { params: { timezone: organisationTimezone() } });
  }
  tasks() {
    return this.http.get<PersonalTask[]>(`${this.base}/tasks/`);
  }
  today() {
    return this.http.get<TodayData>(`${this.base}/today/`, {
      params: { timezone: organisationTimezone() },
    });
  }
  saveEvent(data: EventInput, id?: number) {
    return id
      ? this.http.patch<PersonalEvent>(`${this.base}/events/${id}/`, data)
      : this.http.post<PersonalEvent>(`${this.base}/events/`, data);
  }
  saveTask(data: TaskInput, id?: number) {
    return id
      ? this.http.patch<PersonalTask>(`${this.base}/tasks/${id}/`, data)
      : this.http.post<PersonalTask>(`${this.base}/tasks/`, data);
  }
  remove(kind: 'event' | 'task', id: number) {
    return this.http.delete<void>(`${this.base}/${kind === 'event' ? 'events' : 'tasks'}/${id}/`);
  }

  // ---------- Notizen ----------
  notes() {
    return this.http.get<PersonalNote[]>(`${this.base}/notes/`);
  }
  saveNote(data: Pick<PersonalNote, 'title' | 'body' | 'pinned'>, id?: number) {
    return id
      ? this.http.patch<PersonalNote>(`${this.base}/notes/${id}/`, data)
      : this.http.post<PersonalNote>(`${this.base}/notes/`, data);
  }
  removeNote(id: number) {
    return this.http.delete<void>(`${this.base}/notes/${id}/`);
  }
}
