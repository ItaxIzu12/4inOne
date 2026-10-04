import { TaskDto } from './haushalt-api.service';
import { filterRoutines, groupRoutines, mobileMeta, nextDue, rhythm, routineIconFor, sortRoutines, streakLabel } from './routinen-logic';

const today = new Date(2026, 9, 4); // Sonntag, 4. Oktober 2026
const t = (id: number, over: Partial<TaskDto> = {}): TaskDto =>
  ({
    id, title: `R${id}`, description: '', status: 'open', assigned_to: null, assigned_to_name: null, due_date: null,
    due_time: null, recurrence: 'daily', recurrence_days: 1, recurrence_months: null, effort: 1, room: '',
    duration_minutes: null, priority: 'mittel', rotate: false, rotation_member_ids: [], is_paused: false, streak: 0,
    is_done: false, is_overdue: false, last_done_at: null, last_done_by_name: null, ...over,
  }) as TaskDto;

describe('Routinen-Reiter: Anzeigeregeln', () => {
  it('groups by daily, weekly, monthly and other rhythms, dropping empty groups', () => {
    const groups = groupRoutines([t(1), t(2, { recurrence_days: 7 }), t(3, { recurrence_days: 3 }), t(4, { recurrence_days: null, recurrence_months: 1 })]);
    expect(groups.map((g) => [g.key, g.tasks.map((x) => x.id)])).toEqual([
      ['daily', [1]], ['weekly', [2]], ['monthly', [4]], ['other', [3]],
    ]);
  });

  it('describes rhythm, next due date and streak like the design', () => {
    expect(rhythm(t(1, { recurrence_days: 7, due_date: '2026-10-05' }))).toEqual({ main: 'Wöchentlich', sub: 'immer Mo.' });
    expect(rhythm(t(1, { recurrence_days: null, recurrence_months: 1, due_date: '2026-11-01' }))).toEqual({ main: 'Monatlich', sub: 'am 1.' });
    expect(nextDue(t(1, { due_date: '2026-10-04', due_time: '20:00:00' }), today)).toMatchObject({ badge: 'Heute', sub: 'bis 20:00' });
    expect(nextDue(t(1, { due_date: '2026-10-03' }), today)).toMatchObject({ badge: 'Überfällig', sub: 'seit gestern' });
    expect(nextDue(t(1, { due_date: '2026-10-05' }), today)).toMatchObject({ main: 'Morgen', sub: '05. Okt. 2026' });
    expect(nextDue(t(1, { due_date: '2026-10-07' }), today)).toMatchObject({ main: 'Mi., 07. Okt.', sub: 'in 3 Tagen' });
    expect(nextDue(t(1, { is_paused: true, due_date: '2026-10-07' }), today).main).toBe('Pausiert');
    expect(streakLabel(t(1, { streak: 12 }))).toBe('12 Tage');
    expect(streakLabel(t(1, { recurrence_days: 7, streak: 1 }))).toBe('1 Woche');
    expect(streakLabel(t(1, { recurrence_days: null, recurrence_months: 1, streak: 3 }))).toBe('3 Monate');
    expect(streakLabel(t(1, { streak: 0 }))).toBe('');
    expect(mobileMeta(t(1, { recurrence_days: 7, due_date: '2026-10-06' }), today)).toBe('Immer Di. • in 2 Tagen');
    expect(mobileMeta(t(1, { due_date: '2026-10-04', due_time: '20:00:00' }), today)).toBe('Täglich • bis 20:00');
  });

  it('filters by chip and sorts paused routines last', () => {
    const tasks = [
      t(1, { due_date: '2026-10-04', assigned_to: 7 }),
      t(2, { recurrence_days: 7, due_date: '2026-10-01', is_paused: true }),
      t(3, { recurrence_days: 7, due_date: '2026-10-09', rotate: true }),
    ];
    const ids = (chip: Parameters<typeof filterRoutines>[1]) => filterRoutines(tasks, chip, today).map((x) => x.id);
    expect(ids('weekly')).toEqual([2, 3]);
    expect(ids('pausiert')).toEqual([2]);
    expect(ids('heute')).toEqual([1]);
    expect(ids('geteilt')).toEqual([1, 3]);
    expect(sortRoutines(tasks, 'faellig').map((x) => x.id)).toEqual([1, 3, 2]);
  });

  it('picks an icon from the title, then the room', () => {
    expect(routineIconFor(t(1, { title: 'Müll rausbringen' }))).toBe('trash');
    expect(routineIconFor(t(1, { title: 'Rasen mähen', room: 'aussen' }))).toBe('tree');
    expect(routineIconFor(t(1, { title: 'Etwas' }))).toBe('repeat');
  });
});
