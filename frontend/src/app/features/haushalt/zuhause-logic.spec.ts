import { FolderEntryDto, TaskDto } from './haushalt-api.service';
import { deviceIcon } from './geraete-logic';
import { dayGroupKey, devicesByRoom, doneToday, dueNow, fairness, groupTasks, minutesLabel, nextDeadlines, roomStates } from './zuhause-logic';

// Freitag, 30. Oktober 2026
const today = new Date(2026, 9, 30);
let id = 0;
const task = (over: Partial<TaskDto> = {}): TaskDto => ({
  id: ++id, title: 'Aufgabe', description: '', status: 'open', assigned_to: null, assigned_to_name: null,
  due_date: null, due_time: null, recurrence: null, recurrence_days: null, recurrence_months: null, effort: 1,
  room: '', duration_minutes: null, priority: 'mittel', rotate: false, rotation_member_ids: [], is_paused: false,
  streak: null, is_done: false, is_overdue: false, last_done_at: null, last_done_by_name: null, ...over,
} as TaskDto);

describe('zuhause-logic', () => {
  it('ordnet Räume nach Dringlichkeit und sagt es in Worten', () => {
    const rooms = roomStates([
      task({ room: 'kueche', due_date: '2026-11-04' }),
      task({ room: 'bad', due_date: '2026-10-30' }),
      task({ room: 'wohnzimmer', due_date: '2026-10-29' }),
      task({ room: 'flur', due_date: '2026-10-31' }),
      task({ room: 'flur', due_date: '2026-10-29', is_paused: true }),
      task({ room: 'alle', due_date: '2026-10-29' }),
      task({ room: '', due_date: '2026-10-29' }),
    ], today);
    expect(rooms.map((r) => [r.label, r.level, r.text])).toEqual([
      ['Wohnzimmer', 3, '1 überfällig'],
      ['Badezimmer', 2, '1 heute'],
      ['Flur', 1, 'morgen'],
      ['Küche', 0, 'in 5 Tagen'],
    ]);
  });

  it('zählt, was heute ansteht, die Zeit dafür und was heute schon erledigt ist', () => {
    const tasks = [
      task({ due_date: '2026-10-29', duration_minutes: 10 }),
      task({ due_date: '2026-10-30', duration_minutes: 20 }),
      task({ due_date: '2026-10-31', duration_minutes: 90 }),
      task({ due_date: '2026-10-30', is_paused: true, duration_minutes: 15 }),
    ];
    expect(dueNow(tasks, today)).toHaveLength(2);
    expect(minutesLabel(dueNow(tasks, today))).toBe('ca. 30 Min.');
    expect(minutesLabel([task()])).toBe('');
    // lokaler Kalendertag zählt, nicht das UTC-Datum im Zeitstempel
    const local = (h: number) => new Date(2026, 9, 30, h, 5).toISOString();
    expect(doneToday([task({ last_done_at: local(0) }), task({ last_done_at: local(23) }), task({ last_done_at: '2026-10-28T12:00:00Z' })], today)).toBe(2);
  });

  it('zeigt die Verteilung nur bei mehreren Personen mit Erledigtem', () => {
    expect(fairness([{ user_id: 1, name: 'Anna', points: 9, count: 6 }])).toBeNull();
    expect(fairness([{ user_id: 1, name: 'Anna', points: 0, count: 0 }, { user_id: 2, name: 'Ben', points: 0, count: 0 }])).toBeNull();
    const f = fairness([{ user_id: 1, name: 'Anna', points: 9, count: 6 }, { user_id: 2, name: 'Ben', points: 5, count: 4 }])!;
    expect(f.text).toBe('Anna 6 · Ben 4');
    expect(f.parts.map((p) => p.share)).toEqual([60, 40]);
  });

  it('gruppiert nach Tag, Raum und Person', () => {
    expect(['2026-10-28', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', null].map((d) => dayGroupKey(task({ due_date: d }), today)))
      .toEqual(['overdue', 'today', 'tomorrow', 'week', 'later', 'none']);
    const list = [
      task({ due_date: '2026-11-10', room: 'bad', assigned_to: 2, assigned_to_name: 'Ben' }),
      task({ due_date: '2026-10-30', room: 'kueche' }),
      task({ due_date: '2026-10-29', room: 'bad', assigned_to: 1, assigned_to_name: 'Anna' }),
    ];
    expect(groupTasks(list, 'tag', today).map((g) => [g.label, g.tasks.length])).toEqual([['Überfällig', 1], ['Heute', 1], ['Später', 1]]);
    expect(groupTasks(list, 'raum', today).map((g) => g.label)).toEqual(['Küche', 'Badezimmer']);
    expect(groupTasks(list, 'person', today).map((g) => g.label)).toEqual(['Anna', 'Ben', 'Noch niemand zuständig']);
  });

  it('Zuhause: nächste Fristen ab heute, ohne ausgemusterte; Geräte nach Raum; passende Symbole', () => {
    const entry = (over: Partial<FolderEntryDto>) => ({ id: ++id, kind: 'geraet', name: 'Gerät', status: 'ACTIVE', effective_status: 'ACTIVE', room: '', deadlines: [], ...over }) as FolderEntryDto;
    const list = [
      entry({ name: 'Heizung', room: 'flur', deadlines: [{ art: 'wartung', datum: '2026-11-21', titel: '' }] }),
      entry({ name: 'Geschirrspüler', room: 'kueche', deadlines: [{ art: 'wartung', datum: '2026-11-12', titel: '' }, { art: 'garantie', datum: '2026-10-01', titel: '' }] }),
      entry({ name: 'Alter Trockner', room: 'waschkueche', status: 'RETIRED', deadlines: [{ art: 'wartung', datum: '2026-11-01', titel: '' }] }),
      entry({ name: 'Kaffeemaschine', room: 'kueche', deadlines: [{ art: 'garantie', datum: '2026-12-25', titel: '' }] }),
    ];
    const next = nextDeadlines(list, 4, today);
    expect(next.map((n) => [n.entry.name, n.label, n.days])).toEqual([
      ['Geschirrspüler', 'Wartung', 13],
      ['Heizung', 'Wartung', 22],
      ['Kaffeemaschine', 'Garantie endet', 56],
    ]);
    // ausgemusterte Geräte am Ende, in eigener Gruppe
    expect(devicesByRoom(list).map((g) => [g.label, g.items.length])).toEqual([['Küche', 2], ['Flur', 1], ['Außer Betrieb', 1]]);
    expect(['Heizung', 'Backofen', 'Kaffeemaschine', 'Wäschetrockner', 'Geschirrspüler', 'Router'].map((name) => deviceIcon({ name })))
      .toEqual(['heater', 'oven', 'coffee', 'washer', 'dishwasher', 'device']);
  });
});

