import { IcsFormatError, parseIcs, toInstant } from './org-import';

const wrap = (...events: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Test//DE', ...events, 'END:VCALENDAR'].join('\r\n');

describe('Kalender-Import (ICS)', () => {
  it('reads a Google-style event in UTC with folded description and escaped text', () => {
    const ics = wrap(
      'BEGIN:VEVENT',
      'UID:1@test',
      'DTSTART:20261012T073000Z',
      'DTEND:20261012T080000Z',
      'SUMMARY:Zahnarzt\\, Kontrolle',
      'LOCATION:Praxis Dr. Weber\\; Raum 2',
      'DESCRIPTION:Erste Zeile\\nzweite',
      '  Zeile weiter',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'DESCRIPTION:Erinnerung',
      'END:VALARM',
      'END:VEVENT',
    );
    expect(parseIcs(ics, 'Europe/Berlin')).toEqual({
      rows: [{
        title: 'Zahnarzt, Kontrolle',
        starts_at: '2026-10-12T07:30:00.000Z',
        ends_at: '2026-10-12T08:00:00.000Z',
        all_day: false,
        recurrence: '',
        location: 'Praxis Dr. Weber; Raum 2',
        description: 'Erste Zeile\nzweite Zeile weiter',
      }],
      simplified: 0,
      skipped: 0,
    });
  });

  it('converts TZID wall times, including Outlook zone names and daylight saving', () => {
    expect(toInstant({ params: { TZID: 'Europe/Berlin' }, value: '20261012T093000' }, 'UTC')!.toISOString()).toBe('2026-10-12T07:30:00.000Z');
    expect(toInstant({ params: { TZID: 'W. Europe Standard Time' }, value: '20261212T093000' }, 'UTC')!.toISOString()).toBe('2026-12-12T08:30:00.000Z');
    // Unbekannte Zone: Wanduhrzeit der Person
    expect(toInstant({ params: { TZID: 'Mars/Olympus' }, value: '20261012T093000' }, 'Europe/Berlin')!.toISOString()).toBe('2026-10-12T07:30:00.000Z');
  });

  it('all-day events end on their last day (DTEND is exclusive), duration works for timed events', () => {
    const ics = wrap(
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261020', 'DTEND;VALUE=DATE:20261025', 'SUMMARY:Urlaub', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261103', 'SUMMARY:Geburtstag', 'RRULE:FREQ=YEARLY', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART;TZID=Europe/Berlin:20261012T090000', 'DURATION:PT1H30M', 'SUMMARY:Workshop', 'END:VEVENT',
    );
    const [trip, birthday, workshop] = parseIcs(ics, 'Europe/Berlin').rows;
    expect([trip.all_day, trip.starts_at, trip.ends_at]).toEqual([true, '2026-10-19T22:00:00.000Z', '2026-10-23T22:00:00.000Z']);
    expect([birthday.recurrence, birthday.ends_at]).toEqual(['yearly', birthday.starts_at]);
    expect(workshop.ends_at).toBe('2026-10-12T08:30:00.000Z');
    // Ende am Tag nach der Zeitumstellung (25.10.): letzter Tag ist Mitternacht des 26.10. Winterzeit
    const dst = parseIcs(wrap('BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261024', 'DTEND;VALUE=DATE:20261027', 'SUMMARY:Herbst', 'END:VEVENT'), 'Europe/Berlin').rows[0];
    expect(dst.ends_at).toBe('2026-10-25T23:00:00.000Z');
  });

  it('keeps simple repeats, imports complex ones once and says so, skips cancelled events and exceptions', () => {
    const ics = wrap(
      'BEGIN:VEVENT', 'DTSTART:20261012T070000Z', 'SUMMARY:Daily', 'RRULE:FREQ=DAILY;INTERVAL=1', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART:20261012T070000Z', 'SUMMARY:Bis Dezember', 'RRULE:FREQ=WEEKLY;UNTIL=20261231T000000Z', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART:20261012T070000Z', 'SUMMARY:Alle 2 Wochen', 'RRULE:FREQ=WEEKLY;INTERVAL=2', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART:20261012T070000Z', 'SUMMARY:Abgesagt', 'STATUS:CANCELLED', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART:20261019T070000Z', 'SUMMARY:Daily', 'RECURRENCE-ID:20261019T070000Z', 'END:VEVENT',
    );
    const result = parseIcs(ics, 'UTC');
    expect(result.rows.map((r) => [r.title, r.recurrence])).toEqual([['Daily', 'daily'], ['Bis Dezember', ''], ['Alle 2 Wochen', '']]);
    expect([result.simplified, result.skipped]).toEqual([2, 2]);
  });

  it('rejects files that are not calendars', () => {
    expect(() => parseIcs('Name;Telefon')).toThrow(IcsFormatError);
  });
});
