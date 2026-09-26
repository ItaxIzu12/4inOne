import { addDays, defaultDateInMonth, addMonths, daysInMonth, display, parse, toDate, toMonth, weekdayMon0 } from './date-utils';

describe('date-utils', () => {
  it('parses months and dates and rejects invalid ones', () => {
    expect(parse('2026-09')).toEqual({ year: 2026, month0: 8, day: 1 });
    expect(parse('2026-09-25')).toEqual({ year: 2026, month0: 8, day: 25 });
    for (const bad of ['', '2026', '2026-13', '2026-00', '2026-02-30', 'abc', '2026-9-1']) expect(parse(bad)).toBeNull();
    expect(parse('2028-02-29')).not.toBeNull(); // Schaltjahr
    expect(parse('2027-02-29')).toBeNull();
  });

  it('rolls months and days over year boundaries', () => {
    expect(toMonth(2026, 12)).toBe('2027-01');
    expect(toMonth(2026, -1)).toBe('2025-12');
    expect(toDate(2026, 0, 0)).toBe('2025-12-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('clamps the day when moving months (31.01. + 1 month = end of February)', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('knows month lengths and weekdays (Monday = 0)', () => {
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2028, 1)).toBe(29);
    expect(weekdayMon0(2026, 8, 25)).toBe(4); // Freitag, 25.09.2026
    expect(weekdayMon0(2026, 8, 1)).toBe(1); // Dienstag
  });

  it('formats for display in German', () => {
    expect(display('2026-09', 'month')).toBe('September 2026');
    expect(display('2026-09-05', 'date')).toBe('05.09.2026');
    expect(display('', 'month')).toBe('');
    expect(display('nonsense', 'date')).toBe('');
  });

  it('proposes a date inside the chosen month for new entries', () => {
    expect(defaultDateInMonth('2026-09', '2026-09-26')).toBe('2026-09-26'); // laufender Monat: heute
    expect(defaultDateInMonth('2026-10', '2026-09-26')).toBe('2026-10-01'); // Zukunft: Monatsanfang
    expect(defaultDateInMonth('2026-08', '2026-09-26')).toBe('2026-08-31'); // Vergangenheit: Monatsende
    expect(defaultDateInMonth('2028-02', '2029-01-05')).toBe('2028-02-29'); // Schaltjahr
    expect(defaultDateInMonth('kaputt', '2026-09-26')).toBe('2026-09-26');
  });
});
