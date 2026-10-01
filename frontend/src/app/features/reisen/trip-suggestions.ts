import { PackingCategory, Trip } from './reisen-api.service';

export interface SuggestedPackingItem {
  title: string;
  quantity: number;
  category: PackingCategory;
}
export interface SuggestedTask {
  title: string;
  due_date: string | null;
}
export interface TripSuggestions {
  packing: SuggestedPackingItem[];
  tasks: SuggestedTask[];
}

export type TripSetupInput = Pick<Trip, 'start_date' | 'end_date' | 'travel_type' | 'transport_type' | 'baggage_type'>;

function daysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00`);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dedupe<T extends { title: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.toLocaleLowerCase('de');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function item(title: string, category: PackingCategory, quantity = 1): SuggestedPackingItem {
  return { title, category, quantity };
}

/** Die Standard-Packliste, die jede Reise unabhängig von Transportart/Reisetyp/Gepäck bekommt. */
function baselinePacking(): SuggestedPackingItem[] {
  return [
    item('Reisepass / Ausweis', 'DOKUMENTE'),
    item('Tickets', 'DOKUMENTE'),
    item('Buchungsbestätigungen', 'DOKUMENTE'),
    item('Versicherung', 'DOKUMENTE'),
    item('Unterwäsche', 'KLEIDUNG'),
    item('Socken', 'KLEIDUNG'),
    item('Oberteile', 'KLEIDUNG'),
    item('Hose', 'KLEIDUNG'),
    item('Jacke', 'KLEIDUNG'),
    item('Schlafkleidung', 'KLEIDUNG'),
    item('Smartphone', 'TECHNIK'),
    item('Ladekabel', 'TECHNIK'),
    item('Powerbank', 'TECHNIK'),
    item('Kopfhörer', 'TECHNIK'),
    item('Zahnbürste', 'HYGIENE'),
    item('Zahnpasta', 'HYGIENE'),
    item('Deo', 'HYGIENE'),
    item('Persönliche Medikamente', 'GESUNDHEIT'),
    item('Pflaster', 'GESUNDHEIT'),
    item('Trinkflasche', 'SONSTIGES'),
    item('Sonnenbrille', 'SONSTIGES'),
  ];
}

/** Die Standard-Reiseaufgaben, unabhängig von Transportart/Reisetyp/Gepäck. Fälligkeiten nur dort gesetzt, wo sich
 * ein plausibler, nicht anbieterspezifischer Vorlauf angeben lässt (siehe Aufgabenstellung: "Keine
 * Airline-spezifischen Annahmen treffen") — alles andere bleibt ohne Datum, der Nutzer trägt es selbst ein. */
function baselineTasks(startDate: string): SuggestedTask[] {
  return [
    { title: 'Unterkunft prüfen', due_date: null },
    { title: 'Check-in durchführen', due_date: null },
    { title: 'Reiseunterlagen herunterladen', due_date: daysBefore(startDate, 10) },
    { title: 'Zahlungsmöglichkeiten prüfen', due_date: null },
    { title: 'Roaming / eSIM prüfen', due_date: null },
    { title: 'Offline-Unterlagen speichern', due_date: null },
    { title: 'Koffer packen', due_date: daysBefore(startDate, 1) },
    { title: 'Wohnung vorbereiten', due_date: null },
  ];
}

function addTransportSuggestions(
  transport: Trip['transport_type'],
  startDate: string,
  packing: SuggestedPackingItem[],
  tasks: SuggestedTask[],
): void {
  switch (transport) {
    case 'FLIGHT':
      // Online-Check-in öffnet bei so gut wie jeder Airline 24–48h vorher — das ist eine branchenübliche
      // Zeitspanne, keine Annahme über eine bestimmte Airline.
      tasks.push(
        { title: 'Online-Check-in durchführen', due_date: daysBefore(startDate, 2) },
        { title: 'Gepäckbestimmungen prüfen', due_date: null },
      );
      break;
    case 'TRAIN':
      tasks.push({ title: 'Ticket speichern', due_date: null }, { title: 'Sitzplatz prüfen', due_date: null });
      break;
    case 'CAR':
      tasks.push({ title: 'Fahrzeug checken (Reifen, Öl, Papiere)', due_date: null });
      packing.push(item('Fahrzeugpapiere', 'DOKUMENTE'));
      break;
    case 'BUS':
      tasks.push({ title: 'Busfahrschein bereitlegen', due_date: null });
      break;
  }
}

/** `compact` = nur Handgepäck: zusätzliche, eher sperrige Freizeitausstattung (Strand/Aktiv/Roadtrip-Snacks)
 * entfällt dann, damit die Packliste wirklich kleiner bleibt statt nur mehr Einträge zu bekommen. Die
 * Standardliste (baselinePacking) bleibt davon unberührt — dafür gibt die Aufgabenstellung keine Regel vor. */
function addTravelTypeSuggestions(
  travelType: Trip['travel_type'],
  packing: SuggestedPackingItem[],
  tasks: SuggestedTask[],
  compact: boolean,
): void {
  switch (travelType) {
    case 'BEACH':
      if (!compact) packing.push(item('Badebekleidung', 'KLEIDUNG'), item('Sonnencreme', 'GESUNDHEIT'));
      break;
    case 'ACTIVE':
      if (!compact) packing.push(item('Sportbekleidung', 'KLEIDUNG'), item('Wanderschuhe', 'KLEIDUNG'));
      break;
    case 'ROAD_TRIP':
      if (!compact) packing.push(item('Snacks für die Fahrt', 'SONSTIGES'));
      tasks.push({ title: 'Route planen', due_date: null });
      break;
    case 'BUSINESS':
      // Bewusst nicht auf !compact beschränkt: Arbeitsgerät ist gerade bei Handgepäck-only-Geschäftsreisen typisch.
      packing.push(item('Arbeitsgerät', 'TECHNIK'), item('Ladekabel für Arbeitsgerät', 'TECHNIK'), item('Business-Unterlagen', 'DOKUMENTE'));
      break;
    case 'FAMILY':
      tasks.push({ title: 'Unterlagen für Kinder prüfen (Ausweis/Impfpass)', due_date: null });
      break;
  }
}

function addBaggageSuggestions(baggage: Trip['baggage_type'], packing: SuggestedPackingItem[], tasks: SuggestedTask[]): void {
  if (baggage === 'HAND_LUGGAGE') tasks.push({ title: 'Handgepäck-Maße und Flüssigkeitsregel prüfen', due_date: null });
  else if (baggage === 'CHECKED_BAGGAGE') packing.push(item('Kofferanhänger', 'SONSTIGES'));
}

/**
 * Deterministische Startvorschläge für eine neu angelegte Reise (Smart Setup) — keine KI, nur feste Regeln je
 * Transportart/Reisetyp/Gepäck, dazu Standard-Packliste und Standard-Aufgaben. Funktioniert auch, wenn nur
 * Ziel/Start-/Enddatum angegeben wurden: die Standardlisten gelten immer, alles andere kommt nur dazu, wenn die
 * jeweilige Information vorhanden ist.
 *
 * "International" (z. B. Einreisebestimmungen/Reisepass prüfen) ist bewusst NICHT als eigene Regel umgesetzt:
 * destination ist nur Freitext, es gibt kein Land/Herkunftsland-Feld, aus dem sich das zuverlässig deterministisch
 * ableiten ließe.
 */
export function buildTripSuggestions(input: TripSetupInput): TripSuggestions {
  const compact = input.baggage_type === 'HAND_LUGGAGE';
  const packing: SuggestedPackingItem[] = baselinePacking();
  const tasks: SuggestedTask[] = baselineTasks(input.start_date);

  addTransportSuggestions(input.transport_type, input.start_date, packing, tasks);
  addTravelTypeSuggestions(input.travel_type, packing, tasks, compact);
  addBaggageSuggestions(input.baggage_type, packing, tasks);

  return { packing: dedupe(packing), tasks: dedupe(tasks) };
}
