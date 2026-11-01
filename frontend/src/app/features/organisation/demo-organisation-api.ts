import { BERLIN } from '../reisen/demo-reisen-api';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  CalendarColor,
  CalendarRole,
  DayRange,
  EventImportResult,
  EventInput,
  OrganisationSummary,
  PersonalEvent,
  PersonalNote,
  PersonalTask,
  Repeat,
  SharedCalendar,
  NoteAttachment,
  CalendarShares,
  ShareRole,
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
const MAX = 301;
const LENA = 302;
const FAMILY_EVENT = { calendar: 1, calendar_name: 'Familie', calendar_color: 'green' as CalendarColor, created_by: '', can_edit: true };

@Injectable()
export class DemoOrganisationApi {
  private nextId = 1000;
  private eventList: PersonalEvent[] = [
    this.seedEvent(1, 'Teammeeting', at(mondayOffset(), '09:30'), at(mondayOffset(), '10:30'), 'Büro, Raum 3.2', 'arbeit', 'weekly'),
    this.seedEvent(2, 'Zahnarzt', at(0, '16:00'), at(0, '16:45'), 'Praxis Dr. Weber', 'gesundheit'),
    // Mit Max geteilt (Kalenderfreigabe, 31.10.2026) — alle anderen eigenen Termine sind privat
    { ...this.seedEvent(3, 'Badminton', at(0, '19:00'), at(0, '20:30'), 'Sporthalle Nord', 'sport'), shared_with: [MAX] },
    this.seedEvent(4, 'Mittagessen mit Lena', at(1, '12:30'), at(1, '13:30'), 'Café Rosa', 'freizeit'),
    this.seedEvent(5, 'Behördentermin', at(3, '10:00'), at(3, '10:30'), 'Bürgeramt', 'sonstiges'),
    this.seedEvent(6, 'Geburtstag Emma', at(5, '00:00'), null, '', 'familie', 'yearly', true),
    this.seedEvent(7, 'Arzttermin', at(-6, '09:00'), at(-6, '09:30'), 'Praxis Dr. Klein', 'gesundheit'),
    // Am zweiten Tag der Berlin-Reise — in der Demo mit ihr verknüpft (shared/connections/demo-connections-api.ts)
    this.seedEvent(8, 'Museumsinsel-Führung', at(BERLIN + 1, '11:00'), at(BERLIN + 1, '12:30'), 'Berlin, Bodestraße', 'freizeit'),
    // Gemeinsamer Kalender „Familie“ (31.10.2026): einer von Max, einer von Sophie
    { ...this.seedEvent(9, 'Abendessen bei Oma', at(2, '18:30'), at(2, '21:00'), 'Lindenstraße 4', 'familie'), ...FAMILY_EVENT, created_by: 'Max' },
    { ...this.seedEvent(10, 'Elternabend', at(6, '19:00'), at(6, '20:30'), 'Grundschule', 'familie'), ...FAMILY_EVENT },
    // Lena hat ihren Kalender für Sophie freigegeben und diesen Termin mit ihr geteilt (nur ansehen)
    { ...this.seedEvent(11, 'Lenas Umzug', at(4, '10:00'), at(4, '16:00'), 'Gartenstraße 12', 'freizeit'), created_by: 'Lena', can_edit: false, shared_by: LENA },
  ];
  private taskList: PersonalTask[] = [
    this.task(1, 'Präsentation vorbereiten', 0, 'HIGH', 'Beruf'),
    this.task(2, 'Steuerunterlagen sortieren', -2, 'MEDIUM', 'Finanzen'),
    this.task(3, 'Geschenk kaufen', 5, 'MEDIUM', 'Familie'),
    this.task(4, 'Arzttermin vereinbaren', 2, 'LOW', ''),
    { ...this.task(5, 'Wochenplanung', 0, 'MEDIUM', ''), recurrence_days: 7, repeat: 'weekly' },
    this.task(8, 'Badmintonschuhe vergleichen', 3, 'MEDIUM', 'Freizeit'),
    this.task(6, 'Bewerbung abschicken', null, 'HIGH', 'Beruf'),
    // Kurz vor der Berlin-Reise fällig — in der Demo als Verknüpfungs-Vorschlag
    this.task(9, 'Bahn-Tickets ausdrucken', BERLIN - 2, 'MEDIUM', ''),
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
    const calendar = data.calendar ? this.calendarList.find((c) => c.id === data.calendar) : undefined;
    if (data.calendar && (!calendar || calendar.role === 'VIEWER')) return throwError(() => ({ status: 403 }));
    const shared = calendar
      ? { calendar: calendar.id, calendar_name: calendar.name, calendar_color: calendar.color }
      : { calendar: null, calendar_name: '', calendar_color: '' as const };
    // Wie organisation/calendars.py set_audience: nur Personen mit Freigabe
    const allowed = new Set(this.shareState.given.map((g) => g.user_id));
    if (data.shared_with?.some((u) => !allowed.has(u))) {
      return throwError(() => ({ status: 400, error: { shared_with: ['Mit dieser Person ist dein Kalender nicht geteilt.'] } }));
    }
    if (id) {
      const index = this.eventList.findIndex((e) => e.id === id);
      if (index === -1) return throwError(() => ({ status: 404 }));
      if (this.eventList[index].can_edit === false) return throwError(() => ({ status: 403 }));
      if (this.eventList[index].created_by && data.shared_with) return throwError(() => ({ status: 403 }));
      this.eventList[index] = { ...this.eventList[index], ...data, ...shared };
      return of(this.eventList[index]);
    }
    const created: PersonalEvent = { id: this.nextId++, category: 'sonstiges', shared_with: [], ...data, ...shared, created_by: '', can_edit: true, shared_by: null };
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
    for (const file of this.noteList[index].attachments ?? []) this.blobs.delete(file.id);
    this.noteList.splice(index, 1);
    return of(undefined);
  }

