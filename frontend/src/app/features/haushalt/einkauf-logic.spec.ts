import { ShoppingItemDto } from './haushalt-api.service';
import { SECTIONS } from './haushalt-logic';
import { ago, editedLabel, groupItems, recentItems, splitQuantity } from './einkauf-logic';

const item = (id: number, name: string, section: ShoppingItemDto['section'], checked = false, created = ''): ShoppingItemDto => ({
  id, shopping_list: 1, name, quantity: '', section, is_checked: checked, checked_at: null, checked_by_name: null,
  added_by_name: null, created_at: created,
});

describe('Einkaufslisten: Anzeigeregeln', () => {
  it('splits a free quantity into amount and unit', () => {
    expect(splitQuantity('500 g')).toEqual({ amount: '500', unit: 'g' });
    expect(splitQuantity('1,5 l')).toEqual({ amount: '1,5', unit: 'l' });
    expect(splitQuantity('Bio')).toEqual({ amount: '', unit: 'Bio' });
    expect(splitQuantity('')).toEqual({ amount: '', unit: '' });
  });

  it('keeps checked items in their section and counts them; shopping mode hides them', () => {
    const items = [item(1, 'Äpfel', 'obst_gemuese', true), item(2, 'Bananen', 'obst_gemuese'), item(3, 'Milch', 'kuehlregal', true)];
    const all = groupItems(items, SECTIONS);
    expect(all.map((g) => [g.section.key, g.items.length, g.done, g.total])).toEqual([
      ['obst_gemuese', 2, 1, 2], ['kuehlregal', 1, 1, 1],
    ]);
    const open = groupItems(items, SECTIONS, true);
    expect(open.map((g) => [g.section.key, g.items.map((i) => i.name), g.done, g.total])).toEqual([['obst_gemuese', ['Bananen'], 1, 2]]);
  });

  it('describes times relative to now', () => {
    const now = new Date(2026, 9, 4, 12, 0);
    expect(ago(new Date(2026, 9, 4, 10, 0).toISOString(), now)).toBe('vor 2 Stunden');
    expect(ago(new Date(2026, 9, 3, 11, 0).toISOString(), now)).toBe('vor 1 Tag');
    expect(editedLabel(new Date(2026, 9, 4, 9, 41).toISOString(), now)).toBe('Heute, 09:41');
    expect(editedLabel(new Date(2026, 9, 3, 18, 2).toISOString(), now)).toBe('Gestern, 18:02');
    expect(recentItems([item(1, 'A', 'sonstiges', false, '2026-10-01'), item(2, 'B', 'sonstiges', false, '2026-10-03')]).map((i) => i.name)).toEqual(['B', 'A']);
  });
});
