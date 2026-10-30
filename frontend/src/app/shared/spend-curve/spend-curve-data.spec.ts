import { daysInMonth, daysLeft, paceAt, spendCurve } from './spend-curve-data';

describe('spendCurve', () => {
  const tx = [
    { type: 'EXPENSE' as const, amount: '100.00', date: '2026-10-01' },
    { type: 'EXPENSE' as const, amount: '-50.00', date: '2026-10-03' }, // Vorzeichen spielt keine Rolle
    { type: 'INCOME' as const, amount: '3000.00', date: '2026-10-01' }, // Einnahmen zählen nicht
    { type: 'EXPENSE' as const, amount: '999.00', date: '2026-10-20' }, // nach „heute“: noch nicht gezeichnet
    { type: 'EXPENSE' as const, amount: '70.00', date: '2026-09-30' }, // anderer Monat
  ];

  it('sums expenses per day up to today, ignoring income, other months and future days', () => {
    const c = spendCurve(tx, '2026-10', 3100, new Date(2026, 9, 5, 12));
    expect(c.days).toBe(31);
    expect(c.current).toBe(true);
    expect(c.series).toEqual([100, 100, 150, 150, 150]);
    expect(paceAt(c, 31)).toBe(3100);
    expect(paceAt(c, 5)).toBe(500);
    expect(daysLeft(c, new Date(2026, 9, 5, 12))).toBe(27);
  });

  it('draws a past month completely and a future month not at all; no budget means no pace line', () => {
    expect(spendCurve(tx, '2026-10', null, new Date(2026, 10, 2)).series).toHaveLength(31);
    expect(spendCurve(tx, '2026-12', null, new Date(2026, 10, 2)).series).toHaveLength(0);
    const c = spendCurve(tx, '2026-10', null, new Date(2026, 9, 5));
    expect(paceAt(c, 5)).toBeNull();
    expect(daysInMonth('2028-02')).toBe(29);
  });
});
