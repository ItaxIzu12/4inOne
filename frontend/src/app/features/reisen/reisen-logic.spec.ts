import { describe, expect, it } from 'vitest';
import { PackingItem, Trip, TripTask } from './reisen-api.service';
import {
  budgetRows,
  countdown,
  dueLabel,
  filterTasks,
  formatMoney,
  groupTrips,
  initials,
  longRange,
  nights,
  packingGroups,
  planningTips,
  shortRange,
  tripDays,
  tripIcon,
  tripPhase,
  whenText,
} from './reisen-logic';

function trip(extra: Partial<Trip>): Trip {
  return {
    id: 1, title: 'Reise', destination: '', departure: '', start_date: '2026-03-14', end_date: '2026-03-16', notes: '', status: 'PLANNED',
    travel_type: '', transport_type: '', baggage_type: '', budget_amount: null, currency: 'EUR', accommodation: '',
    accommodation_area: '', transport_note: '', created_at: '', updated_at: '2026-01-01', packing_total: 0, packing_packed: 0,
    tasks_open: 0, tasks_total: 0, events_count: 0, budget_spent: '0.00', participants: [], my_role: 'OWNER', ...extra,
  };
}
function item(id: number, title: string, category: PackingItem['category'], is_packed = false): PackingItem {
  return { id, trip: 1, title, category, is_packed, quantity: 1, note: '' };
}
function task(id: number, extra: Partial<TripTask> = {}): TripTask {
  return { id, trip: 1, title: `Aufgabe ${id}`, due_date: null, due_time: null, status: 'OPEN', note: '', assignee: null, ...extra };
}

