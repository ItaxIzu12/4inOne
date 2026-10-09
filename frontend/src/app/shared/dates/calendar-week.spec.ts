import { describe, expect, it } from 'vitest';
import { calendarWeek, isInCalendarWeek, weekRangeLabel, weekdayIndex } from './calendar-week';

describe('calendar week (de-DE)', () => {
  it('runs from Monday to Sunday', () => {
    expect(calendarWeek('2026-10-05')).toEqual({ start: '2026-10-05', end: '2026-10-11', week: 41, year: 2026 }); // Montag
    expect(calendarWeek('2026-10-11').start).toBe('2026-10-05'); // Sonntag gehört zur selben Woche
    expect(calendarWeek('2026-10-12').start).toBe('2026-10-12'); // nächster Montag beginnt die nächste
    expect(weekdayIndex('2026-10-05')).toBe(0);
    expect(weekdayIndex('2026-10-11')).toBe(6);
  });

  it('numbers weeks after ISO 8601, also across the turn of the year', () => {
    expect(calendarWeek('2027-01-01')).toMatchObject({ week: 53, year: 2026, start: '2026-12-28' });
    expect(calendarWeek('2021-01-03')).toMatchObject({ week: 53, year: 2020 });
    expect(calendarWeek('2024-12-30')).toMatchObject({ week: 1, year: 2025 });
    expect(calendarWeek('2026-01-01')).toMatchObject({ week: 1, year: 2026 });
  });

  it('labels the range and answers "same week?" consistently', () => {
    expect(weekRangeLabel('2026-10-06')).toBe('05.10.2026 – 11.10.2026');
    expect(isInCalendarWeek('2026-10-11', '2026-10-06')).toBe(true);
    expect(isInCalendarWeek('2026-10-12', '2026-10-06')).toBe(false);
    expect(isInCalendarWeek('2026-10-04', '2026-10-06')).toBe(false);
  });
});
