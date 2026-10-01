import { Trip } from './reisen-api.service';

export type ReadinessState = 'done' | 'partial' | 'open';
export interface ReadinessItem {
  label: string;
  state: ReadinessState;
}
export interface TripReadiness {
  /** 0–100, gerundet auf ganze Prozent — gleichgewichteter Durchschnitt der UNTEN in `items` enthaltenen,
   * bewerteten Säulen (die abschließende Zusammenfassungszeile zählt nicht mit, siehe buildTripReadiness()). */
  percent: number;
  items: ReadinessItem[];
  allDone: boolean;
}

export type ReadinessInput = Pick<
  Trip,
  'start_date' | 'end_date' | 'packing_total' | 'packing_packed' | 'tasks_total' | 'tasks_open' | 'budget_amount'
>;

/**
 * Berechnungsregel für „Reisebereitschaft“ — bewusst einfach und nachvollziehbar, keine erfundene Kennzahl:
 *
 * Vier Säulen, jede 0–100 %, gleich gewichtet gemittelt:
 * 1. Reisezeitraum vollständig (Beginn + Ende gesetzt) — bei einer gespeicherten Reise in V1 immer erfüllt,
 *    da beide Pflichtfelder sind; bleibt trotzdem eine echte Säule, falls das künftig nicht mehr gilt.
 * 2. Packliste: gepackt/gesamt. Keine Packitems → 0 %, nicht übersprungen — das ist ehrlich unfertige
 *    Vorbereitung, kein optionales Feature (gleiche Regel wie die Packlisten-Fortschrittsanzeige selbst).
 * 3. Aufgaben: erledigt/gesamt, analog zur Packliste.
 * 4. Budget: NUR wenn gesetzt, zählt es als 100 % mit. Ist kein Budget hinterlegt, wird die Säule komplett
 *    aus der Mittelung herausgenommen (nicht als 0 % gewertet) — Budget ist laut Anforderung optional und darf
 *    den Nutzer nicht dafür bestrafen, dass er dieses Feature gar nicht nutzen möchte. Eine Reise ohne Budget
 *    kann so trotzdem 100 % erreichen.
 *
 * Die letzte Zeile in `items` ist keine Säule, sondern eine Zusammenfassung ("Alles vorbereitet" / "Noch
 * offene Vorbereitung"), rein informativ und fließt nicht in `percent` ein.
 */
export function buildTripReadiness(trip: ReadinessInput): TripReadiness {
  const pillars: { label: string; percent: number; state: ReadinessState }[] = [];

  const datesComplete = !!trip.start_date && !!trip.end_date;
  pillars.push({ label: 'Reisezeitraum vollständig', percent: datesComplete ? 100 : 0, state: datesComplete ? 'done' : 'open' });

  const packingTotal = trip.packing_total;
  const packingPercent = packingTotal > 0 ? Math.round((trip.packing_packed / packingTotal) * 100) : 0;
  pillars.push({
    label: packingTotal > 0 ? `${trip.packing_packed} von ${packingTotal} Packitems` : 'Noch keine Packliste',
    percent: packingPercent,
    state: packingTotal === 0 ? 'open' : trip.packing_packed === packingTotal ? 'done' : trip.packing_packed > 0 ? 'partial' : 'open',
  });

  const tasksTotal = trip.tasks_total;
  const tasksDone = tasksTotal - trip.tasks_open;
  const tasksPercent = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
  pillars.push({
    label: tasksTotal > 0 ? `${tasksDone} von ${tasksTotal} Aufgaben` : 'Noch keine Aufgaben',
    percent: tasksPercent,
    state: tasksTotal === 0 ? 'open' : tasksDone === tasksTotal ? 'done' : tasksDone > 0 ? 'partial' : 'open',
  });

  const budgetSet = trip.budget_amount != null && trip.budget_amount !== '' && Number(trip.budget_amount) > 0;
  if (budgetSet) {
    pillars.push({ label: 'Budget festgelegt', percent: 100, state: 'done' });
  }

  const percent = Math.round(pillars.reduce((sum, p) => sum + p.percent, 0) / pillars.length);
  const allDone = percent === 100;

  const items: ReadinessItem[] = [
    ...pillars.map(({ label, state }) => ({ label, state })),
    allDone ? { label: 'Alles vorbereitet', state: 'done' as const } : { label: 'Noch offene Vorbereitung', state: 'open' as const },
  ];

  return { percent, items, allDone };
}
