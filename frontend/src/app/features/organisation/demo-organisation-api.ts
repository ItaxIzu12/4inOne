import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  DayRange,
  EventImportResult,
  EventInput,
  OrganisationSummary,
  PersonalEvent,
  PersonalNote,
  PersonalTask,
  Repeat,
  TaskInput,
  TodayData,
  TodayItem,
} from './organisation-api.service';
import { expandEvents, localDay } from './organisation-logic';
import { EventImportRow } from './org-import';

// Sicherheitskritisch wie demo-finanzen-data-provider.ts: diese Datei importiert KEINEN HttpClient. Sie ersetzt
// OrganisationApi nur für die öffentliche Demo-Route (siehe app.routes.ts) und hält ihren gesamten Zustand im
// Speicher dieser einen Instanz — ein Reload verwirft ihn, das ist im Demo-Modus korrekt. Demo-Daten gelangen nie
// in ein echtes Konto.
//
// Alles ist relativ zu HEUTE gesetzt, damit der Kalender an jedem Besuchstag etwas Plausibles zeigt.

function at(daysOffset: number, hhmm: string): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
function dateOnly(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return localDay(d);
}
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}
/** Montag dieser Woche (für das wöchentliche Teammeeting). */
function mondayOffset(): number {
  return -((new Date().getDay() + 6) % 7);
}

const STEP: Record<Repeat, [number, number]> = { daily: [1, 0], weekly: [7, 0], monthly: [0, 1], yearly: [0, 12] };

/** Feste Beispieldaten für die öffentliche Organisation-Demo (siehe app.routes.ts) — Termine, Aufgaben und Notizen nur
 * in dieser einen In-Memory-Instanz. */
@Injectable()
export class DemoOrganisationApi {
  private nextId = 1000;
  private eventList: PersonalEvent[] = [
    this.seedEvent(1, 'Teammeeting', at(mondayOffset(), '09:30'), at(mondayOffset(), '10:30'), 'Büro, Raum 3.2', 'arbeit', 'weekly'),
    this.seedEvent(2, 'Zahnarzt', at(0, '16:00'), at(0, '16:45'), 'Praxis Dr. Weber', 'gesundheit'),
    this.seedEvent(3, 'Badminton', at(0, '19:00'), at(0, '20:30'), 'Sporthalle Nord', 'sport'),
    this.seedEvent(4, 'Mittagessen mit Lena', at(1, '12:30'), at(1, '13:30'), 'Café Rosa', 'freizeit'),
    this.seedEvent(5, 'Behördentermin', at(3, '10:00'), at(3, '10:30'), 'Bürgeramt', 'sonstiges'),
    this.seedEvent(6, 'Geburtstag Emma', at(5, '00:00'), null, '', 'familie', 'yearly', true),
    this.seedEvent(7, 'Arzttermin', at(-6, '09:00'), at(-6, '09:30'), 'Praxis Dr. Klein', 'gesundheit'),
  ];
  private taskList: PersonalTask[] = [
    this.task(1, 'Präsentation vorbereiten', 0, 'HIGH', 'Beruf'),
    this.task(2, 'Steuerunterlagen sortieren', -2, 'MEDIUM', 'Finanzen'),
    this.task(3, 'Geschenk kaufen', 5, 'MEDIUM', 'Familie'),
    this.task(4, 'Arzttermin vereinbaren', 2, 'LOW', ''),
    { ...this.task(5, 'Wochenplanung', 0, 'MEDIUM', ''), recurrence_days: 7, repeat: 'weekly' },
    this.task(6, 'Bewerbung abschicken', null, 'HIGH', 'Beruf'),
    { ...this.task(7, 'Handwerker anrufen', -1, 'MEDIUM', ''), status: 'DONE' },
  ];
  private noteList: PersonalNote[] = [
    { id: 1, title: 'Reiseideen', body: '• Herbst: Wien oder Prag\n• Unterkunft mit Küche\n• Zugverbindungen vergleichen', pinned: true, created_at: hoursAgo(80), updated_at: hoursAgo(3) },
    { id: 2, title: 'Fragen für Arzttermin', body: 'Blutwerte besprechen\nImpfung auffrischen?\nRezept verlängern', pinned: false, created_at: hoursAgo(50), updated_at: hoursAgo(26) },
    { id: 3, title: '', body: 'Telefonnummer Hausverwaltung: 030 123456', pinned: false, created_at: hoursAgo(200), updated_at: hoursAgo(120) },
  ];