  // ---------- Gemeinsame Kalender (Demo, nur im Speicher) ----------
  private calendarList: SharedCalendar[] = [
    {
      id: 1, name: 'Familie', color: 'green', role: 'OWNER', is_owner: true,
      members: [
        { user_id: 1, name: 'Sophie', role: 'OWNER', is_self: true },
        { user_id: 301, name: 'Max', role: 'EDITOR', is_self: false },
      ],
      pending: [],
    },
  ];
  private copyCalendars(): SharedCalendar[] {
    return this.calendarList.map((c) => ({ ...c, members: c.members.map((m) => ({ ...m })), pending: [...(c.pending ?? [])] }));
  }
  calendars(): Observable<SharedCalendar[]> {
    return of(this.copyCalendars());
  }
  createCalendar(name: string, color: CalendarColor): Observable<SharedCalendar> {
    const created: SharedCalendar = { id: this.nextId++, name, color, role: 'OWNER', is_owner: true, members: [{ user_id: 1, name: 'Sophie', role: 'OWNER', is_self: true }], pending: [] };
    this.calendarList.push(created);
    return of({ ...created });
  }
  updateCalendar(id: number, data: Partial<Pick<SharedCalendar, 'name' | 'color'>>): Observable<SharedCalendar> {
    const calendar = this.calendarList.find((c) => c.id === id);
    if (!calendar) return throwError(() => ({ status: 404 }));
    Object.assign(calendar, data);
    this.eventList = this.eventList.map((e) => (e.calendar === id ? { ...e, calendar_name: calendar.name, calendar_color: calendar.color } : e));
    return of({ ...calendar });
  }
  /** Wie im Backend: Termine werden wieder privat (in der Demo: Sophies eigene bleiben, fremde verschwinden). */
  deleteCalendar(id: number): Observable<void> {
    this.calendarList = this.calendarList.filter((c) => c.id !== id);
    this.eventList = this.eventList
      .filter((e) => e.calendar !== id || !e.created_by)
      .map((e) => (e.calendar === id ? { ...e, calendar: null, calendar_name: '', calendar_color: '' as const } : e));
    return of(undefined);
  }
  removeCalendarMember(id: number, userId: number): Observable<void> {
    const calendar = this.calendarList.find((c) => c.id === id);
    if (calendar) calendar.members = calendar.members.filter((m) => m.user_id !== userId || m.role === 'OWNER');
    return of(undefined);
  }
  changeCalendarRole(id: number, userId: number, role: Exclude<CalendarRole, 'OWNER'>): Observable<SharedCalendar> {
    const calendar = this.calendarList.find((c) => c.id === id)!;
    calendar.members = calendar.members.map((m) => (m.user_id === userId ? { ...m, role } : m));
    return of({ ...calendar });
  }
  /** Demo: die Einladung erscheint als „offen“ — angenommen wird in der Demo nicht. */
  inviteToCalendar(id: number, contactId: number, role: Exclude<CalendarRole, 'OWNER'>): Observable<unknown> {
    const calendar = this.calendarList.find((c) => c.id === id);
    if (!calendar) return throwError(() => ({ status: 404 }));
    const name = contactId === 1 ? 'Max' : contactId === 2 ? 'Lena' : 'Person';
    if (calendar.members.some((m) => m.name === name) || calendar.pending?.some((p) => p.name === name)) return of(null);
    calendar.pending = [...(calendar.pending ?? []), { invitation_id: this.nextId++, name, role }];
    return of(null);
  }