describe('reisen-logic', () => {
  it('counts days and nights of a trip and the countdown', () => {
    const t = trip({});
    expect(tripDays(t)).toBe(3);
    expect(nights(t)).toBe(2);
    expect(countdown(t, '2026-03-02')).toBe('in 12 Tagen');
    expect(countdown(t, '2026-03-13')).toBe('morgen');
    expect(countdown(t, '2026-03-14')).toBe('heute');
    expect(countdown(t, '2026-03-15')).toBeNull();
  });

  it('picks a meaningful icon and initials', () => {
    expect(tripIcon(trip({ travel_type: 'BEACH' }))).toBe('umbrella');
    expect(tripIcon(trip({ travel_type: 'ACTIVE' }))).toBe('mountain');
    expect(tripIcon(trip({ transport_type: 'CAR' }))).toBe('car');
    expect(tripIcon(trip({}))).toBe('travel');
    expect(initials('Tom Schulz')).toBe('TS');
    expect(initials('Anna')).toBe('AN');
  });

  it('groups the packing list and keeps the count of the whole category in every view', () => {
    const items = [item(1, 'Pass', 'DOKUMENTE', true), item(2, 'Ticket', 'DOKUMENTE'), item(3, 'Jacke', 'KLEIDUNG', true)];
    const open = packingGroups(items, 'open');
    expect(open.map((g) => g.label)).toEqual(['Wichtige Dokumente']);
    expect(open[0].packed).toBe(1);
    expect(open[0].total).toBe(2);
    expect(packingGroups(items, 'done').map((g) => g.category)).toEqual(['DOKUMENTE', 'KLEIDUNG']);
  });

  it('compares planned and spent per category, only where something is planned or spent', () => {
    const rows = budgetRows(
      [{ id: 1, trip: 1, category: 'UNTERKUNFT', planned_amount: '300.00' }, { id: 2, trip: 1, category: 'ESSEN', planned_amount: '100.00' }],
      [
        { id: 1, trip: 1, title: 'Hotel', amount: '240.00', date: '2026-03-01', category: 'UNTERKUNFT' },
        { id: 2, trip: 1, title: 'Essen', amount: '120.00', date: '2026-03-01', category: 'ESSEN' },
        { id: 3, trip: 1, title: 'Souvenir', amount: '10.00', date: '2026-03-01', category: 'SHOPPING' },
      ],
    );
    expect(rows.map((r) => [r.label, r.pct, r.remaining, r.over])).toEqual([
      ['Unterkunft', 80, 60, false],
      ['Essen', 120, -20, true],
      ['Shopping', 100, -10, false],
    ]);
  });

  it('formats money compactly only for whole amounts', () => {
    expect(formatMoney(700, 'EUR', true)).toBe('700 €');
    expect(formatMoney('45.5', 'EUR', true)).toBe('45,50 €');
    expect(formatMoney(2000, 'USD', true)).toBe('$ 2.000');
    expect(formatMoney(700, 'EUR')).toBe('700,00 €');
  });

  it('derives the phase of a trip from its dates — "unterwegs" is not a stored status', () => {
    const t = trip({ start_date: '2026-11-12', end_date: '2026-11-15' });
    expect(tripPhase(t, '2026-10-06')).toBe('upcoming');
    expect(tripPhase(t, '2026-11-13')).toBe('ongoing');
    expect(tripPhase(t, '2026-11-16')).toBe('past');
    expect(tripPhase({ ...t, status: 'CANCELLED' }, '2026-10-06')).toBe('cancelled');
    expect(whenText(t, '2026-10-06')).toBe('In 37 Tagen');
    expect(whenText(t, '2026-11-11')).toBe('Morgen');
    expect(whenText(t, '2026-11-12')).toBe('Unterwegs · Tag 1 von 4');
    expect(whenText(t, '2026-11-20')).toBe('Vorbei');
  });

  it('formats date ranges compactly in German', () => {
    expect(shortRange(trip({ start_date: '2026-11-12', end_date: '2026-11-15' }))).toBe('12.–15. Nov. 2026');
    expect(shortRange(trip({ start_date: '2026-11-30', end_date: '2026-12-02' }))).toBe('30. Nov. – 2. Dez. 2026');
    expect(shortRange(trip({ start_date: '2026-12-30', end_date: '2027-01-02' }))).toBe('30. Dez. 2026 – 2. Jan. 2027');
    expect(longRange(trip({ start_date: '2026-11-12', end_date: '2026-11-15' }))).toBe('12.–15. November 2026');
  });

  it('groups Meine Reisen: upcoming (incl. running) earliest first, past newest first, cancelled apart', () => {
    const today = '2026-10-06';
    const trips = [
      trip({ id: 1, start_date: '2027-05-01', end_date: '2027-05-10' }),
      trip({ id: 2, start_date: '2026-10-05', end_date: '2026-10-08' }),
      trip({ id: 3, start_date: '2026-01-01', end_date: '2026-01-05', status: 'DONE' }),
      trip({ id: 4, start_date: '2026-09-01', end_date: '2026-09-05' }),
      trip({ id: 5, start_date: '2026-12-01', end_date: '2026-12-03', status: 'CANCELLED' }),
    ];
    const g = groupTrips(trips, today);
    expect(g.upcoming.map((t) => t.id)).toEqual([2, 1]);
    expect(g.past.map((t) => t.id)).toEqual([4, 3]);
    expect(g.cancelled.map((t) => t.id)).toEqual([5]);
  });

  it('filters trip tasks into open (by due date), done and mine', () => {
    const tasks = [
      task(1, { due_date: '2026-11-10' }),
      task(2),
      task(3, { due_date: '2026-11-01', assignee: 7 }),
      task(4, { status: 'DONE', assignee: 7 }),
    ];
    expect(filterTasks(tasks, 'open', 7).map((t) => t.id)).toEqual([3, 1, 2]);
    expect(filterTasks(tasks, 'done', 7).map((t) => t.id)).toEqual([4]);
    expect(filterTasks(tasks, 'mine', 7).map((t) => t.id)).toEqual([3]);
    expect(filterTasks(tasks, 'mine', null)).toEqual([]);
  });

  it('gives at most three general planning tips that fit the transport', () => {
    expect(planningTips(trip({ transport_type: 'FLIGHT' }))).toContain('Online Check-in öffnet oft 24–48 Stunden vor Abflug.');
    expect(planningTips(trip({ transport_type: 'TRAIN' }))).toContain('Tickets auch offline speichern.');
    expect(planningTips(trip({})).length).toBeLessThanOrEqual(3);
  });

  it('labels due dates', () => {
    const today = '2026-03-01';
    expect(dueLabel('2026-03-01', today)).toEqual({ text: 'Heute', urgent: true });
    expect(dueLabel('2026-02-27', today)).toEqual({ text: 'Überfällig', urgent: true });
    expect(dueLabel('2026-03-12', today)).toEqual({ text: '12. März', urgent: false });
    expect(dueLabel(null, today)).toEqual({ text: 'Ohne Datum', urgent: false });
  });
});
