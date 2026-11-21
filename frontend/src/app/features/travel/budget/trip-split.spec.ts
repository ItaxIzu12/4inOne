import { describe, expect, it } from 'vitest';
import { TripExpense, TripParticipant, TripSettlement } from '../data/travel-api.service';
import { computeBalances, splitEqually, transfersFor } from '../shared/travel-logic';

/** Dieselben Fälle wie backend/reisen/test_split.py – die Demo rechnet wie das Backend. */
const person = (user: number, name: string): TripParticipant =>
  ({ id: user, trip: 1, user, display_name: name, is_self: user === 1, role: 'EDITOR', added_at: '' }) as TripParticipant;
const berlin = { currency: 'EUR', participants: [person(1, 'Sophie'), person(301, 'Max')] } as const;
const expense = (amount: string, paid_by: number | null, shared_with: number[] = [], amount_trip: string | null = amount): TripExpense =>
  ({ id: Math.random(), trip: 1, title: 'x', amount, currency: 'EUR', date: '2026-11-25', amount_trip, paid_by, shared_with }) as TripExpense;

describe('Wer schuldet wem (wie backend reisen/split.py)', () => {
  it('Sophie 200 € Hotel, Max 80 € Bahn → Max schuldet Sophie 60 €', () => {
    const data = computeBalances({ ...berlin, participants: [...berlin.participants] }, [expense('200.00', 1), expense('80.00', 301)], []);
    expect(data.people[0]).toEqual({ user: 1, name: 'Sophie', paid: '200.00', share: '140.00', balance: '60.00' });
    expect(data.people[1].balance).toBe('-60.00');
    expect(data.transfers).toEqual([{ from_user: 301, from_name: 'Max', to_user: 1, to_name: 'Sophie', amount: '60.00' }]);
  });

  it('nur für einen Teil, Cent-Reste reihum nach Nutzer-ID', () => {
    const data = computeBalances({ ...berlin, participants: [...berlin.participants] }, [expense('30.00', 1, [301])], []);
    expect(data.transfers[0].amount).toBe('30.00');
    expect([...splitEqually(1000, [3, 1, 2])]).toEqual([[1, 334], [2, 333], [3, 333]]);
  });

  it('höchstens n − 1 Überweisungen', () => {
    const moves = transfersFor(new Map([[1, 5000], [2, -2000], [3, -2000], [4, -1000]]));
    expect(moves).toHaveLength(3);
    expect(moves.reduce((s, m) => s + m[2], 0)).toBe(5000);
  });

  it('ohne Zahler oder ohne Kurs: zählt nicht mit, wird gezählt', () => {
    const data = computeBalances({ ...berlin, participants: [...berlin.participants] }, [expense('50.00', null), expense('20.00', 1, [], null), expense('40.00', 1, [], '37.00')], []);
    expect(data.unassigned).toBe(2);
    expect(data.people[0].paid).toBe('37.00');
  });

  it('beglichen gleicht aus', () => {
    const settled: TripSettlement = { id: 9, from_user: 301, from_name: 'Max', to_user: 1, to_name: 'Sophie', amount: '60.00', created_at: '' };
    const data = computeBalances({ ...berlin, participants: [...berlin.participants] }, [expense('200.00', 1), expense('80.00', 301)], [settled]);
    expect(data.transfers).toEqual([]);
    expect(data.people.map((p) => p.balance)).toEqual(['0.00', '0.00']);
  });
});
