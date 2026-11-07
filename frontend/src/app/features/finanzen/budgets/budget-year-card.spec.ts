import { yearBars, yearLead } from './budget-year-card';
import { FinanceYearMonth, FinanceYearSummary } from '../data/private-finance-api.service';

const m = (n: number, over: Partial<FinanceYearMonth> = {}): FinanceYearMonth => ({
  month: `2026-${String(n).padStart(2, '0')}`, budget: null, expenses: '0.00', saved: '0.00', available: null,
  has_data: false, state: 'past', ...over,
});
const year = (months: FinanceYearMonth[]): FinanceYearSummary => ({ year: '2026', currency: 'EUR', months });

describe('budget year card', () => {
  const data = year([
    m(1),
    m(2, { expenses: '400.00', has_data: true }),
    m(3, { budget: '1000.00', expenses: '800.00', available: '150.00', has_data: true }),
    m(4, { budget: '1000.00', expenses: '1200.00', available: '-200.00', has_data: true }),
    m(5, { budget: '1000.00', available: '1000.00' }),
    m(6, { budget: '1000.00', expenses: '300.00', available: '700.00', has_data: true, state: 'current' }),
    ...[7, 8, 9, 10, 11, 12].map((n) => m(n, { budget: n < 10 ? '1000.00' : null, expenses: null, saved: null, state: 'future' })),
  ]);

  it('gibt jedem Monat den richtigen Zustand und skaliert auf die höchste Säule', () => {
    const bars = yearBars(data);
    expect(bars.map((b) => b.tone)).toEqual(['empty', 'free', 'held', 'over', 'empty', 'current', 'future', 'future', 'future', 'future', 'future', 'future']);
    expect(bars[3]).toMatchObject({ plan: 83, fill: 100, short: 'Apr', letter: 'A' });
    expect(bars[6]).toMatchObject({ plan: 83, fill: 0 });
    expect(bars[11].plan).toBe(0);
    // Überschritten: Betrag in Worten, nicht nur Farbe
    expect(bars[3].label.replace(/\s/g, ' ')).toBe('April 2026, 1.200,00 € ausgegeben, Budget 1.000,00 €, um 200,00 € überschritten');
    expect(bars[0].label).toBe('Januar 2026, keine Buchungen');
  });

  it('zählt nur abgeschlossene Monate mit Budget und Buchungen', () => {
    const lead = yearLead(data);
    expect(lead.amount.replace(/\s/g, ' ')).toBe('2.700 €');
    expect(lead.of.replace(/\s/g, ' ')).toBe('ausgegeben von 7.000 € Jahresbudget');
    expect(lead.verdict).toBe('In 1 von 2 Monaten im Budget geblieben');
    expect(lead.ok).toBe(false);
  });

  it('ein Jahr in der Zukunft zeigt nur, was geplant ist', () => {
    const future = year([1, 2, 3].map((n) => m(n, { budget: '500.00', expenses: null, state: 'future' })).concat(
      [4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => m(n, { expenses: null, state: 'future' }))));
    expect(yearLead(future)).toEqual({ amount: '', of: '3 von 12 Monaten mit Budget geplant', verdict: '', ok: true });
    const none = yearLead(year([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => m(n))));
    expect([none.amount.replace(/\s/g, ' '), none.of, none.ok]).toEqual(['0 €', 'bisher ausgegeben', true]);
    expect(none.verdict).toBe('Noch kein abgeschlossener Monat mit Budget');
  });

  it('stellt Ausgaben UND Sparbeiträge gegen das Budget — wie „Noch verfügbar“', () => {
    const data = year([
      m(1, { budget: '1000.00', expenses: '500.00', saved: '400.00', available: '100.00', has_data: true }),
      ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => m(n, { budget: '1000.00', expenses: null, saved: null, state: 'future' })),
    ]);
    const jan = yearBars(data)[0];
    expect(jan).toMatchObject({ tone: 'held', plan: 100, fill: 50, save: 40 });
    expect(jan.label.replace(/\s/g, ' ')).toBe('Januar 2026, 500,00 € ausgegeben, 400,00 € für Sparziele, Budget 1.000,00 €, im Budget geblieben');
    expect(yearLead(data).of.replace(/\s/g, ' ')).toBe('ausgegeben, dazu 400 € für Sparziele – von 12.000 € Jahresbudget');
  });
});
