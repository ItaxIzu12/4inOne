import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  FileCategory,
  FileStorage,
  PersonalEvent,
  PersonalFile,
  PersonalNote,
  PersonalTask,
  TodayData,
  TodayItem,
} from './organisation-api.service';

// Sicherheitskritisch wie demo-finanzen-data-provider.ts: diese Datei importiert KEINEN HttpClient. Sie ersetzt
// OrganisationApi nur für die öffentliche Demo-Route (siehe app.routes.ts) und hält ihren gesamten Zustand im
// Speicher dieser einen Instanz — ein Reload verwirft ihn, das ist im Demo-Modus korrekt.
//
// Alles ist relativ zu HEUTE gesetzt (nicht an ein festes Kalenderdatum gebunden), damit „Übersicht“ und Kalender an
// jedem Besuchstag etwas Plausibles zeigen.

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
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

type EventSeed = [number, string, number, string, string | null, string, PersonalEvent['category']];
const EVENTS: EventSeed[] = [
  [1, 'Zahnärztin', 0, '16:00', '16:45', 'Zahnarztpraxis Dr. Weber', 'gesundheit'],
  [2, 'Yoga', 0, '19:00', '20:00', 'Power Yoga Studio', 'sport'],
  [3, 'Kita bringen', 1, '07:30', '08:30', 'Kindergarten Sonnenschein', 'familie'],
  [4, 'Theater – Der kleine Prinz', 2, '18:00', '21:00', 'Stadttheater', 'freizeit'],
  [5, 'Fußballtraining', 3, '10:00', '12:00', 'Sportplatz Nord', 'sport'],
  [6, 'Brunch mit Lena', 4, '11:00', '13:00', 'Café Rosa', 'freizeit'],
  [7, 'Projekt-Review', 6, '09:30', '10:30', 'Büro, Raum 3.2', 'arbeit'],
  [8, 'Elternsprechtag', 8, '15:00', '16:00', 'Grundschule, Raum 12', 'familie'],
  [9, 'Gartenarbeit', 10, '13:00', '15:00', 'Schrebergarten', 'freizeit'],
  [10, 'Handballtraining', 13, '17:00', '18:30', 'Sporthalle Süd', 'sport'],
  [11, 'Friseur', 19, '09:00', '09:45', 'Salon Haarmonie', 'sonstiges'],
  [12, 'Joggen', -5, '08:00', '09:00', 'Stadtpark', 'sport'],
  [13, 'Elternabend', -4, '19:30', '21:00', 'Kita Sonnenschein', 'familie'],
  [14, 'Fußballspiel', -2, '10:00', '11:30', 'Sportplatz Nord', 'sport'],
  [15, 'Arzttermin', -1, '09:00', '09:30', 'Praxis Dr. Klein', 'gesundheit'],
  [16, 'Team-Meeting', 1, '10:00', '11:00', 'Online · Microsoft Teams', 'arbeit'],
];

type TaskSeed = [number, string, number | null, string | null, PersonalTask['priority'], string, PersonalTask['status']?];
const TASKS: TaskSeed[] = [
  [1, 'Angebot Küchenumbau prüfen', -6, null, 'HIGH', 'Hausumbau'],
  [2, 'Steuerunterlagen zusammenstellen', -3, null, 'HIGH', 'Finanzen'],
  [3, 'Kita-Anmeldung absenden', -1, null, 'MEDIUM', 'Familie'],
  [4, 'Kind zum Sport bringen', 0, '16:00', 'MEDIUM', 'Familie'],
  [5, 'Projekt-Status vorbereiten', 0, '17:00', 'HIGH', 'Beruf'],
  [6, 'Rechnung Strom prüfen', 0, '18:00', 'LOW', 'Finanzen'],
  [7, 'Abendessen planen', 0, '19:00', 'LOW', 'Familie'],
  [8, 'Gartenmöbel bestellen', 2, null, 'MEDIUM', 'Hausumbau'],
  [9, 'Urlaubsplanung finalisieren', 3, null, 'MEDIUM', 'Familie'],
  [10, 'Auto zur Inspektion', 4, null, 'LOW', 'Auto'],
  [11, 'Geschenk für Emma besorgen', 5, null, 'LOW', 'Familie'],
  [12, 'Monatsbudget vorbereiten', 5, null, 'MEDIUM', 'Finanzen'],
  [13, 'Wohnung aufräumen', -2, null, 'LOW', 'Familie', 'DONE'],
  [14, 'Handwerker anrufen', -1, null, 'MEDIUM', 'Hausumbau', 'DONE'],
  [15, 'Präsentation finalisieren', -1, null, 'HIGH', 'Beruf', 'DONE'],
];

