import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { PersonalEvent, PersonalTask, TodayData, TodayItem } from './organisation-api.service';

// Sicherheitskritisch wie demo-finanzen-data-provider.ts: diese Datei importiert KEINEN HttpClient. Sie ersetzt
// OrganisationApi nur für die öffentliche Demo-Route (siehe app.routes.ts) und hält ihren gesamten Zustand im
// Speicher dieser einen Instanz — ein Reload verwirft ihn, das ist im Demo-Modus korrekt.
//
// Termine und Aufgaben sind relativ zu HEUTE gesetzt (nicht an ein festes Kalenderdatum gebunden), damit „Heute“ an
// jedem Besuchstag etwas Plausibles zeigt: einen Termin heute, eine fällige und eine überfällige Aufgabe.

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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStr(): string {
  return dateOnly(0);
}

/** Feste Beispieldaten für die öffentliche Organisation-Demo (siehe app.routes.ts) — legt Termine und Aufgaben nur
 * in dieser einen In-Memory-Instanz an, genau wie DemoFinanzenDataProvider für Finanzen. */
@Injectable()
export class DemoOrganisationApi {
  private nextId = 100;
  private eventList: PersonalEvent[] = [
    { id: 1, title: 'Zahnarzttermin', starts_at: at(0, '09:00'), ends_at: at(0, '09:45'), location: 'Zahnarztpraxis Dr. Berg', description: '' },
    { id: 2, title: 'Elternabend', starts_at: at(3, '18:30'), ends_at: at(3, '20:00'), location: 'Grundschule, Aula', description: '' },
    { id: 3, title: 'Kino mit Freunden', starts_at: at(6, '20:00'), ends_at: null, location: 'Cinema am Markt', description: '' },
  ];
  private taskList: PersonalTask[] = [
    { id: 1, title: 'Wocheneinkauf', description: '', due_date: todayStr(), due_time: null, priority: 'MEDIUM', status: 'OPEN' },
    { id: 2, title: 'Müll rausbringen', description: '', due_date: todayStr(), due_time: '18:00', priority: 'LOW', status: 'OPEN' },
    { id: 3, title: 'Stromrechnung bezahlen', description: '', due_date: dateOnly(-2), due_time: null, priority: 'HIGH', status: 'OPEN' },
    { id: 4, title: 'Geburtstagsgeschenk besorgen', description: '', due_date: dateOnly(5), due_time: null, priority: 'MEDIUM', status: 'OPEN' },
    { id: 5, title: 'Auto zur Inspektion bringen', description: '', due_date: dateOnly(-10), due_time: null, priority: 'MEDIUM', status: 'DONE' },
  ];

  // Kopien statt der Live-Referenz: sonst hält Angular ein signal.set() derselben (nur in-place veränderten) Array-
  // Referenz fälschlich für unverändert (Object.is-Vergleich) und Berechnungen wie „weitere anzeigen“ bleiben
  // stehen, bis irgendetwas anderes die Signale erneut anstößt — genau wie ein echter HTTP-Aufruf, der ebenfalls
  // immer ein frisches Array liefert.
  events(): Observable<PersonalEvent[]> {
    return of([...this.eventList]);
  }
  tasks(): Observable<PersonalTask[]> {
    return of([...this.taskList]);
  }
  /** Wie das Backend (organisation/views.py today_data): Termine, die heute beginnen oder über Mitternacht bis
   * heute reichen, plus alle nicht erledigten Aufgaben, deren Fälligkeit heute oder früher liegt. */
  today(): Observable<TodayData> {
    const today = todayStr();
    const startOfToday = new Date(`${today}T00:00`);
    const endOfToday = new Date(`${today}T23:59:59.999`);
    const todaysEvents = this.eventList.filter((e) => {
      const starts = new Date(e.starts_at);
      const ends = e.ends_at ? new Date(e.ends_at) : null;
      return starts <= endOfToday && (starts >= startOfToday || (!!ends && ends > startOfToday));
    });
    const openTasks = this.taskList.filter((t) => t.status !== 'DONE');
    const dueTasks = openTasks.filter((t): t is PersonalTask & { due_date: string } => t.due_date !== null && t.due_date <= today);
    const items: TodayItem[] = [
      ...todaysEvents.map((e) => ({ kind: 'event' as const, id: e.id, title: e.title, at: e.starts_at, overdue: false, location: e.location })),
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
  saveEvent(data: Omit<PersonalEvent, 'id'>, id?: number): Observable<PersonalEvent> {
    if (id) {
      const index = this.eventList.findIndex((e) => e.id === id);
      if (index === -1) return throwError(() => ({ status: 404 }));
      this.eventList[index] = { ...this.eventList[index], ...data };
      return of(this.eventList[index]);
    }
    const created: PersonalEvent = { id: this.nextId++, ...data };
    this.eventList.push(created);
    return of(created);
  }
  saveTask(data: Partial<Omit<PersonalTask, 'id'>>, id?: number): Observable<PersonalTask> {
    if (id) {
      const index = this.taskList.findIndex((t) => t.id === id);
      if (index === -1) return throwError(() => ({ status: 404 }));
      this.taskList[index] = { ...this.taskList[index], ...data };
      return of(this.taskList[index]);
    }
    const created: PersonalTask = {
      id: this.nextId++,
      title: '',
      description: '',
      due_date: null,
      due_time: null,
      priority: 'MEDIUM',
      status: 'OPEN',
      ...data,
    };
    this.taskList.push(created);
    return of(created);
  }
  remove(kind: 'event' | 'task', id: number): Observable<void> {
    const list = kind === 'event' ? this.eventList : this.taskList;
    const index = list.findIndex((row) => row.id === id);
    if (index === -1) return throwError(() => ({ status: 404 }));
    list.splice(index, 1);
    return of(undefined);
  }
}
