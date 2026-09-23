import { ShoppingItemDto } from './haushalt-api.service';
import {
  SECTIONS,
  addMonthsIso,
  daysUntil,
  estimateAmount,
  groupOpenItems,
  recurrenceLabel,
  relativeDay,
  sliderMax,
} from './haushalt-logic';

function item(id: number, name: string, section: ShoppingItemDto['section'], checked = false): ShoppingItemDto {
  return {
    id,
    name,
    quantity: '',
    section,
    is_checked: checked,
    checked_at: null,
    checked_by_name: null,
    added_by_name: null,
    created_at: '',
  };
}

describe('haushalt-logic', () => {
  it('estimates the shopping amount rounded to 50 cents', () => {
    expect(estimateAmount(3.5, 2)).toBe(7);
    expect(estimateAmount(3.33, 5)).toBe(16.5);
    expect(estimateAmount(3.5, 0)).toBe(0);
  });

  it('keeps the slider range comfortably above the estimate', () => {
    expect(sliderMax(7)).toBe(50);
    expect(sliderMax(64)).toBe(160);
  });

  it('groups open items by shop section in supermarket order, checked ones excluded', () => {
    const groups = groupOpenItems(
      [item(1, 'Spülmittel', 'haushalt'), item(2, 'Milch', 'kuehlregal'), item(3, 'Äpfel', 'obst_gemuese'), item(4, 'Brot', 'backwaren', true)],
      SECTIONS,
    );
    expect(groups.map((g) => g.section.key)).toEqual(['obst_gemuese', 'kuehlregal', 'haushalt']);
  });

  it('keeps a just-checked item in place while it settles', () => {
    const groups = groupOpenItems([item(4, 'Brot', 'backwaren', true)], SECTIONS, new Set([4]));
    expect(groups[0].items[0].name).toBe('Brot');
  });

  it('adds months like the backend, clamped to the end of the month', () => {
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsIso('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonthsIso('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('describes due dates in plain words', () => {
    const today = new Date(2026, 8, 23);
    expect(daysUntil('2026-09-25', today)).toBe(2);
    expect(relativeDay('2026-09-23', today)).toBe('heute');
    expect(relativeDay('2026-09-24', today)).toBe('morgen');
    expect(relativeDay('2026-09-22', today)).toBe('seit gestern überfällig');
    expect(relativeDay('2026-09-20', today)).toBe('seit 3 Tagen überfällig');
    expect(relativeDay('2026-10-30', today)).toBe('am 30.10.2026');
    expect(recurrenceLabel(7)).toBe('wöchentlich');
    expect(recurrenceLabel(null)).toBe('einmalig');
  });
});
