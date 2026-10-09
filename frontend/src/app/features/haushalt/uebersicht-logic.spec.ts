import { distance, routineIcon } from './uebersicht-logic';

describe('Haushalt-Übersicht: Anzeigeregeln', () => {
  it('picks routine icons from the title, with a neutral fallback', () => {
    expect(routineIcon('Bettwäsche wechseln')).toBe('bed');
    expect(routineIcon('Badezimmer reinigen')).toBe('household');
  });

  it('describes distances the way people say them', () => {
    expect(distance(0)).toBe('heute');
    expect(distance(1)).toBe('morgen');
    expect(distance(6)).toBe('in 6 Tagen');
    expect(distance(14)).toBe('in 2 Wochen');
    expect(distance(90)).toBe('in 3 Monaten');
  });
});