  // ---------- Kalenderfreigabe (Demo, nur im Speicher) ----------
  private shareState: CalendarShares = {
    owner_id: 1,
    given: [{ user_id: MAX, name: 'Max', role: 'VIEWER' }],
    received: [{ user_id: LENA, name: 'Lena', role: 'VIEWER' }],
    pending: [],
  };
  private copyShares(): CalendarShares {
    const s = this.shareState;
    return { owner_id: s.owner_id, given: s.given.map((g) => ({ ...g })), received: s.received.map((r) => ({ ...r })), pending: [...s.pending] };
  }
  shares(): Observable<CalendarShares> {
    return of(this.copyShares());
  }
  /** Demo: die Einladung erscheint als „offen“ — angenommen wird in der Demo nicht. */
  shareMyCalendar(_ownerId: number, contactId: number, role: ShareRole): Observable<unknown> {
    const name = contactId === 1 ? 'Max' : contactId === 2 ? 'Lena' : 'Person';
    if (this.shareState.given.some((g) => g.name === name) || this.shareState.pending.some((p) => p.name === name)) return of(null);
    this.shareState.pending = [...this.shareState.pending, { invitation_id: this.nextId++, name, role }];
    return of(null);
  }
  changeShareRole(userId: number, role: ShareRole): Observable<CalendarShares> {
    if (!this.shareState.given.some((g) => g.user_id === userId)) return throwError(() => ({ status: 404 }));
    this.shareState.given = this.shareState.given.map((g) => (g.user_id === userId ? { ...g, role } : g));
    return of(this.copyShares());
  }
  endShare(userId: number): Observable<void> {
    this.shareState.given = this.shareState.given.filter((g) => g.user_id !== userId);
    this.eventList = this.eventList.map((e) => (e.shared_with?.includes(userId) ? { ...e, shared_with: e.shared_with.filter((u) => u !== userId) } : e));
    return of(undefined);
  }
  leaveShare(ownerId: number): Observable<void> {
    this.shareState.received = this.shareState.received.filter((r) => r.user_id !== ownerId);
    this.eventList = this.eventList.filter((e) => e.shared_by !== ownerId);
    return of(undefined);
  }

