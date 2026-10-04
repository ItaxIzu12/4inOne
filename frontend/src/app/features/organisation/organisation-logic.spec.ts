import { PersonalEvent, PersonalNote, PersonalTask } from './organisation-api.service';
import {
  agoText,
  dayWord,
  editedAt,
  eventsOn,
  fileKind,
  fileSize,
  groupTasks,
  monthGrid,
  nextDays,
  noteLines,
  projects,
  relativeStart,
  taskDue,
  taskProgress,
  timeRange,
  weekOf,
} from './organisation-logic';

const now = new Date(2026, 9, 4, 12, 0); // Sonntag, 4. Oktober 2026, 12:00
const iso = (day: number, hh: number, mm = 0) => new Date(2026, 9, day, hh, mm).toISOString();
const ev = (id: number, day: number, from: number, to: number | null, over: Partial<PersonalEvent> = {}): PersonalEvent => ({
  id, title: `E${id}`, starts_at: iso(day, from), ends_at: to === null ? null : iso(day, to), location: '', description: '', ...over,
});
const task = (id: number, due: string | null, over: Partial<PersonalTask> = {}): PersonalTask => ({
  id, title: `T${id}`, description: '', due_date: due, due_time: null, priority: 'MEDIUM', status: 'OPEN', project: '', ...over,
});

describe('Organisation: Anzeigeregeln', () => {
  it('builds the month grid and the week from Monday', () => {
    const grid = monthGrid(new Date(2026, 9, 1), [ev(1, 4, 16, 17)], now);
    expect(grid).toHaveLength(42);
    expect(grid[0].key).toBe('2026-09-28');
    const today = grid.find((d) => d.today)!;
    expect(today.key).toBe('2026-10-04');
    expect(today.events.map((e) => e.id)).toEqual([1]);
    expect(weekOf('2026-10-07')).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
  });

  it('describes times and distances like the design', () => {
    expect(timeRange(ev(1, 4, 16, 17))).toBe('16:00 – 17:00');
    expect(relativeStart(ev(1, 4, 16, 17), now)).toBe('In 4 Std.');
    expect(relativeStart(ev(1, 4, 11, 13), now)).toBe('Läuft gerade');
    expect(relativeStart(ev(1, 5, 9, 10), now)).toBe('Morgen');
    expect(relativeStart(ev(1, 7, 9, 10), now)).toBe('In 3 Tagen');
    expect(dayWord('2026-10-04', now)).toBe('Heute');
    expect(dayWord('2026-10-08', now)).toBe('Do, 08.10.');
  });

  it('finds events of a day (also overnight) and groups the next days', () => {
    const overnight = ev(2, 3, 22, 23, { ends_at: iso(4, 1) });
    expect(eventsOn([overnight, ev(3, 4, 9, 10)], '2026-10-04').map((e) => e.id)).toEqual([2, 3]);
    const groups = nextDays([ev(4, 5, 9, 10), ev(5, 5, 11, 12), ev(6, 6, 9, 10), ev(7, 4, 15, 16)], now);
    expect(groups.map((g) => [g.day, g.events.map((e) => e.id)])).toEqual([['2026-10-05', [4, 5]], ['2026-10-06', [6]]]);
  });

  it('groups open tasks by urgency and measures progress', () => {
    const tasks = [
      task(1, '2026-10-01'),
      task(2, '2026-10-04', { due_time: '16:00:00' }),
      task(3, '2026-10-09'),
      task(4, '2026-11-20'),
      task(5, null),
      task(6, '2026-10-04', { status: 'DONE' }),
    ];
    expect(groupTasks(tasks, now).map((g) => [g.key, g.tasks.map((t) => t.id)])).toEqual([
      ['overdue', [1]], ['today', [2]], ['week', [3]], ['later', [4]], ['undated', [5]],
    ]);
    expect(taskDue(tasks[1], now)).toEqual({ text: 'Heute, 16:00', late: false });
    expect(taskDue(tasks[0], now)).toEqual({ text: '1. Okt.', late: true });
    expect(taskDue(tasks[2], now).text).toBe('Fr., 9. Okt.');
    expect(taskProgress(tasks, now)).toMatchObject({ done: 1, total: 6, pct: 17, overdue: 1, today: { done: 1, total: 2 }, week: { done: 1, total: 3 } });
  });

  it('counts projects of open tasks with a stable colour', () => {
    const list = projects([task(1, null, { project: 'Familie' }), task(2, null, { project: 'Familie' }), task(3, null, { project: 'Beruf' }), task(4, null, { project: 'Beruf', status: 'DONE' })]);
    expect(list.map((p) => [p.name, p.count])).toEqual([['Familie', 2], ['Beruf', 1]]);
    expect(projects([task(1, null, { project: 'Familie' })])[0].tone).toBe(list[0].tone);
  });

  it('shows notes and files in plain words', () => {
    const note = { id: 1, title: 'N', body: '• eins\n\n• zwei\n• drei\n• vier', pinned: false, created_at: '', updated_at: iso(4, 9, 14) } as PersonalNote;
    expect(noteLines(note)).toEqual(['• eins', '• zwei', '• drei']);
    expect(editedAt(note.updated_at, now)).toBe('Heute, 09:14');
    expect(editedAt(iso(3, 16, 42), now)).toBe('Gestern, 16:42');
    expect(fileSize(1_250_000)).toBe('1,2 MB');
    expect(fileSize(12_000)).toBe('12 KB');
    expect(fileKind({ content_type: 'application/pdf', name: 'a.pdf' }).label).toBe('PDF-Dokument');
    expect(fileKind({ content_type: 'image/png', name: 'a.png' }).image).toBe(true);
    expect(agoText(iso(4, 10), now)).toBe('vor 2 Stunden');
    expect(agoText(iso(1, 10), now)).toBe('vor 3 Tagen');
  });
});
