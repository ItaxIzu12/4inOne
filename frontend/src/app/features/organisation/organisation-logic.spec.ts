import { PersonalEvent, PersonalNote, PersonalTask } from './organisation-api.service';
import {
  dayWord,
  eventsOn,
  expandEvents,
  filterTasks,
  gridRange,
  monthGrid,
  noteEdited,
  noteTitle,
  startTime,
  taskDue,
  timeRange,
  weekOf,
} from './organisation-logic';

const now = new Date(2026, 9, 4, 12, 0); // Sonntag, 4. Oktober 2026, 12:00
const iso = (day: number, hh: number, mm = 0, month = 9) => new Date(2026, month, day, hh, mm).toISOString();
const ev = (id: number, day: number, from: number, to: number | null, over: Partial<PersonalEvent> = {}): PersonalEvent => ({
  id, title: `E${id}`, starts_at: iso(day, from), ends_at: to === null ? null : iso(day, to), all_day: false, recurrence: '',
  location: '', description: '', ...over,
});
const task = (id: number, due: string | null, over: Partial<PersonalTask> = {}): PersonalTask => ({
  id, title: `T${id}`, description: '', due_date: due, due_time: null, priority: 'MEDIUM', status: 'OPEN', project: '', ...over,
});

describe('Organisation: Kalender', () => {
  it('builds the month grid and the week from Monday', () => {
    const grid = monthGrid(new Date(2026, 9, 1), [ev(1, 4, 16, 17)], now);
    expect(grid).toHaveLength(42);
    expect(grid[0].key).toBe('2026-09-28');
    const today = grid.find((d) => d.today)!;
    expect(today.key).toBe('2026-10-04');
    expect(today.events.map((e) => e.id)).toEqual([1]);
    expect(gridRange(new Date(2026, 9, 1))).toEqual({ start: '2026-09-28', end: '2026-11-08' });
    expect(weekOf('2026-10-07')).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
  });

  it('describes times in de-DE, all-day without a time', () => {
    expect(timeRange(ev(1, 4, 16, 17))).toBe('16:00 – 17:00');
    expect(timeRange(ev(1, 4, 9, null, { all_day: true }))).toBe('Ganztägig');
    expect(startTime(ev(1, 4, 9, 10))).toBe('09:00');
    expect(dayWord('2026-10-04', now)).toBe('Heute');
    expect(dayWord('2026-10-08', now)).toBe('Do, 08.10.');
  });

  it('finds events of a day, also overnight ones', () => {
    const late = ev(2, 3, 22, null, { ends_at: iso(4, 1) });
    expect(eventsOn([ev(1, 4, 9, 10), late, ev(3, 5, 9, 10)], '2026-10-04').map((e) => e.id)).toEqual([2, 1]);
  });

  it('expands recurring events into the range (weekly, yearly) and keeps the series start', () => {
    const weekly = ev(1, 5, 9, 10, { recurrence: 'weekly' });
    const yearly = ev(2, 7, 0, null, { recurrence: 'yearly', all_day: true, starts_at: new Date(2020, 9, 7).toISOString() });
    const october = expandEvents([weekly, yearly, ev(3, 1, 9, null, { starts_at: iso(1, 9, 0, 8) })], '2026-10-01', '2026-10-31');
    expect(october.filter((e) => e.id === 1).map((e) => new Date(e.starts_at).getDate())).toEqual([5, 12, 19, 26]);
    expect(october.filter((e) => e.id === 2).map((e) => new Date(e.starts_at).getFullYear())).toEqual([2026]);
    expect(october.find((e) => e.id === 1 && new Date(e.starts_at).getDate() === 12)!.series_starts_at).toBe(weekly.starts_at);
    expect(october.some((e) => e.id === 3)).toBe(false); // September liegt nicht im Zeitraum
  });
});

describe('Organisation: Aufgaben', () => {
  it('filters the five views and sorts by due date', () => {
    const tasks = [
      task(1, '2026-10-02'),
      task(2, '2026-10-04', { priority: 'HIGH' }),
      task(3, '2026-10-04', { recurrence_days: 7, repeat: 'weekly' }),
      task(4, null),
      task(5, '2026-10-01', { status: 'DONE' }),
    ];
    expect(filterTasks(tasks, 'all', now).map((t) => t.id)).toEqual([1, 2, 3, 4]);
    expect(filterTasks(tasks, 'today', now).map((t) => t.id)).toEqual([2, 3]);
    expect(filterTasks(tasks, 'overdue', now).map((t) => t.id)).toEqual([1]);
    expect(filterTasks(tasks, 'recurring', now).map((t) => t.id)).toEqual([3]);
    expect(filterTasks(tasks, 'done', now).map((t) => t.id)).toEqual([5]);
  });

  it('describes when a task is due', () => {
    expect(taskDue(task(1, '2026-10-04'), now)).toEqual({ text: 'Heute', late: false });
    expect(taskDue(task(1, '2026-10-04', { due_time: '16:00' }), now).text).toBe('Heute, 16:00');
    expect(taskDue(task(1, '2026-10-02'), now)).toEqual({ text: '2. Okt.', late: true });
    expect(taskDue(task(1, null), now).text).toBe('Ohne Datum');
  });
});

describe('Organisation: Notizen', () => {
  const note = (over: Partial<PersonalNote>): PersonalNote => ({
    id: 1, title: '', body: '', pinned: false, created_at: now.toISOString(), updated_at: now.toISOString(), ...over,
  });
  it('uses the first line when there is no title', () => {
    expect(noteTitle(note({ title: 'Arztfragen' }))).toBe('Arztfragen');
    expect(noteTitle(note({ body: '\nTelefonnummer Hausverwaltung\nzweite Zeile' }))).toBe('Telefonnummer Hausverwaltung');
    expect(noteTitle(note({}))).toBe('Ohne Titel');
  });
  it('says when it was last edited', () => {
    expect(noteEdited(new Date(2026, 9, 4, 9).toISOString(), now)).toBe('Heute');
    expect(noteEdited(new Date(2026, 9, 3, 9).toISOString(), now)).toBe('Gestern');
    expect(noteEdited(new Date(2026, 9, 2, 9).toISOString(), now)).toBe('02.10.2026');
  });
});
