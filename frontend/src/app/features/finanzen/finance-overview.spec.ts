import { CATEGORY_ICON_MAP } from '../../shared/icons/category-icon.map';
import { budgetBand, categoryVisual, daysLeftInMonth, groupByDay, shiftMonth, splitAmount } from './finance-overview';
import { FinanceSummary, FinanceTransaction } from './private-finance-api.service';

const summary = (over: Partial<FinanceSummary> = {}): FinanceSummary => ({
  month: '2026-10', currency: 'EUR', budget: '3200.00', total: '3200.00', saved: '600.00', saved_planned: '0.00',
  plan_alert: null, available: '1695.70', income: '2800.00', expenses: '904.30', savings_target: '2150.00',
  savings_current: '600.00', has_data: true, recent: [],
  categories: [
    { id: 1, name: 'Wohnen', color: '#164c49', amount: '850.00' },
    { id: 2, name: 'Lebensmittel', color: '#8a5a23', amount: '54.30' },
  ],
  ...over,
});
const tx = (id: number, date: string, amount: string, type: 'INCOME' | 'EXPENSE' = 'EXPENSE'): FinanceTransaction =>
  ({ id, date, amount, type, category: 1, note: '', currency: 'EUR' }) as FinanceTransaction;

describe('finance overview helpers', () => {
  it('counts the days left in the selected month, today included', () => {
    const today = new Date(2026, 9, 5);
    expect(daysLeftInMonth('2026-10', today)).toBe(27);
    expect(daysLeftInMonth('2026-09', today)).toBe(0);
    expect(daysLeftInMonth('2026-11', today)).toBe(30);
    expect(daysLeftInMonth('2026-10', new Date(2026, 9, 31))).toBe(1);
  });

  it('splits a formatted amount so the cents can be set smaller', () => {
    expect(splitAmount('1.695,70 €')).toEqual({ whole: '1.695', rest: ',70 €' });
    expect(splitAmount('−12,40 €')).toEqual({ whole: '−12', rest: ',40 €' });
    expect(splitAmount('—')).toEqual({ whole: '—', rest: '' });
  });

  it('builds the budget band in category colors, then savings, then what is free', () => {
    const band = budgetBand(summary());
    expect(band.map((s) => s.label)).toEqual(['Wohnen', 'Lebensmittel', 'Sparziele', 'Frei']);
    expect(band[0].color).toBe('#164c49');
    expect(band.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(100);
    expect(band[3].amount).toBeCloseTo(1695.7);
  });

  it('never runs past 100 % when the budget is exceeded, and has no free part then', () => {
    const band = budgetBand(summary({ total: '500.00', saved: '0.00', available: '-404.30' }));
    expect(band.map((s) => s.kind)).toEqual(['category', 'category']);
    expect(band.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(100);
  });

  it('shows no band without a monthly budget', () => {
    expect(budgetBand(summary({ total: null, budget: null, available: null }))).toEqual([]);
    expect(budgetBand(null)).toEqual([]);
  });

  it('groups bookings by day with the day balance, keeping their order', () => {
    const groups = groupByDay([tx(1, '2026-10-05', '54.30'), tx(2, '2026-10-05', '10.00'), tx(3, '2026-10-01', '2800.00', 'INCOME')]);
    expect(groups.map((g) => g.date)).toEqual(['2026-10-05', '2026-10-01']);
    expect(groups[0].rows.map((r) => r.id)).toEqual([1, 2]);
    expect(groups[0].total).toBeCloseTo(-64.3);
    expect(groups[1].total).toBe(2800);
    expect(groups[0].label).toBe('Montag, 5. Oktober');
  });

  it('shifts months across year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-10', 0)).toBe('2026-10');
  });

  it('finds an icon from the existing icon system for known categories and falls back otherwise', () => {
    expect(categoryVisual('Lebensmittel')).toEqual({ app: 'basket' });
    expect(categoryVisual('Wohnen')).toEqual({ component: CATEGORY_ICON_MAP['fixkosten'] });
    expect(categoryVisual('  REISEN ')).toEqual({ app: 'travel' });
    expect(categoryVisual('Haustier')).toEqual({ component: CATEGORY_ICON_MAP['sonstiges'] });
  });
});
