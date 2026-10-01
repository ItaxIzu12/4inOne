import { buildTripSuggestions, TripSetupInput } from './trip-suggestions';

function input(overrides: Partial<TripSetupInput> = {}): TripSetupInput {
  return {
    start_date: '2026-10-10',
    end_date: '2026-10-12',
    travel_type: '',
    transport_type: '',
    baggage_type: '',
    ...overrides,
  };
}
function titles(list: { title: string }[]): string[] {
  return list.map((i) => i.title);
}

describe('buildTripSuggestions', () => {
  it('a minimal trip (only destination/dates) still gets the full baseline packing list across all categories and one task', () => {
    const { packing, tasks } = buildTripSuggestions(input());
    expect(titles(packing)).toEqual(
      expect.arrayContaining(['Reisepass / Ausweis', 'Unterwäsche', 'Smartphone', 'Zahnbürste', 'Persönliche Medikamente', 'Trinkflasche']),
    );
    expect(packing.map((i) => i.category)).toEqual(
      expect.arrayContaining(['DOKUMENTE', 'KLEIDUNG', 'TECHNIK', 'HYGIENE', 'GESUNDHEIT', 'SONSTIGES']),
    );
    expect(titles(tasks)).toEqual([
      'Unterkunft prüfen',
      'Check-in durchführen',
      'Reiseunterlagen herunterladen',
      'Zahlungsmöglichkeiten prüfen',
      'Roaming / eSIM prüfen',
      'Offline-Unterlagen speichern',
      'Koffer packen',
      'Wohnung vorbereiten',
    ]);
    // "Koffer packen": 1–2 Tage vorher; "Dokumente"/Reiseunterlagen: 7–14 Tage vorher (siehe Aufgabenstellung).
    expect(tasks.find((t) => t.title === 'Koffer packen')?.due_date).toBe('2026-10-09');
    expect(tasks.find((t) => t.title === 'Reiseunterlagen herunterladen')?.due_date).toBe('2026-09-30');
    expect(tasks.find((t) => t.title === 'Unterkunft prüfen')?.due_date).toBeNull();
  });

  it('a flight adds an online check-in (1–2 days before departure) and a baggage-rules task', () => {
    const { tasks } = buildTripSuggestions(input({ transport_type: 'FLIGHT' }));
    expect(titles(tasks)).toEqual(expect.arrayContaining(['Online-Check-in durchführen', 'Gepäckbestimmungen prüfen']));
    expect(tasks.find((t) => t.title === 'Online-Check-in durchführen')?.due_date).toBe('2026-10-08');
  });

  it('a train trip adds ticket and seat-reservation tasks, not flight tasks', () => {
    const { tasks } = buildTripSuggestions(input({ transport_type: 'TRAIN' }));
    expect(titles(tasks)).toEqual(expect.arrayContaining(['Ticket speichern', 'Sitzplatz prüfen']));
    expect(titles(tasks)).not.toContain('Online-Check-in durchführen');
  });

  it('a business trip packs work equipment, charger and business documents', () => {
    const { packing } = buildTripSuggestions(input({ travel_type: 'BUSINESS' }));
    expect(titles(packing)).toEqual(
      expect.arrayContaining(['Arbeitsgerät', 'Ladekabel für Arbeitsgerät', 'Business-Unterlagen']),
    );
  });

  it('a city trip with no other info stays at the baseline (no extra packing/tasks invented)', () => {
    const baseline = buildTripSuggestions(input());
    const cityTrip = buildTripSuggestions(input({ travel_type: 'CITY_TRIP' }));
    expect(titles(cityTrip.packing)).toEqual(titles(baseline.packing));
    expect(titles(cityTrip.tasks)).toEqual(titles(baseline.tasks));
  });

  it('hand-luggage-only trims the bulky extras but keeps a compact-packing reminder task', () => {
    const { packing, tasks } = buildTripSuggestions(input({ travel_type: 'BEACH', baggage_type: 'HAND_LUGGAGE' }));
    expect(titles(packing)).not.toContain('Badebekleidung');
    expect(titles(packing)).not.toContain('Sonnencreme');
    expect(titles(tasks)).toContain('Handgepäck-Maße und Flüssigkeitsregel prüfen');
  });

  it('business packing stays even with hand luggage only (work gear is not "bulky")', () => {
    const { packing } = buildTripSuggestions(input({ travel_type: 'BUSINESS', baggage_type: 'HAND_LUGGAGE' }));
    expect(titles(packing)).toEqual(expect.arrayContaining(['Arbeitsgerät', 'Business-Unterlagen']));
  });

  it('checked baggage suggests a luggage tag', () => {
    const { packing } = buildTripSuggestions(input({ baggage_type: 'CHECKED_BAGGAGE' }));
    expect(titles(packing)).toContain('Kofferanhänger');
  });

  it('a road trip suggests planning the route and snacks, unless hand-luggage-only', () => {
    const withSnacks = buildTripSuggestions(input({ travel_type: 'ROAD_TRIP' }));
    expect(titles(withSnacks.packing)).toContain('Snacks für die Fahrt');
    expect(titles(withSnacks.tasks)).toContain('Route planen');

    const compact = buildTripSuggestions(input({ travel_type: 'ROAD_TRIP', baggage_type: 'HAND_LUGGAGE' }));
    expect(titles(compact.packing)).not.toContain('Snacks für die Fahrt');
    expect(titles(compact.tasks)).toContain('Route planen');
  });

  it('never returns duplicate titles even if several rules would add the same item', () => {
    const { packing } = buildTripSuggestions(input({ travel_type: 'BUSINESS', transport_type: 'CAR' }));
    const seen = new Set<string>();
    for (const item of packing) {
      expect(seen.has(item.title)).toBe(false);
      seen.add(item.title);
    }
  });
});
