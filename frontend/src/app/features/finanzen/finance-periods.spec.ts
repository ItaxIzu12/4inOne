import { describe, expect, it } from 'vitest';
import { FinanceTransaction, SavingsContributionDto } from './private-finance-api.service';
import { customRangeError, customRangeHelp, customRangeProblem, dayTitle, exactMonth, reachesFuture, isoWeek, periodTotals, rangeFor, topCategories, weekTitle } from './finance-periods';

const tx = (id: number, date: string, amount: string, type: FinanceTransaction['type'] = 'EXPENSE', category = 1): FinanceTransaction => ({
  id, date, amount, type, category, note: '', currency: 'EUR',
});
const contrib = (id: number, date: string, amount: string): SavingsContributionDto => ({ id, goal: 1, goal_title: 'Japan', amount, date });

describe('finance periods', () => {
  it('uses ISO calendar weeks from Monday to Sunday', () => {
    expect(isoWeek('2026-10-06')).toEqual({ start: '2026-10-05', end: '2026-10-11', week: 41, year: 2026 });
    expect(isoWeek('2026-10-11').week).toBe(41); // Sonntag gehört noch zur selben Woche
    expect(isoWeek('2027-01-01')).toMatchObject({ week: 53, year: 2026 }); // Freitag → letzte Woche 2026
    expect(isoWeek('2026-12-31').start).toBe('2026-12-28');
    expect(weekTitle('2026-10-06')).toBe('05.10.2026 – 11.10.2026');
    expect(weekTitle('2026-09-30')).toBe('28.09.2026 – 04.10.2026');
  });

  it('builds the ranges for day, week, month and a custom period', () => {
    const custom = { from: '2026-09-01', to: '2026-10-06' };
    expect(rangeFor('day', '2026-10-06', custom)).toEqual({ from: '2026-10-06', to: '2026-10-06' });
    expect(rangeFor('week', '2026-10-06', custom)).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    expect(rangeFor('month', '2026-02-10', custom)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(rangeFor('custom', '2026-10-06', custom)).toBe(custom);
  });

  it('checks a custom period: both dates, end not before start, at most a year', () => {
    expect(customRangeProblem({ from: '2026-09-01', to: '2026-10-06' })).toBeNull();
    expect(customRangeProblem({ from: '', to: '2026-10-06' })).toBe('Bitte wähle ein Startdatum.');
    expect(customRangeProblem({ from: '2026-10-06', to: '' })).toBe('Bitte wähle ein Enddatum.');
    expect(customRangeProblem({ from: '2026-10-06', to: '2026-10-01' })).toBe('Das Enddatum liegt vor dem Startdatum.');
    expect(customRangeProblem({ from: '2025-01-01', to: '2026-06-01' })).toBe('Der Zeitraum ist länger als ein Jahr.');
  });

  it('explains why nothing is shown and how to fix it', () => {
    expect(customRangeHelp({ from: '2026-10-07', to: '2026-10-01' })).toBe(
      'Das Enddatum (01.10.2026) liegt vor dem Startdatum (07.10.2026). Wähle ein späteres Enddatum oder tausche die beiden Daten.',
    );
    expect(customRangeHelp({ from: '2025-01-01', to: '2026-06-01' })).toContain('höchstens ein Jahr');
    expect(customRangeHelp({ from: '', to: '' })).toContain('Start- und Enddatum');
  });

  it('sums expenses, income and savings inside the range only — no budget is derived', () => {
    const rows = [
      tx(1, '2026-10-06', '28.30'),
      tx(2, '2026-10-06', '6.50'),
      tx(3, '2026-10-06', '100.00', 'INCOME'),
      tx(4, '2026-10-05', '50.00'),
      { ...tx(5, '2026-10-06', '9.00'), currency: 'USD' },
    ];
    const totals = periodTotals(rows, [contrib(1, '2026-10-06', '20.00'), contrib(2, '2026-10-06', '-5.00'), contrib(3, '2026-10-01', '99')], {
      from: '2026-10-06',
      to: '2026-10-06',
    });
    expect([totals.expenses, totals.income, totals.saved]).toEqual([34.8, 100, 15]);
    expect(totals.rows.map((r) => r.id)).toEqual([3, 2, 1]);
    expect(Object.keys(totals)).not.toContain('budget');
  });

  it('ranks the top expense categories with their share', () => {
    const rows = [tx(1, '2026-10-06', '30', 'EXPENSE', 1), tx(2, '2026-10-06', '10', 'EXPENSE', 2), tx(3, '2026-10-06', '60', 'EXPENSE', 1)];
    const top = topCategories(rows, [{ id: 1, name: 'Lebensmittel', color: '#111' }, { id: 2, name: 'Freizeit', color: '#222' }], '#999');
    expect(top.map((c) => [c.name, c.amount, c.pct])).toEqual([['Lebensmittel', 90, 90], ['Freizeit', 10, 10]]);
  });

  it('names nearby days in words', () => {
    expect(dayTitle('2026-10-06', '2026-10-06')).toBe('Heute');
    expect(dayTitle('2026-10-05', '2026-10-06')).toBe('Gestern');
    expect(dayTitle('2026-10-07', '2026-10-06')).toBe('Morgen');
  });

  it('validates a custom period: both required, Bis >= Von, past and future allowed', () => {
    expect(customRangeError({ from: '', to: '2026-10-06' })?.field).toBe('from');
    expect(customRangeError({ from: '2026-10-01', to: '' })?.field).toBe('to');
    expect(customRangeError({ from: '2026-10-06', to: '2026-10-05' })).toEqual({ field: 'to', message: 'Das Enddatum liegt vor dem Startdatum.' });
    expect(customRangeError({ from: '2026-10-06', to: '2026-10-06' })).toBeNull(); // ein einzelner Tag
    expect(customRangeError({ from: '2019-01-01', to: '2019-03-31' })).toBeNull(); // Vergangenheit
    expect(customRangeError({ from: '2030-01-01', to: '2030-02-01' })).toBeNull(); // Zukunft
    expect(reachesFuture({ from: '2026-10-01', to: '2026-10-31' }, '2026-10-06')).toBe(true);
    expect(reachesFuture({ from: '2026-09-01', to: '2026-10-06' }, '2026-10-06')).toBe(false);
  });

  it('only an exact calendar month has a matching budget', () => {
    expect(exactMonth({ from: '2026-10-01', to: '2026-10-31' })).toBe('2026-10');
    expect(exactMonth({ from: '2026-02-01', to: '2026-02-28' })).toBe('2026-02');
    expect(exactMonth({ from: '2026-10-01', to: '2026-10-30' })).toBeNull();
    expect(exactMonth({ from: '2026-10-02', to: '2026-10-31' })).toBeNull();
    expect(exactMonth({ from: '2026-09-01', to: '2026-10-31' })).toBeNull();
  });
});
