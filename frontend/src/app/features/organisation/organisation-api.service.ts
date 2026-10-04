import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../core/api.config';
/** Art eines Termins — backend organisation/models.py EventCategory. */
export type EventCategory = 'gesundheit' | 'sport' | 'familie' | 'arbeit' | 'freizeit' | 'sonstiges';
export interface PersonalEvent {
  id: number;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
  description: string;
  category?: EventCategory;
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
  updated_at?: string;
}
export interface PersonalNote {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}
/** Kategorie einer Datei — backend organisation/models.py FileCategory. */
export type FileCategory = 'reise' | 'buchung' | 'persoenlich' | 'checkliste' | 'bild' | 'sonstiges';
export interface PersonalFile {
  id: number;
  name: string;
  content_type: string;
  size: number;
  category: FileCategory;
  favorite: boolean;
  created_at: string;
  updated_at: string;
  used_at: string;
}
export interface FileStorage {
  used: number;
  quota: number;
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

  // ---------- Dateien ----------
  files() {
    return this.http.get<PersonalFile[]>(`${this.base}/files/`);
  }
  fileStorage() {
    return this.http.get<FileStorage>(`${this.base}/files/speicher/`);
  }
  uploadFile(file: File, category: FileCategory | null) {
    const body = new FormData();
    body.append('file', file, file.name);
    if (category) body.append('category', category);
    return this.http.post<PersonalFile>(`${this.base}/files/`, body);
  }
  updateFile(id: number, data: Partial<Pick<PersonalFile, 'name' | 'category' | 'favorite'>>) {
    return this.http.patch<PersonalFile>(`${this.base}/files/${id}/`, data);
  }
  removeFile(id: number) {
    return this.http.delete<void>(`${this.base}/files/${id}/`);
  }
  /** Inhalt als Blob (mit Anmeldung) — für Vorschau und Download, nie über eine öffentliche URL. */
  fileContent(id: number, download = false) {
    return this.http.get(`${this.base}/files/${id}/inhalt/`, {
      responseType: 'blob',
      params: download ? { download: '1' } : {},
    });
  }
}