  // ---------- Abgleich mit „Personen & Gruppen“ (Demo) ----------
  /** Kalender-Bereiche einer Person, so wie contacts/ sie im Backend liefert (core/contact_views._shared_by_person). */
  demoLinksFor(user: number, name: string): {
    shared: { kind: 'CALENDAR' | 'MY_CALENDAR'; id: number; title: string }[];
    canAdd: { kind: 'CALENDAR' | 'MY_CALENDAR'; id: number; title: string }[];
    invited: { kind: 'CALENDAR' | 'MY_CALENDAR'; id: number; title: string; invitation_id: number }[];
  } {
    const shared: ReturnType<DemoOrganisationApi['demoLinksFor']>['shared'] = [];
    const canAdd: ReturnType<DemoOrganisationApi['demoLinksFor']>['canAdd'] = [];
    const invited: ReturnType<DemoOrganisationApi['demoLinksFor']>['invited'] = [];
    for (const c of this.calendarList) {
      const area = { kind: 'CALENDAR' as const, id: c.id, title: c.name };
      const invite = c.pending?.find((p) => p.name === name);
      if (c.members.some((m) => m.user_id === user)) shared.push(area);
      else if (invite) invited.push({ ...area, invitation_id: invite.invitation_id });
      else if (c.is_owner) canAdd.push(area);
    }
    const mine = { kind: 'MY_CALENDAR' as const, id: this.shareState.owner_id, title: 'Dein Kalender' };
    const myInvite = this.shareState.pending.find((p) => p.name === name);
    if (this.shareState.given.some((g) => g.user_id === user)) shared.push(mine);
    else if (myInvite) invited.push({ ...mine, invitation_id: myInvite.invitation_id });
    else canAdd.push(mine);
    if (this.shareState.received.some((r) => r.user_id === user)) shared.push({ kind: 'MY_CALENDAR', id: user, title: `Kalender von ${name}` });
    return { shared, canAdd, invited };
  }
  /** Einladen aus „Personen & Gruppen“ (contactId wie dort: Max 1, Lena 2). */
  demoInviteArea(kind: 'CALENDAR' | 'MY_CALENDAR', areaId: number, contactId: number): void {
    const request = kind === 'CALENDAR' ? this.inviteToCalendar(areaId, contactId, 'VIEWER') : this.shareMyCalendar(areaId, contactId, 'VIEWER');
    request.subscribe({ error: () => undefined });
  }
  /** Für „Personen & Gruppen“: true, wenn die Einladung hier lag und angenommen wurde. */
  demoAcceptNow(invitationId: number): boolean {
    let ok = false;
    this.demoAccept(invitationId).subscribe({ next: () => (ok = true), error: () => undefined });
    return ok;
  }

  /** Nur Demo: eine offene Einladung so behandeln, als hätte die Person angenommen (es gibt hier niemanden, der es tut). */
  demoAccept(invitationId: number): Observable<void> {
    const ids: Record<string, number> = { Max: MAX, Lena: LENA };
    for (const calendar of this.calendarList) {
      const invite = calendar.pending?.find((p) => p.invitation_id === invitationId);
      if (invite) {
        calendar.pending = calendar.pending!.filter((p) => p !== invite);
        calendar.members = [...calendar.members, { user_id: ids[invite.name] ?? this.nextId++, name: invite.name, role: invite.role, is_self: false }];
        return of(undefined);
      }
    }
    const share = this.shareState.pending.find((p) => p.invitation_id === invitationId);
    if (!share) return throwError(() => ({ status: 404 }));
    this.shareState.pending = this.shareState.pending.filter((p) => p !== share);
    this.shareState.given = [...this.shareState.given, { user_id: ids[share.name] ?? this.nextId++, name: share.name, role: share.role }];
    return of(undefined);
  }

  // ---------- Anhänge (Demo: Dateien bleiben nur in diesem Browser-Tab) ----------
  private blobs = new Map<number, Blob>();
  uploadNoteFile(noteId: number, file: File): Observable<NoteAttachment> {
    const note = this.noteList.find((n) => n.id === noteId);
    if (!note) return throwError(() => ({ status: 404 }));
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      return throwError(() => ({ status: 400, error: { file: ['An Notizen lassen sich Fotos (JPG, PNG, WebP) und PDF anhängen.'] } }));
    }
    if (file.size > 10 * 1024 * 1024) return throwError(() => ({ status: 400, error: { file: ['Die Datei ist größer als 10 MB.'] } }));
    if ((note.attachments?.length ?? 0) >= 10) return throwError(() => ({ status: 400, error: { file: ['An eine Notiz passen höchstens 10 Dateien.'] } }));
    const attachment: NoteAttachment = { id: this.nextId++, name: file.name, content_type: file.type, size: file.size };
    this.blobs.set(attachment.id, file);
    this.noteList = this.noteList.map((n) => (n.id === noteId ? { ...n, attachments: [...(n.attachments ?? []), attachment] } : n));
    return of(attachment);
  }
  fileBlob(id: number): Observable<Blob> {
    const blob = this.blobs.get(id);
    return blob ? of(blob) : throwError(() => ({ status: 404 }));
  }
  removeFile(id: number): Observable<void> {
    this.blobs.delete(id);
    this.noteList = this.noteList.map((n) => (n.attachments?.some((a) => a.id === id) ? { ...n, attachments: n.attachments.filter((a) => a.id !== id) } : n));
    return of(undefined);
  }
}
