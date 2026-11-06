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
  /** Gemeinsamer Kalender (31.10.2026) — null/fehlend = privat (nur ich). */
  calendar?: number | null;
  calendar_name?: string;
  calendar_color?: CalendarColor | '';
  /** Bei gemeinsamen Terminen anderer: wer ihn eingetragen hat (Anzeigename). Leer = von mir. */
  created_by?: string;
  /** Darf ich ändern/löschen? (privat: immer; gemeinsam: Rolle „Kann bearbeiten“ oder Besitzer:in) */
  can_edit?: boolean;
  /** Kalenderfreigabe (31.10.2026): mit wem ich diesen eigenen Termin teile (Konto-IDs). Nur bei eigenen Terminen
   * gefüllt — Empfänger sehen nicht, wer ihn sonst noch sieht. Leer = niemand. */
  shared_with?: number[];
  /** Für mich freigegeben: wessen Kalender (Konto-ID). null = eigener Termin oder gemeinsamer Kalender. */
  shared_by?: number | null;
  /** Abgeleitet (Connection Engine V2): kein eigener Termin, sondern aus Vertrag/Gerät/Reise/Sparziel berechnet —
   * nur lesbar, Klick öffnet die Quelle. */
  derived?: { kind: string; source_type: string; source_id: number; domain: string };
}
export type EventInput = Omit<PersonalEvent, 'id' | 'series_starts_at' | 'calendar_name' | 'calendar_color' | 'created_by' | 'can_edit' | 'shared_by' | 'derived'>;

// ---------- Gemeinsame Kalender (31.10.2026, backend/organisation/calendars.py) ----------
export type CalendarColor = 'amber' | 'blue' | 'green' | 'rose' | 'violet' | 'slate';
export type CalendarRole = 'OWNER' | 'EDITOR' | 'VIEWER';
export interface SharedCalendarMember {
  user_id: number;
  name: string;
  role: CalendarRole;
  is_self: boolean;
}
export interface SharedCalendar {
  id: number;
  name: string;
  color: CalendarColor;
  /** Meine Rolle in diesem Kalender. */
  role: CalendarRole;
  is_owner: boolean;
  members: SharedCalendarMember[];
  /** Nur für Besitzer:in: offene Einladungen. */
  pending?: { invitation_id: number; name: string; role: CalendarRole }[];
}
// ---------- Kalenderfreigabe wie Outlook (31.10.2026, backend/organisation/calendar_views.py) ----------
export type ShareRole = Exclude<CalendarRole, 'OWNER'>;
export interface CalendarSharePerson {
  user_id: number;
  name: string;
  role: ShareRole;
}
export interface CalendarShares {
  /** Mein Konto als Bereich für Einladungen (scope_id von MY_CALENDAR). */
  owner_id: number;
  /** Für diese Personen ist mein Kalender freigegeben. */
  given: CalendarSharePerson[];
  /** Diese Personen haben ihren Kalender für mich freigegeben. */
  received: CalendarSharePerson[];
  pending: { invitation_id: number; name: string; role: ShareRole }[];
}
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
/** Anhang einer Notiz (Foto oder PDF, 31.10.2026). Inhalt nur über fileBlob() — nie als öffentlicher Link. */
export interface NoteAttachment {
  id: number;
  name: string;
  content_type: string;
  size: number;
}
export interface PersonalNote {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  attachments?: NoteAttachment[];
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

  // ---------- Gemeinsame Kalender ----------
  calendars() {
    return this.http.get<SharedCalendar[]>(`${this.base}/calendars/`);
  }
  createCalendar(name: string, color: CalendarColor) {
    return this.http.post<SharedCalendar>(`${this.base}/calendars/`, { name, color });
  }
  updateCalendar(id: number, data: Partial<Pick<SharedCalendar, 'name' | 'color'>>) {
    return this.http.patch<SharedCalendar>(`${this.base}/calendars/${id}/`, data);
  }
  deleteCalendar(id: number) {
    return this.http.delete<void>(`${this.base}/calendars/${id}/`);
  }
  /** Mitglied entfernen (Besitzer:in) oder selbst austreten (eigene user_id). */
  removeCalendarMember(id: number, userId: number) {
    return this.http.delete<void>(`${this.base}/calendars/${id}/members/${userId}/`);
  }
  changeCalendarRole(id: number, userId: number, role: Exclude<CalendarRole, 'OWNER'>) {
    return this.http.patch<SharedCalendar>(`${this.base}/calendars/${id}/members/${userId}/`, { role });
  }
  /** Einladen geht über die gemeinsame Einladungs-API — nur Personen aus den eigenen Kontakten. */
  inviteToCalendar(id: number, contactId: number, role: Exclude<CalendarRole, 'OWNER'>) {
    return this.http.post<unknown>(`${API_BASE_URL}/invitations/`, { contact_id: contactId, scope_type: 'CALENDAR', scope_id: id, role });
  }

  // ---------- Kalenderfreigabe ----------
  shares() {
    return this.http.get<CalendarShares>(`${this.base}/shares/`);
  }
  /** Freigeben = einladen; erst nach dem Annehmen sieht die Person Termine, die ich mit ihr teile. */
  shareMyCalendar(ownerId: number, contactId: number, role: ShareRole) {
    return this.http.post<unknown>(`${API_BASE_URL}/invitations/`, { contact_id: contactId, scope_type: 'MY_CALENDAR', scope_id: ownerId, role });
  }
  changeShareRole(userId: number, role: ShareRole) {
    return this.http.patch<CalendarShares>(`${this.base}/shares/given/${userId}/`, { role });
  }
  /** Freigabe für diese Person beenden — mit ihr geteilte Termine verschwinden sofort bei ihr. */
  endShare(userId: number) {
    return this.http.delete<void>(`${this.base}/shares/given/${userId}/`);
  }
  /** Den Kalender dieser Person nicht mehr sehen. */
  leaveShare(ownerId: number) {
    return this.http.delete<void>(`${this.base}/shares/received/${ownerId}/`);
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

  // ---------- Anhänge (Fotos/PDF an Notizen) ----------
  /** Hochladen an eine eigene Notiz. Der Server prüft den Typ am Inhalt und entfernt Standort-/Kameradaten aus Fotos. */
  uploadNoteFile(noteId: number, file: File) {
    const body = new FormData();
    body.append('file', file, file.name);
    body.append('note', String(noteId));
    return this.http.post<NoteAttachment>(`${this.base}/files/`, body);
  }
  /** Inhalt als Blob (mit Anmeldung) — für Vorschau/Öffnen per Objekt-URL. */
  fileBlob(id: number) {
    return this.http.get(`${this.base}/files/${id}/inhalt/`, { responseType: 'blob' });
  }
  removeFile(id: number) {
    return this.http.delete<void>(`${this.base}/files/${id}/`);
  }
}
