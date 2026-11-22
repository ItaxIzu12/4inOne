import { OFFLINE_BOARDING_KEY } from '../../../core/offline/offline-keys';
import { BoardingPass } from './boarding-logic';

/**
 * Offline-Kopie der eigenen Bordkarten auf diesem Gerät (wie die Offline-Einkaufsliste): am Gate gibt es oft kein Netz.
 * Gespeichert wird je Reise der zuletzt geladene Stand; vergangene Flüge fallen beim nächsten Speichern heraus, beim
 * Abmelden löscht clearOfflineData() alles.
 */
export interface OfflineBoarding {
  savedAt: string;
  trips: Record<string, { title: string; passes: BoardingPass[] }>;
}

function read(): OfflineBoarding {
  try {
    const raw = localStorage.getItem(OFFLINE_BOARDING_KEY);
    const data = raw ? (JSON.parse(raw) as OfflineBoarding) : null;
    return data && typeof data.trips === 'object' ? data : { savedAt: '', trips: {} };
  } catch {
    return { savedAt: '', trips: {} };
  }
}

/** Noch aktuell: Flug höchstens einen Tag her (oder ohne Datum). */
function current(pass: BoardingPass, today: string): boolean {
  if (!pass.flight_date) return true;
  const d = new Date(`${pass.flight_date}T12:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10) >= today;
}

export function saveOfflinePasses(tripId: number, title: string, passes: BoardingPass[], now = new Date()): void {
  const today = now.toISOString().slice(0, 10);
  const data = read();
  const keep = passes.filter((p) => p.message && current(p, today));
  if (keep.length) data.trips[String(tripId)] = { title, passes: keep };
  else delete data.trips[String(tripId)];
  for (const [id, trip] of Object.entries(data.trips)) {
    trip.passes = trip.passes.filter((p) => current(p, today));
    if (!trip.passes.length) delete data.trips[id];
  }
  try {
    if (Object.keys(data.trips).length) localStorage.setItem(OFFLINE_BOARDING_KEY, JSON.stringify({ savedAt: now.toISOString(), trips: data.trips }));
    else localStorage.removeItem(OFFLINE_BOARDING_KEY);
  } catch {
    /* Speicher voll oder gesperrt: dann eben nur online */
  }
}

/** Alle gespeicherten Bordkarten, nach Flugdatum. */
export function offlinePasses(now = new Date()): { title: string; pass: BoardingPass }[] {
  const today = now.toISOString().slice(0, 10);
  return Object.values(read().trips)
    .flatMap((t) => t.passes.filter((p) => current(p, today)).map((pass) => ({ title: t.title, pass })))
    .sort((a, b) => (a.pass.flight_date ?? '9').localeCompare(b.pass.flight_date ?? '9'));
}