const DEMO_QUOTA = 500 * 1024 * 1024;

/** Feste Beispieldaten für die öffentliche Organisation-Demo (siehe app.routes.ts) — Termine, Aufgaben, Notizen und
 * Dateien nur in dieser einen In-Memory-Instanz. Dateien haben keinen echten Inhalt; die Vorschau zeigt eine
 * neutrale Grafik. */
@Injectable()
export class DemoOrganisationApi {
  private nextId = 1000;
  private eventList: PersonalEvent[] = EVENTS.map(([id, title, day, from, to, location, category]) => ({
    id,
    title,
    starts_at: at(day, from),
    ends_at: to ? at(day, to) : null,
    location,
    description: id === 1 ? 'Kontrolle und professionelle Zahnreinigung' : id === 2 ? 'Yogamatte mitnehmen' : '',
    category,
  }));
  private taskList: PersonalTask[] = TASKS.map(([id, title, day, time, priority, project, status]) => ({
    id,
    title,
    description: '',
    due_date: day === null ? null : dateOnly(day),
    due_time: time,
    priority,
    status: status ?? 'OPEN',
    project,
    updated_at: hoursAgo(id),
  }));
  private noteList: PersonalNote[] = [
    { id: 1, title: 'Ideen für Q2', body: '• Community-Event im Sommer\n• Kooperation mit Urban Sports\n• Newsletter neu aufsetzen', pinned: true, created_at: hoursAgo(80), updated_at: hoursAgo(3) },
    { id: 2, title: 'Gesprächsnotizen – Projekt X', body: 'Wichtige Punkte aus dem Call:\n- Timeline ist realistisch\n- Nächste Schritte: Feedback von Anna einholen', pinned: false, created_at: hoursAgo(50), updated_at: hoursAgo(26) },
    { id: 3, title: 'Reiseplanung Italien', body: '• Flug nach Rom\n• Unterkunft in Trastevere\n• Liste mit Restaurant-Tipps', pinned: false, created_at: hoursAgo(200), updated_at: hoursAgo(120) },
    { id: 4, title: 'Einkauf Geburtstag Emma', body: 'Luftballons, Kuchen bestellen, Geschenk: Buch über Dinosaurier', pinned: false, created_at: hoursAgo(300), updated_at: hoursAgo(240) },
  ];
  private fileList: PersonalFile[] = [
    this.file(1, 'Reiseunterlagen_Sommer.pdf', 'application/pdf', 1_250_000, 'reise', true, 2),
    this.file(2, 'Unterkunft_Ansicht.jpg', 'image/jpeg', 3_400_000, 'bild', false, 26),
    this.file(3, 'Packliste_Sommer.txt', 'text/plain', 12_000, 'checkliste', true, 50),
    this.file(4, 'Buchungsbestätigung_Hotel.pdf', 'application/pdf', 284_000, 'buchung', false, 75),
    this.file(5, 'Ausgaben_Übersicht.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 118_000, 'persoenlich', false, 120),
    this.file(6, 'Reiseplan.pdf', 'application/pdf', 1_100_000, 'reise', false, 74),
    this.file(7, 'Personalausweis_Kopie.pdf', 'application/pdf', 640_000, 'persoenlich', true, 300),
    this.file(8, 'Flugtickets_Rom.pdf', 'application/pdf', 410_000, 'buchung', false, 160),
  ];

  private file(id: number, name: string, type: string, size: number, category: FileCategory, favorite: boolean, hours: number): PersonalFile {
    return { id, name, content_type: type, size, category, favorite, created_at: hoursAgo(hours + 48), updated_at: hoursAgo(hours), used_at: hoursAgo(hours) };
  }

  // Kopien statt der Live-Referenz: sonst hält Angular ein signal.set() derselben Array-Referenz fälschlich für
  // unverändert (Object.is-Vergleich).
  events(): Observable<PersonalEvent[]> {
    return of([...this.eventList].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
  }
  tasks(): Observable<PersonalTask[]> {
    return of([...this.taskList]);
  }
  notes(): Observable<PersonalNote[]> {
    return of([...this.noteList].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at)));
  }
  files(): Observable<PersonalFile[]> {
    return of([...this.fileList].sort((a, b) => b.used_at.localeCompare(a.used_at)));
  }
  fileStorage(): Observable<FileStorage> {
    return of({ used: this.fileList.reduce((sum, f) => sum + f.size, 0), quota: DEMO_QUOTA });
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
    const created: PersonalEvent = { id: this.nextId++, category: 'sonstiges', ...data };
    this.eventList.push(created);
    return of(created);
  }
  saveTask(data: Partial<Omit<PersonalTask, 'id'>>, id?: number): Observable<PersonalTask> {
    if (id) {
      const index = this.taskList.findIndex((t) => t.id === id);
      if (index === -1) return throwError(() => ({ status: 404 }));
      this.taskList[index] = { ...this.taskList[index], ...data, updated_at: new Date().toISOString() };
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
      project: '',
      ...data,
      updated_at: new Date().toISOString(),
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
  /** Demo: nimmt nur die Angaben der Datei auf, nicht ihren Inhalt — es wird nichts gespeichert oder gesendet. */
  uploadFile(file: File, category: FileCategory | null): Observable<PersonalFile> {
    if (file.size > 10 * 1024 * 1024) return throwError(() => ({ status: 400, error: { file: ['Die Datei ist größer als 10 MB.'] } }));
    const now = new Date().toISOString();
    const created: PersonalFile = {
      id: this.nextId++,
      name: file.name,
      content_type: file.type || 'application/octet-stream',
      size: file.size,
      category: category ?? (file.type.startsWith('image/') ? 'bild' : 'sonstiges'),
      favorite: false,
      created_at: now,
      updated_at: now,
      used_at: now,
    };
    this.fileList.push(created);
    return of(created);
  }
  updateFile(id: number, data: Partial<Pick<PersonalFile, 'name' | 'category' | 'favorite'>>): Observable<PersonalFile> {
    const index = this.fileList.findIndex((f) => f.id === id);
    if (index === -1) return throwError(() => ({ status: 404 }));
    this.fileList[index] = { ...this.fileList[index], ...data, updated_at: new Date().toISOString() };
    return of(this.fileList[index]);
  }
  removeFile(id: number): Observable<void> {
    const index = this.fileList.findIndex((f) => f.id === id);
    if (index === -1) return throwError(() => ({ status: 404 }));
    this.fileList.splice(index, 1);
    return of(undefined);
  }
  /** Demo-Inhalt: eine neutrale Grafik statt einer echten Datei. */
  fileContent(id: number): Observable<Blob> {
    const found = this.fileList.find((f) => f.id === id);
    if (!found) return throwError(() => ({ status: 404 }));
    found.used_at = new Date().toISOString();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c7d8f5"/><stop offset="1" stop-color="#eef3fb"/></linearGradient></defs><rect width="640" height="420" fill="url(#g)"/><path d="M0 330 L160 220 L280 300 L420 180 L640 320 L640 420 L0 420Z" fill="#7da37a"/><circle cx="520" cy="90" r="40" fill="#f6d27a"/></svg>`;
    return of(new Blob([svg], { type: 'image/svg+xml' }));
  }
}
