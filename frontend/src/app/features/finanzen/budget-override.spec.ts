import { describe, expect, it } from 'vitest';
import { FinanceBudget, budgetOverride } from './private-finance-api.service';

const b = (id: number, month: string, end: string | null, amount = '3500.00', open = false): FinanceBudget =>
  ({ id, month: `${month}-01`, end_month: end ? `${end}-01` : null, open_ended: open, amount, currency: 'EUR' }) as FinanceBudget;

describe('budgetOverride', () => {
  it('meldet nichts, wenn kein späteres Budget im Zeitraum beginnt', () => {
    expect(budgetOverride({ start: '2026-03', end: '', open: true }, [])).toBeNull();
    expect(budgetOverride({ start: '2026-03', end: '2026-07', open: false }, [b(1, '2026-08', null, '1', true)])).toBeNull();
    expect(budgetOverride({ start: '2026-08', end: '', open: true }, [b(1, '2026-03', null, '1', true)])).toBeNull(); // früheres zählt nicht
  });

  it('bis auf Weiteres: ab dem Start des späteren Budgets, offen', () => {
    expect(budgetOverride({ start: '2026-03', end: '', open: true }, [b(1, '2026-08', '2026-08')])).toEqual({ from: '2026-08', to: '2026-08', amount: '3500.00' });
    expect(budgetOverride({ start: '2026-03', end: '', open: true }, [b(1, '2026-08', null, '3500.00', true)])).toEqual({ from: '2026-08', to: null, amount: '3500.00' });
  });

  it('bis Monat: nur der überschnittene Teil des Zeitraums', () => {
    expect(budgetOverride({ start: '2026-03', end: '2026-10', open: false }, [b(1, '2026-08', '2027-02')])).toEqual({ from: '2026-08', to: '2026-10', amount: '3500.00' });
    expect(budgetOverride({ start: '2026-03', end: '2026-10', open: false }, [b(1, '2026-11', '2027-02')])).toBeNull();
  });

  it('über den Jahreswechsel', () => {
    expect(budgetOverride({ start: '2026-11', end: '2027-03', open: false }, [b(1, '2026-12', '2027-01')])).toEqual({ from: '2026-12', to: '2027-01', amount: '3500.00' });
  });
});
