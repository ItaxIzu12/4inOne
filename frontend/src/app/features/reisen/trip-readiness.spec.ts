import { buildTripReadiness, ReadinessInput } from './trip-readiness';

function input(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    start_date: '2026-11-05',
    end_date: '2026-11-09',
    packing_total: 0,
    packing_packed: 0,
    tasks_total: 0,
    tasks_open: 0,
    budget_amount: null,
    ...overrides,
  };
}

describe('buildTripReadiness', () => {
  it('a new trip (dates only, nothing else) gets a low but non-zero, explainable percentage', () => {
    const readiness = buildTripReadiness(input());

    // Nur die Zeitraum-Säule ist erfüllt (100 %), Packliste/Aufgaben 0 %, kein Budget (ausgeklammert) → 100/3.
    expect(readiness.percent).toBe(33);
    expect(readiness.allDone).toBe(false);
    expect(readiness.items).toEqual([
      { label: 'Reisezeitraum vollständig', state: 'done' },
      { label: 'Noch keine Packliste', state: 'open' },
      { label: 'Noch keine Aufgaben', state: 'open' },
      { label: 'Noch offene Vorbereitung', state: 'open' },
    ]);
  });

  it('a fully prepared trip (packed, tasks done, budget set) reaches exactly 100 %', () => {
    const readiness = buildTripReadiness(
      input({ packing_total: 12, packing_packed: 12, tasks_total: 5, tasks_open: 0, budget_amount: '800.00' }),
    );

    expect(readiness.percent).toBe(100);
    expect(readiness.allDone).toBe(true);
    expect(readiness.items).toEqual([
      { label: 'Reisezeitraum vollständig', state: 'done' },
      { label: '12 von 12 Packitems', state: 'done' },
      { label: '5 von 5 Aufgaben', state: 'done' },
      { label: 'Budget festgelegt', state: 'done' },
      { label: 'Alles vorbereitet', state: 'done' },
    ]);
  });

  it('a trip without a budget can still reach 100 % — an unset optional feature is never counted against it', () => {
    const readiness = buildTripReadiness(
      input({ packing_total: 8, packing_packed: 8, tasks_total: 3, tasks_open: 0, budget_amount: null }),
    );

    expect(readiness.percent).toBe(100);
    expect(readiness.allDone).toBe(true);
    expect(readiness.items.some((i) => i.label.includes('Budget'))).toBe(false);
  });

  it('a trip without any packing items shows a clear, non-misleading 0 % for that pillar (not skipped, not 100 %)', () => {
    const readiness = buildTripReadiness(
      input({ packing_total: 0, packing_packed: 0, tasks_total: 4, tasks_open: 1, budget_amount: '500.00' }),
    );

    const packingItem = readiness.items.find((i) => i.label === 'Noch keine Packliste');
    expect(packingItem).toEqual({ label: 'Noch keine Packliste', state: 'open' });
    // Zeitraum 100, Packliste 0, Aufgaben 75 (3 von 4 erledigt), Budget 100 → Schnitt 68.75 → 69.
    expect(readiness.percent).toBe(69);
    expect(readiness.allDone).toBe(false);
  });

  it('a trip without any tasks shows a clear, non-misleading 0 % for that pillar, with a partially packed list alongside', () => {
    const readiness = buildTripReadiness(
      input({ packing_total: 10, packing_packed: 4, tasks_total: 0, tasks_open: 0, budget_amount: null }),
    );

    const tasksItem = readiness.items.find((i) => i.label === 'Noch keine Aufgaben');
    expect(tasksItem).toEqual({ label: 'Noch keine Aufgaben', state: 'open' });
    // Zeitraum 100, Packliste 40, Aufgaben 0, kein Budget (ausgeklammert) → Schnitt 46.67 → 47.
    expect(readiness.percent).toBe(47);
    expect(readiness.items.find((i) => i.label === '4 von 10 Packitems')?.state).toBe('partial');
  });
});
