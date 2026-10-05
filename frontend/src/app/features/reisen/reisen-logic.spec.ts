import { describe, expect, it } from 'vitest';
import { PackingItem, Trip, TripReminder } from './reisen-api.service';
import {
  activeTripsSummary,
  budgetRows,
  countdown,
  dueLabel,
  shortWhen,
  tripSuggestion,
  filterReminders,
  filterTrips,
  formatMoney,
  groupReminders,
  householdConflicts,
  initials,
  nights,
  notPackedHint,
  packingGroups,
  reminderIcon,
  sortTrips,
  tripDays,
  tripIcon,
} from './reisen-logic';

function trip(extra: Partial<Trip>): Trip {
  return {
    id: 1, title: 'Reise', destination: '', start_date: '2026-03-14', end_date: '2026-03-16', notes: '', status: 'PLANNED',
    travel_type: '', transport_type: '', baggage_type: '', budget_amount: null, currency: 'EUR', accommodation: '',
    accommodation_area: '', transport_note: '', created_at: '', updated_at: '2026-01-01', packing_total: 0, packing_packed: 0,
    tasks_open: 0, tasks_total: 0, events_count: 0, budget_spent: '0.00', participants: [], my_role: 'OWNER', ...extra,
  };
}
function item(id: number, title: string, category: PackingItem['category'], is_packed = false): PackingItem {
  return { id, trip: 1, title, category, is_packed, quantity: 1, note: '' };
}
function reminder(extra: Partial<TripReminder>): TripReminder {
  return { key: String(Math.random()), source: 'TRIP_TASK', area: 'REISEN', id: 1, title: 'X', date: null, time: null, place: '', done: false, ...extra };
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

  it('filters trips by status, period and person, and sorts them', () => {
    const a = trip({ id: 1, title: 'B', start_date: '2025-05-01', end_date: '2025-05-03', status: 'DONE' });
    const b = trip({ id: 2, title: 'A', start_date: '2026-08-01', end_date: '2026-08-10', participants: [{ id: 1, trip: 2, user: 1, display_name: 'Lena', is_self: false, role: 'VIEWER', added_at: '' }] });
    const today = '2026-03-01';
    expect(filterTrips([a, b], { status: 'DONE', period: '', person: '' }, today)).toEqual([a]);
    expect(filterTrips([a, b], { status: '', period: 'upcoming', person: '' }, today)).toEqual([b]);
    expect(filterTrips([a, b], { status: '', period: 'past', person: '' }, today)).toEqual([a]);
    expect(filterTrips([a, b], { status: '', period: '', person: 'Lena' }, today)).toEqual([b]);
    expect(sortTrips([b, a], 'date-asc').map((t) => t.id)).toEqual([1, 2]);
    expect(sortTrips([a, b], 'date-desc').map((t) => t.id)).toEqual([2, 1]);
    expect(sortTrips([a, b], 'title').map((t) => t.title)).toEqual(['A', 'B']);
  });

  it('groups the packing list and keeps the count of the whole category in every view', () => {
    const items = [item(1, 'Pass', 'DOKUMENTE', true), item(2, 'Ticket', 'DOKUMENTE'), item(3, 'Jacke', 'KLEIDUNG', true)];
    const open = packingGroups(items, 'open');
    expect(open.map((g) => g.label)).toEqual(['Wichtige Dokumente']);
    expect(open[0].packed).toBe(1);
    expect(open[0].total).toBe(2);
    expect(packingGroups(items, 'done').map((g) => g.category)).toEqual(['DOKUMENTE', 'KLEIDUNG']);
  });

  it('names the most important items not packed yet', () => {
    expect(notPackedHint([item(1, 'Socken', 'KLEIDUNG'), item(2, 'Ladegerät', 'TECHNIK'), item(3, 'Reiseapotheke', 'GESUNDHEIT')])).toBe(
      'Noch nicht eingepackt: Ladegerät, Reiseapotheke und 1 weitere.',
    );
    expect(notPackedHint([item(1, 'Ladegerät', 'TECHNIK')])).toBe('Noch nicht eingepackt: Ladegerät.');
    expect(notPackedHint([item(1, 'Pass', 'DOKUMENTE', true)])).toBeNull();
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

  it('filters and groups reminders by day, and finds household items during the trip', () => {
    const items = [
      reminder({ title: 'Online Check-in öffnen', date: '2026-03-12' }),
      reminder({ title: 'Pflanzen gießen', date: '2026-03-14', area: 'HAUSHALT', source: 'HOUSEHOLD_TASK' }),
      reminder({ title: 'Abreise', date: '2026-03-14', area: 'ORGANISATION', source: 'ORG_EVENT' }),
      reminder({ title: 'Museumstickets', date: null }),
    ];
    expect(groupReminders(items).map((d) => [d.date, d.items.length])).toEqual([['2026-03-12', 1], ['2026-03-14', 2], [null, 1]]);
    const all = { range: 'all' as const, area: '' as const, kind: '' as const };
    expect(filterReminders(items, { ...all, range: 'today' }, '2026-03-14').map((r) => r.title)).toEqual(['Pflanzen gießen', 'Abreise']);
    expect(filterReminders(items, { ...all, range: 'week' }, '2026-03-10').length).toBe(3);
    expect(filterReminders(items, { ...all, kind: 'event' }, '2026-03-10').map((r) => r.title)).toEqual(['Abreise']);
    expect(householdConflicts(items, trip({})).map((r) => r.title)).toEqual(['Pflanzen gießen']);
    expect(reminderIcon(items[0])).toBe('travel');
    expect(reminderIcon(items[1])).toBe('plant');
  });

  it('formats money compactly only for whole amounts', () => {
    expect(formatMoney(700, 'EUR', true)).toBe('700 €');
    expect(formatMoney('45.5', 'EUR', true)).toBe('45,50 €');
    expect(formatMoney(2000, 'USD', true)).toBe('$ 2.000');
    expect(formatMoney(700, 'EUR')).toBe('700,00 €');
  });

  it('suggests one next step in a fixed order and skips what was put off', () => {
    const state = { packed: 12, packingTotal: 24, tasksOpen: 4, budgetTotal: 700 };
    expect(tripSuggestion(trip({}), state).title).toBe('Packliste noch unvollständig');
    expect(tripSuggestion(trip({}), state).text).toContain('12 von 24 Punkten');
    expect(tripSuggestion(trip({}), state, new Set(['packing'])).title).toBe('4 Aufgaben sind noch offen');
    expect(tripSuggestion(trip({}), { ...state, packingTotal: 0, packed: 0 }).title).toBe('Packliste anlegen');
    expect(tripSuggestion(trip({}), { packed: 3, packingTotal: 3, tasksOpen: 0, budgetTotal: 0 }).target).toBe('budget');
    const ready = tripSuggestion(trip({}), { packed: 3, packingTotal: 3, tasksOpen: 0, budgetTotal: 100 });
    expect([ready.title, ready.action]).toEqual(['Alles vorbereitet', null]);
    expect(tripSuggestion(trip({}), state, new Set(['packing', 'tasks'])).title).toBe('Für heute ist alles im Blick');
  });

  it('counts only running and upcoming trips, and labels due dates', () => {
    const today = '2026-03-01';
    const trips = [
      trip({ id: 1, status: 'CONFIRMED', end_date: '2026-03-16' }),
      trip({ id: 2, status: 'PLANNED', end_date: '2026-08-01' }),
      trip({ id: 3, status: 'IDEA', end_date: '2026-09-01' }),
      trip({ id: 4, status: 'PLANNED', end_date: '2025-01-01' }),
    ];
    expect(activeTripsSummary(trips, today)).toEqual({ count: 2, text: '1 bestätigt · 1 in Planung' });
    expect(dueLabel('2026-03-01', today)).toEqual({ text: 'Heute', urgent: true });
    expect(dueLabel('2026-02-27', today)).toEqual({ text: 'Überfällig', urgent: true });
    expect(dueLabel('2026-03-12', today)).toEqual({ text: '12. März', urgent: false });
    expect(shortWhen('2026-03-12', '18:00:00')).toBe('12. März, 18:00');
  });
});
