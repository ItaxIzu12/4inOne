import { describe, expect, it } from 'vitest';
import { FinanceTransaction } from '../data/private-finance-api.service';
import { keyWord, prefillImportCategories, suggestCategory } from './category-suggestion';

let id = 0;
function tx(note: string, category: number, date = '2026-10-01', type: FinanceTransaction['type'] = 'EXPENSE'): FinanceTransaction {
  return { id: ++id, amount: '10.00', type, category, date, note, currency: 'EUR' };
}

describe('category suggestion (F1)', () => {
  const history = [
    tx('REWE', 1, '2026-09-02'),
    tx('rewe', 1, '2026-10-03'),
    tx('REWE Markt GmbH · Kartenzahlung', 1, '2026-10-10'),
    tx('REWE', 4, '2026-08-01'),
    tx('Netflix', 3, '2026-10-05'),
    tx('Gehalt', 6, '2026-10-01', 'INCOME'),
  ];

  it('suggests the most frequent category for the same text, ignoring case', () => {
    expect(suggestCategory('Rewe', 'EXPENSE', history)).toEqual({ category: 1, matches: 2 });
  });

  it('falls back to the key word for bank statement texts', () => {
    expect(suggestCategory('SEPA Lastschrift Netflix International', 'EXPENSE', history)).toEqual({ category: 3, matches: 1 });
    expect(keyWord('PayPal Europe · Spotify AB')).toBe('spotify');
  });

  it('only learns from the same kind and needs at least three characters', () => {
    expect(suggestCategory('Gehalt', 'EXPENSE', history)).toBeNull();
    expect(suggestCategory('Gehalt', 'INCOME', history)?.category).toBe(6);
    expect(suggestCategory('Re', 'EXPENSE', history)).toBeNull();
  });

  it('breaks ties with the most recently used category', () => {
    const tied = [tx('Bäcker', 1, '2026-09-01'), tx('Bäcker', 2, '2026-10-01')];
    expect(suggestCategory('Bäcker', 'EXPENSE', tied)?.category).toBe(2);
  });

  it('never suggests skipped categories and ignores the transaction being edited', () => {
    const own = tx('Kiosk', 9);
    expect(suggestCategory('Kiosk', 'EXPENSE', [own], { skip: new Set([9]) })).toBeNull();
    expect(suggestCategory('Kiosk', 'EXPENSE', [own], { exclude: own.id })).toBeNull();
  });

  it('prefills import rows without a category and keeps the bank category', () => {
    const names: Record<number, string> = { 1: 'Lebensmittel', 3: 'Abos' };
    const rows = prefillImportCategories(
      [
        { note: 'REWE Markt GmbH', type: 'EXPENSE' as const, category: '' },
        { note: 'Netflix', type: 'EXPENSE' as const, category: 'Freizeit' },
        { note: 'Unbekannt', type: 'EXPENSE' as const, category: '' },
      ],
      history,
      (c) => names[c],
    );
    expect(rows.map((r) => r.category)).toEqual(['Lebensmittel', 'Freizeit', '']);
  });
});
