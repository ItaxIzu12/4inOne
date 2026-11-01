import { PersonalEvent, PersonalTask } from './organisation-api.service';
import { dayLine, nextUp, span, tasksForToday } from './org-day-logic';

// Samstag, 31. Oktober 2026, 14:40 Uhr (lokal)
const now = new Date(2026, 9, 31, 14, 40);
const at = (h: number, m = 0, d = 31) => new Date(2026, 9, d, h, m).toISOString();
let id = 0;
const ev = (start: string, end: string | null, over: Partial<PersonalEvent> = {}): PersonalEvent => ({
  id: ++id, title: 'Termin', starts_at: start, ends_at: end, all_day: false, recurrence: '', location: '', description: '', ...over,
});
const task = (over: Partial<PersonalTask>): PersonalTask => ({
  id: ++id, title: 'Aufgabe', description: '', due_date: null, due_time: null, priority: 'MEDIUM', status: 'OPEN', ...over,
});

describe('org-day-logic', () => {
  it('Tageslinie: Termine in Folge, freie Zeit ab jetzt dazwischen, ganztägige gesondert', () => {
    const events = [
      ev(at(19), at(20, 30), { title: 'Badminton' }),
      ev(at(16), at(16, 45), { title: 'Zahnarzt' }),
      ev(at(9), at(10), { title: 'Frühstück' }),
      ev(at(0), null, { title: 'Geburtstag', all_day: true }),
    ];
    const line = dayLine(events, '2026-10-31', now);
    expect(line.allDay.map((e) => e.title)).toEqual(['Geburtstag']);
    expect(line.items.map((i) => (i.kind === 'event' ? i.event.title : `frei ${i.minutes}`))).toEqual([
      'Frühstück', 'frei 80', 'Zahnarzt', 'frei 135', 'Badminton', 'frei 90',
    ]);
    const first = line.items[0];
    expect(first.kind === 'event' && first.past).toBe(true);
    // 14:40–16:00 (80) + 16:45–19:00 (135) + 20:30–22:00 (90)
    expect(line.free).toBe(305);
    expect(line.items.at(-1)).toMatchObject({ kind: 'free', open: true });
  });

  it('Lücken unter 30 Minuten zählen nicht; ein anderer Tag beginnt um 7:00', () => {
    const nov = (h: number, m = 0) => new Date(2026, 10, 2, h, m).toISOString();
    const line = dayLine([ev(nov(8), nov(9)), ev(nov(9, 20), nov(10))], '2026-11-02', now);
    expect(line.items.map((i) => i.kind)).toEqual(['free', 'event', 'event', 'free']);
    expect(line.items[0]).toMatchObject({ start: 7 * 60, minutes: 60 });
  });

  it('als Nächstes: laufender oder kommender Termin in Worten', () => {
    expect(nextUp([ev(at(16), at(16, 45))], now)?.text).toBe('in 1 Std. 20 Min.');
    expect(nextUp([ev(at(14), at(15))], now)?.text).toBe('läuft bis 15:00');
    expect(nextUp([ev(at(9), at(10))], now)).toBeNull();
    expect(nextUp([ev(at(19), at(20))], now)?.text).toBe('um 19:00');
    expect(span(45)).toBe('45 Min.');
    expect(span(120)).toBe('2 Std.');
  });

  it('Aufgaben für heute: überfällige zuerst, erledigte und künftige nicht', () => {
    const list = tasksForToday([
      task({ title: 'Heute', due_date: '2026-10-31', due_time: '09:00' }),
      task({ title: 'Alt', due_date: '2026-10-29' }),
      task({ title: 'Morgen', due_date: '2026-11-01' }),
      task({ title: 'Fertig', due_date: '2026-10-31', status: 'DONE' }),
    ], now);
    expect(list.map((x) => [x.task.title, x.late])).toEqual([['Alt', true], ['Heute', false]]);
  });
});
