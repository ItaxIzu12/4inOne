import { TaskDto } from './haushalt-api.service';
import { distance, doneToday, nextDue, routineFrequency, routineIcon } from './uebersicht-logic';

const today = new Date(2026, 9, 4); // Sonntag, 4. Oktober 2026
const task = (over: Partial<TaskDto> = {}): TaskDto =>
  ({
    id: 1, title: 'Küche', description: '', status: 'open', assigned_to: null, assigned_to_name: null,
    due_date: '2026-10-04', due_time: null, recurrence: null, recurrence_days: null, recurrence_months: null,
    effort: 1, rotate: false, rotation_member_ids: [], is_done: false, is_overdue: false, last_done_at: null,
    last_done_by_name: null, ...over,
  }) as TaskDto;

describe('Haushalt-Übersicht: Anzeigeregeln', () => {
  it('picks routine icons from the title, with a neutral fallback', () => {
    expect(routineIcon('Bettwäsche wechseln')).toBe('bed');
    expect(routineIcon('Badezimmer reinigen')).toBe('household');
  });

  it('describes distances the way people say them', () => {
    expect(distance(0)).toBe('heute');
    expect(distance(1)).toBe('morgen');
    expect(distance(6)).toBe('in 6 Tagen');
    expect(distance(14)).toBe('in 2 Wochen');
    expect(distance(90)).toBe('in 3 Monaten');
  });

  it('labels routine frequency, with the weekday for weekly ones', () => {
    expect(routineFrequency(task({ recurrence_days: 1 }))).toBe('Täglich');
    expect(routineFrequency(task({ recurrence_days: 7, due_date: '2026-10-05' }))).toBe('Wöchentlich (Mo)');
    expect(routineFrequency(task({ recurrence_months: 1 }))).toBe('Monatlich');
  });

  it('knows whether a routine was done today and when it is next due', () => {
    expect(doneToday(task({ last_done_at: '2026-10-04T08:30:00' }), today)).toBe(true);
    expect(doneToday(task({ last_done_at: '2026-10-03T22:00:00' }), today)).toBe(false);
    expect(nextDue(task({ due_date: '2026-10-05' }), today)).toBe('Morgen');
    expect(nextDue(task({ due_date: '2026-10-10' }), today)).toBe('In 6 Tagen');
    expect(nextDue(task({ due_date: '2026-10-01' }), today)).toBe('Überfällig');
  });
});
