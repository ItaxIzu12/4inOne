import { TaskDto } from './haushalt-api.service';
import { dueLabel, durationLabel, endOfWeekIso, filterTasks, groupTasks, initials, NO_FILTERS, room } from './aufgaben-logic';

const today = new Date(2026, 9, 4); // Sonntag, 4. Oktober 2026
const t = (id: number, over: Partial<TaskDto> = {}): TaskDto =>
  ({
    id, title: `T${id}`, description: '', status: 'open', assigned_to: null, assigned_to_name: null, due_date: null,
    due_time: null, recurrence: null, recurrence_days: null, recurrence_months: null, effort: 1, room: '',
    duration_minutes: null, priority: 'mittel', rotate: false, rotation_member_ids: [], is_done: false,
    is_overdue: false, last_done_at: null, last_done_by_name: null, ...over,
  }) as TaskDto;

describe('Aufgaben-Reiter: Anzeigeregeln', () => {
  it('groups tasks into overdue, today, this week, later and undated — dropping empty groups', () => {
    const groups = groupTasks(
      [t(1, { due_date: '2026-10-03' }), t(2, { due_date: '2026-10-04' }), t(3, { due_date: '2026-10-09' }), t(4)],
      today,
    );
    expect(groups.map((g) => [g.key, g.tasks.map((x) => x.id)])).toEqual([
      ['overdue', [1]], ['today', [2]], ['week', [3]], ['undated', [4]],
    ]);
  });

  it('labels due dates the way the design does', () => {
    expect(dueLabel(t(1, { due_date: '2026-10-03' }), today)).toEqual({ text: 'Gestern', tone: 'late' });
    expect(dueLabel(t(1, { due_date: '2026-09-30' }), today)).toEqual({ text: '30. September', tone: 'late' });
    expect(dueLabel(t(1, { due_date: '2026-10-04' }), today)).toEqual({ text: 'Heute', tone: 'today' });
    expect(dueLabel(t(1, { due_date: '2026-10-08' }), today).text).toBe('Do, 8. Okt.');
    expect(dueLabel(t(1, { due_date: '2026-11-20' }), today).text).toBe('20. November');
  });

  it('formats durations, initials and rooms', () => {
    expect(durationLabel(5)).toBe('5 Min.');
    expect(durationLabel(90)).toBe('1 Std. 30 Min.');
    expect(durationLabel(null)).toBe('');
    expect(initials('Jonas Schneider')).toBe('JS');
    expect(initials('Anna')).toBe('AN');
    expect(room('kueche')).toMatchObject({ label: 'Küche', icon: 'utensils' });
    expect(room('')).toBeNull();
  });

  it('filters by room, person, priority and due status together', () => {
    const tasks = [
      t(1, { room: 'kueche', assigned_to: 7, priority: 'hoch', due_date: '2026-10-04' }),
      t(2, { room: 'bad', assigned_to: null, priority: 'niedrig', due_date: '2026-10-02' }),
      t(3, { room: '', assigned_to: 7, priority: 'hoch' }),
    ];
    const ids = (f: Partial<typeof NO_FILTERS>) => filterTasks(tasks, { ...NO_FILTERS, ...f }, today).map((x) => x.id);
    expect(ids({})).toEqual([1, 2, 3]);
    expect(ids({ room: 'kueche' })).toEqual([1]);
    expect(ids({ room: 'none' })).toEqual([3]);
    expect(ids({ person: '7' })).toEqual([1, 3]);
    expect(ids({ person: 'none' })).toEqual([2]);
    expect(ids({ priority: 'hoch', status: 'today' })).toEqual([1]);
    expect(ids({ status: 'overdue' })).toEqual([2]);
  });

  it('finds the end of the week for “Diese Woche”', () => {
    expect(endOfWeekIso(today)).toBe('2026-10-04'); // Sonntag selbst
    expect(endOfWeekIso(new Date(2026, 9, 5))).toBe('2026-10-11');
  });
});
