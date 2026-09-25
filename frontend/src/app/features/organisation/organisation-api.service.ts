import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../core/api.config';
export interface PersonalEvent {
  id: number;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
  description: string;
}
export interface PersonalTask {
  id: number;
  title: string;
  description: string;
  due_date: string | null;
  due_time: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
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
export const organisationTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
@Injectable({ providedIn: 'root' })
export class OrganisationApi {
  private http = inject(HttpClient);
  private base = `${API_BASE_URL}/organisation`;
  events() {
    return this.http.get<PersonalEvent[]>(`${this.base}/events/`);
  }
  tasks() {
    return this.http.get<PersonalTask[]>(`${this.base}/tasks/`);
  }
  today() {
    return this.http.get<TodayData>(`${this.base}/today/`, {
      params: { timezone: organisationTimezone() },
    });
  }
  saveEvent(data: Omit<PersonalEvent, 'id'>, id?: number) {
    return id
      ? this.http.patch<PersonalEvent>(`${this.base}/events/${id}/`, data)
      : this.http.post<PersonalEvent>(`${this.base}/events/`, data);
  }
  saveTask(data: Partial<Omit<PersonalTask, 'id'>>, id?: number) {
    return id
      ? this.http.patch<PersonalTask>(`${this.base}/tasks/${id}/`, data)
      : this.http.post<PersonalTask>(`${this.base}/tasks/`, data);
  }
  remove(kind: 'event' | 'task', id: number) {
    return this.http.delete<void>(`${this.base}/${kind === 'event' ? 'events' : 'tasks'}/${id}/`);
  }
}
