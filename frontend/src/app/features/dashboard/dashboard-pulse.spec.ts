import { HaushaltOverviewDto, TaskDto } from '../haushalt/haushalt-api.service';
import { PersonalEvent, TodayItem } from '../organisation/organisation-api.service';
import { Trip } from '../reisen/reisen-api.service';
import { financeAnswer, householdAnswer, ideaForToday, organisationAnswer, progressRings, spentOn, travelAnswer } from './dashboard-pulse';

// Samstag, 31. Oktober 2026, 10:00 Uhr (lokal)
const now = new Date(2026, 9, 31, 10, 0);
const at = (h: number, m = 0) => new Date(2026, 9, 31, h, m).toISOString();
const eur = (v: number) => `${v} €`;
const ev = (start: string, end: string, title = 'Zahnarzt'): PersonalEvent =>
  ({ id: 1, title, starts_at: start, ends_at: end, all_day: false, recurrence: '', location: '', description: '' }) as PersonalEvent;
const task = (over: Partial<TaskDto>): TaskDto => ({ id: 1, title: 'Bad putzen', room: 'bad', is_overdue: false, ...over }) as TaskDto;
const home = (today: TaskDto[], summary: Partial<HaushaltOverviewDto['summary']> = {}) =>
  ({ today, open_tasks: today.length, summary: { done_this_week: 0, due_today: 0, overdue_tasks: 0, ...summary } }) as HaushaltOverviewDto;
const trip = (over: Partial<Trip> = {}): Trip =>
  ({ id: 1, title: 'Berlin Wochenende', destination: 'Berlin, Deutschland', start_date: '2026-11-12', end_date: '2026-11-14', status: 'CONFIRMED',
     tasks_total: 5, tasks_open: 4, packing_total: 24, packing_packed: 12, ...over }) as Trip;

describe('dashboard-pulse (Vier Antworten, Fortschritt, Idee)', () => {
  it('Finanzen: heute ausgegeben, dazu was pro Tag drin ist — nicht die Monatszahl der Karte', () => {
    const m = { set: true, over: false, amount: '702,29 €', perDay: '23 €', monthName: 'Oktober' };
    const a = financeAnswer(m, 34.8, eur, '/demo')!;
    expect(a.big).toBe('34.8 €');
    expect(a.line).toBe('heute ausgegeben · 23 € pro Tag drin');
    expect(a.path).toBe('/demo/finanzen');
    expect(financeAnswer(m, 0, eur, '')!.line).toBe('heute noch nichts ausgegeben · 23 € pro Tag drin');
    expect(financeAnswer({ ...m, lastDay: true }, 5, eur, '')!.line).toBe('heute ausgegeben · 702,29 € übrig im Oktober');
    expect(financeAnswer(m, null, eur, '')).toBeNull(); // Transaktionen noch nicht geladen
    expect(spentOn([{ amount: '-6.50', type: 'EXPENSE', date: '2026-10-31' }, { amount: '28.30', type: 'EXPENSE', date: '2026-10-31' },
                    { amount: '2000', type: 'INCOME', date: '2026-10-31' }, { amount: '9', type: 'EXPENSE', date: '2026-10-30' }], '2026-10-31')).toBeCloseTo(34.8);
  });

  it('Haushalt: Anzahl heute, ein Feld je Aufgabe, der überfällige Raum in Worten', () => {
    const a = householdAnswer(home([task({ is_overdue: true, room: 'wohnzimmer' }), task({}), task({})]), '')!;
    expect(a.big).toBe('3 Aufgaben');
    expect(a.line).toBe('1 überfällig (Wohnzimmer) · 2 heute fällig');
    expect(householdAnswer(home([]), '')!.big).toBe('Alles erledigt');
  });

  it('Organisation: als Nächstes mit Uhrzeit und freier Zeit; ohne Termine die Aufgaben', () => {
    const a = organisationAnswer([ev(at(16), at(16, 45))], [], now, '')!;
    expect(a.big).toBe('16:00');
    // 10:00–16:00 (360) + 16:45–22:00 (315)
    expect(a.line).toBe('Zahnarzt · 11 Std. 15 Min. ohne Termin');
    expect(organisationAnswer([ev(at(9, 30), at(10, 30))], [], now, '')!.big).toBe('Jetzt');
    const items = [{ kind: 'task', id: 2, title: 'Steuer', at: at(9), overdue: true }] as TodayItem[];
    expect(organisationAnswer([], items, now, '')!.big).toBe('1 Aufgabe');
  });

  it('Reisen: Tage bis zur Abreise, Aufgaben und Packliste getrennt und beschriftet; ohne Reise eine Einladung', () => {
    const a = travelAnswer(trip(), '2026-10-31', '')!;
    expect(a.big).toBe('12 Tage');
    expect(a.line).toBe('bis Berlin · 4 Aufgaben offen');
    expect(a.pct).toBe(50);
    expect(a.barLabel).toBe('Packliste 12 von 24');
    expect(travelAnswer(null, '2026-10-31', '')).toMatchObject({ big: 'Wohin?', empty: true });
  });

  it('Fortschritt: nur Ringe mit Grundlage, aus gezählten Werten', () => {
    const rings = progressRings(home([], { done_this_week: 5, due_today: 2, overdue_tasks: 1 }), { saved: '1025.00', saved_planned: '25.00' }, trip(), eur);
    expect(rings.map((r) => [r.area, r.pct, r.value])).toEqual([
      ['haushalt', 63, '5 erledigt'],
      ['finanzen', 98, '1000 €'],
      ['reisen', 50, '12 von 24'],
    ]);
    expect(progressRings(home([]), { saved: '0', saved_planned: '0' }, null, eur)).toEqual([]);
  });

  it('Idee für heute: freie Lücke + offene Aufgabe (überfällige zuerst); sonst keine', () => {
    const items = [
      { kind: 'task', id: 2, title: 'Präsentation', at: at(0), overdue: false },
      { kind: 'task', id: 3, title: 'Steuer', at: at(0), overdue: true },
    ] as TodayItem[];
    const idea = ideaForToday([ev(at(13), at(14))], items, now)!;
    expect(idea.task.id).toBe(3);
    expect(idea.text).toBe('Bis 13:00 ist nichts eingetragen – passt für „Steuer“, das schon überfällig ist.');
    expect(ideaForToday([ev(at(13), at(14))], [], now)).toBeNull();
  });
});