  private seedEvent(
    id: number, title: string, starts: string, ends: string | null, location: string,
    category: PersonalEvent['category'], recurrence: Repeat | '' = '', allDay = false,
  ): PersonalEvent {
    return { id, title, starts_at: starts, ends_at: ends, all_day: allDay, recurrence, location, description: '', category };
  }
  private task(id: number, title: string, day: number | null, priority: PersonalTask['priority'], project: string): PersonalTask {
    return {
      id, title, description: '', due_date: day === null ? null : dateOnly(day), due_time: null, priority, status: 'OPEN',
      project, repeat: null, recurrence_days: null, recurrence_months: null, last_done_at: null, updated_at: hoursAgo(id),
    };
  }

  // Kopien statt der Live-Referenz: sonst hält Angular ein signal.set() derselben Array-Referenz fälschlich für
  // unverändert (Object.is-Vergleich).
  events(range: DayRange): Observable<PersonalEvent[]> {
    return of(expandEvents(this.eventList, range.start, range.end));
  }
  event(id: number): Observable<PersonalEvent> {
    const found = this.eventList.find((e) => e.id === id);
    return found ? of({ ...found }) : throwError(() => ({ status: 404 }));
  }
  tasks(): Observable<PersonalTask[]> {
    return of([...this.taskList]);
  }
  notes(): Observable<PersonalNote[]> {
    return of([...this.noteList].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at)));
  }
  summary(): Observable<OrganisationSummary> {
    const today = dateOnly(0);
    const open = this.taskList.filter((t) => t.status !== 'DONE');
    return of({
      date: today,
      events_today: expandEvents(this.eventList, today, today).length,
      tasks_today: open.filter((t) => t.due_date === today).length,
      overdue_tasks: open.filter((t) => !!t.due_date && t.due_date < today).length,
    });
  }
  /** Wie das Backend (organisation/views.py today_data). */
  today(): Observable<TodayData> {
    const today = dateOnly(0);
    const todaysEvents = expandEvents(this.eventList, today, today);
    const openTasks = this.taskList.filter((t) => t.status !== 'DONE');
    const dueTasks = openTasks.filter((t): t is PersonalTask & { due_date: string } => t.due_date !== null && t.due_date <= today);
    const items: TodayItem[] = [
      ...todaysEvents.map((e) => ({ kind: 'event' as const, id: e.id, title: e.title, at: e.starts_at, overdue: false, location: e.location, all_day: e.all_day })),
      ...dueTasks.map((t) => ({
        kind: 'task' as const,
        id: t.id,
        title: t.title,
        at: t.due_time ? `${t.due_date}T${t.due_time}:00` : `${t.due_date}T00:00:00`,
        overdue: t.due_date < today,
        all_day: !t.due_time,
        status: t.status,
      })),
    ];
    items.sort((a, b) => a.at.localeCompare(b.at) || a.kind.localeCompare(b.kind) || a.id - b.id);
    return of({
      date: today,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin',
      items,
      event_count: todaysEvents.length,
      open_task_count: openTasks.length,
      overdue_count: dueTasks.filter((t) => t.due_date < today).length,
    });
  }
  saveEvent(data: EventInput, id?: number): Observable<PersonalEvent> {
    if (data.ends_at && data.ends_at < data.starts_at) {
      return throwError(() => ({ status: 400, error: { ends_at: ['Das Ende liegt vor dem Beginn.'] } }));
    }
    if (id) {
      const index = this.eventList.findIndex((e) => e.id === id);
      if (index === -1) return throwError(() => ({ status: 404 }));
      this.eventList[index] = { ...this.eventList[index], ...data };
      return of(this.eventList[index]);
    }
    const created: PersonalEvent = { id: this.nextId++, category: 'sonstiges', ...data };
    this.eventList.push(created);
    return of(created);
  }
  /** Wie backend organisation/views.py import_events: Dubletten (Titel + Beginn) überspringen, sonst anlegen. */
  importEvents(rows: EventImportRow[], dryRun: boolean): Observable<EventImportResult> {
    const seen = new Set<string>();
    const result: EventImportResult = { new: 0, duplicates: 0, invalid: 0, created: 0, rows: [] };
    const fresh: EventImportRow[] = [];
    rows.forEach((row, i) => {
      const at = new Date(row.starts_at).getTime();
      if (!row.title.trim() || Number.isNaN(at) || (row.ends_at && new Date(row.ends_at).getTime() < at)) {
        result.invalid++;
        result.rows.push({ row: i + 1, status: 'invalid', message: !row.title.trim() ? 'Titel: Bitte einen Titel eingeben.' : 'Ende: Das Ende liegt vor dem Beginn.' });
        return;
      }
      const key = `${row.title.trim().toLocaleLowerCase('de')}|${at}`;
      const exists = this.eventList.some((e) => `${e.title.trim().toLocaleLowerCase('de')}|${new Date(e.starts_at).getTime()}` === key);
      if (seen.has(key) || exists) {
        result.duplicates++;
        result.rows.push({ row: i + 1, status: 'duplicate', message: 'Schon im Kalender' });
        return;
      }
      seen.add(key);
      result.new++;
      result.rows.push({ row: i + 1, status: 'new', message: '' });
      fresh.push(row);
    });
    if (dryRun || !fresh.length) return of(result);
    for (const row of fresh) this.eventList.push({ id: this.nextId++, category: 'sonstiges', ...row, title: row.title.trim() });
    return of({ ...result, created: fresh.length });
  }
  /** Wie backend organisation/views.py TaskViewSet: Erledigen einer wiederkehrenden Aufgabe rückt sie weiter. */
  saveTask(input: TaskInput, id?: number): Observable<PersonalTask> {
    const { recurrence, ...data } = input;
    const interval =
      recurrence === undefined
        ? {}
        : { recurrence_days: recurrence ? STEP[recurrence][0] || null : null, recurrence_months: recurrence ? STEP[recurrence][1] || null : null, repeat: recurrence ?? null };
    if (id) {
      const index = this.taskList.findIndex((t) => t.id === id);
      if (index === -1) return throwError(() => ({ status: 404 }));
      const current = this.taskList[index];
      const next: PersonalTask = { ...current, ...data, ...interval, updated_at: new Date().toISOString() };
      if (data.status === 'DONE' && current.status !== 'DONE' && (next.recurrence_days || next.recurrence_months)) {
        next.status = 'OPEN';
        next.last_done_at = new Date().toISOString();
        next.due_date = this.nextDue(next);
      }
      this.taskList[index] = next;
      return of(next);
    }
    const created: PersonalTask = {
      id: this.nextId++,
      title: '',
      description: '',
      due_date: null,
      due_time: null,
      priority: 'MEDIUM',
      status: 'OPEN',
      project: '',
      repeat: null,
      recurrence_days: null,
      recurrence_months: null,
      last_done_at: null,
      ...data,
      ...interval,
      updated_at: new Date().toISOString(),
    };
    this.taskList.push(created);
    return of(created);
  }
  private nextDue(task: PersonalTask): string {
    const today = dateOnly(0);
    const base = new Date(`${task.due_date ?? today}T12:00`);
    for (let step = 1; ; step++) {
      const d = new Date(base);
      if (task.recurrence_days) d.setDate(base.getDate() + task.recurrence_days * step);
      else {
        d.setDate(1);
        d.setMonth(base.getMonth() + (task.recurrence_months ?? 1) * step);
        d.setDate(Math.min(base.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      }
      if (localDay(d) > today) return localDay(d);
    }
  }
  remove(kind: 'event' | 'task', id: number): Observable<void> {
    const list = kind === 'event' ? this.eventList : this.taskList;
    const index = list.findIndex((row) => row.id === id);
    if (index === -1) return throwError(() => ({ status: 404 }));
    list.splice(index, 1);
    return of(undefined);
  }
  saveNote(data: Pick<PersonalNote, 'title' | 'body' | 'pinned'>, id?: number): Observable<PersonalNote> {
    const now = new Date().toISOString();
    if (id) {
      const index = this.noteList.findIndex((n) => n.id === id);
      if (index === -1) return throwError(() => ({ status: 404 }));
      this.noteList[index] = { ...this.noteList[index], ...data, updated_at: now };
      return of(this.noteList[index]);
    }
    const created: PersonalNote = { id: this.nextId++, ...data, created_at: now, updated_at: now };
    this.noteList.push(created);
    return of(created);
  }
  removeNote(id: number): Observable<void> {
    const index = this.noteList.findIndex((n) => n.id === id);
    if (index === -1) return throwError(() => ({ status: 404 }));
    this.noteList.splice(index, 1);
    return of(undefined);
  }
}
