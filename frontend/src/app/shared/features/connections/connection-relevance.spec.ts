import { describe, expect, it } from 'vitest';
import { RelevanceFacts, fits, sharesWord, words } from './connection-relevance';

/** Dieselben Fälle wie backend/connections/tests/test_connections.py (Auswahl nach Sinn) und test_relevance.py. */
const trip: RelevanceFacts = { type: 'TRIP', text: 'Berlin Wochenende Berlin, Deutschland', day: null, start: '2026-11-25', end: '2026-11-27' };
const goal = (text: string, day: string | null = null): RelevanceFacts => ({ type: 'SAVINGS_GOAL', text, day });

describe('connection-relevance (wie backend/connections/relevance.py)', () => {
  it('Wörter: gefaltet, ohne Füllwörter („Wochenende“, „Reise“ zählen nicht)', () => {
    expect([...words('Berlin Wochenende', 3)]).toEqual(['berlin']);
    expect([...words('Größe ändern', 3)]).toEqual(['groesse', 'aendern']);
    expect(sharesWord('Berlin', 'Berliner Mauer')).toBe(true); // Wortanfang ab 5 Buchstaben
    expect(sharesWord('Rom', 'Romantik')).toBe(false); // zu kurz für Wortanfang
  });

  it('Reise ↔ Sparziel: Stichwort, Reisebezug oder Zieldatum bis 6 Monate vorher – nicht „Badmintonschuhe“', () => {
    expect(fits(trip, goal('Badmintonschuhe'))).toBe(false);
    expect(fits(trip, goal('Reisekasse Berlin'))).toBe(true);
    expect(fits(trip, goal('Urlaubskasse'))).toBe(true);
    expect(fits(trip, goal('Notgroschen', '2026-10-01'))).toBe(true); // Zieldatum kurz vor der Reise
    expect(fits(trip, goal('Wohnung', '2029-01-01'))).toBe(false);
  });

  it('Reise ↔ Termin: während der Reise (±1 Tag); Reise ↔ Aufgabe: Reisewort oder bis 30 Tage vorher fällig', () => {
    expect(fits(trip, { type: 'CALENDAR_EVENT', text: 'Museumsinsel-Führung', day: '2026-11-26' })).toBe(true);
    expect(fits(trip, { type: 'CALENDAR_EVENT', text: 'Zahnarzt', day: '2027-01-10' })).toBe(false);
    expect(fits(trip, { type: 'TASK', text: 'Bahn-Tickets ausdrucken', day: null })).toBe(true);
    expect(fits(trip, { type: 'TASK', text: 'Steuer machen', day: '2026-11-10' })).toBe(true);
    expect(fits(trip, { type: 'TASK', text: 'Steuer machen', day: '2027-03-01' })).toBe(false);
  });

  it('Reise ↔ Haushaltsaufgabe: wiederkehrend oder in der Reisezeit fällig; Reihenfolge der Seiten egal', () => {
    expect(fits(trip, { type: 'HOUSEHOLD_TASK', text: 'Pflanzen gießen', day: null, recurring: true })).toBe(true);
    expect(fits({ type: 'HOUSEHOLD_TASK', text: 'Keller aufräumen', day: '2027-02-01' }, trip)).toBe(false);
  });

  it('Vertrag ↔ Aufgabe, Gerät ↔ Sparziel, Aufgabe ↔ Termin', () => {
    const contract: RelevanceFacts = { type: 'CONTRACT', text: 'Internet & Telefon Telekom', day: null };
    expect(fits(contract, { type: 'TASK', text: 'Telekom Hotline anrufen', day: null })).toBe(true);
    expect(fits(contract, { type: 'TASK', text: 'Tarif wechseln', day: null })).toBe(true); // Vertragswort (nur als ganzes Wort, wie im Backend)
    expect(fits(contract, { type: 'TASK', text: 'Geschenk kaufen', day: null })).toBe(false);
    expect(fits({ type: 'DEVICE', text: 'Waschmaschine Miele', day: null }, goal('Neue Waschmaschine'))).toBe(true);
    expect(fits({ type: 'TASK', text: 'Arzttermin vorbereiten', day: '2026-11-20' }, { type: 'CALENDAR_EVENT', text: 'Zahnarzt', day: '2026-11-20' })).toBe(true);
  });

  it('neue Paare (14.11.2026): Gerät ↔ (Haushalts-)Aufgabe, Reise ↔ Vertrag', () => {
    const washer: RelevanceFacts = { type: 'DEVICE', text: 'Waschmaschine Bosch', day: null };
    expect(fits(washer, { type: 'HOUSEHOLD_TASK', text: 'Flusensieb reinigen', day: null })).toBe(true);
    expect(fits(washer, { type: 'TASK', text: 'Reparatur anfragen', day: null })).toBe(true);
    expect(fits(washer, { type: 'TASK', text: 'Geschenk kaufen', day: null })).toBe(false);
    expect(fits(trip, { type: 'CONTRACT', text: 'Auslandskrankenversicherung HUK', day: null })).toBe(true);
    expect(fits({ type: 'CONTRACT', text: 'Strom Stadtwerke', day: null }, trip)).toBe(false);
  });

  it('Pflegewörter zählen nicht, wenn die Aufgabe ein anderes Gerät nennt', () => {
    const washer: RelevanceFacts = { type: 'DEVICE', text: 'Waschmaschine Bosch', day: null };
    const fridgeTask: RelevanceFacts = { type: 'HOUSEHOLD_TASK', text: 'Kühlschrank reinigen', day: null };
    expect(fits(washer, fridgeTask, ['Kühlschrank', 'Heizung'])).toBe(false);
    expect(fits({ type: 'DEVICE', text: 'Kühlschrank Samsung', day: null }, fridgeTask, ['Waschmaschine'])).toBe(true);
    expect(fits(washer, { type: 'HOUSEHOLD_TASK', text: 'Flusensieb reinigen', day: null }, ['Kühlschrank'])).toBe(true);
  });
});
