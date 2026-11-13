import { IconName } from '../../shared/icons/app-icon';
import { BudgetCategory, PackingCategory, PackingItem, Trip, TripBudgetCategory, TripEvent, TripEventKind, TripExpense, TripTask, TripStatus } from './reisen-api.service';
import { formatAmount } from '../../shared/currency/currencies';
import { parseMoneyInput } from '../../shared/currency/money-input';

// ---------- Status ----------
export const STATUS_ORDER: TripStatus[] = ['PLANNED', 'CONFIRMED', 'DONE', 'CANCELLED'];
export const STATUS_LABELS: Record<TripStatus, string> = {
  PLANNED: 'In Planung',
  CONFIRMED: 'Bestätigt',
  DONE: 'Abgeschlossen',
  CANCELLED: 'Abgesagt',
};
/** Farbton der Status-Pille (siehe trip-common.scss .status--*). */
export const STATUS_TONE: Record<TripStatus, 'green' | 'blue' | 'gray' | 'red'> = {
  PLANNED: 'blue',
  CONFIRMED: 'green',
  DONE: 'gray',
  CANCELLED: 'red',
};

// ---------- Datum ----------
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function noon(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00`);
}
export function addDays(iso: string, days: number): string {
  const d = noon(iso);
  d.setDate(d.getDate() + days);
  return localDay(d);
}
/** „14. März 2025“ */
export function longDate(iso: string): string {
  return noon(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}
/** „14. März 2025 – 16. März 2025“ */
export function dateRange(trip: Pick<Trip, 'start_date' | 'end_date'>): string {
  return `${longDate(trip.start_date)} – ${longDate(trip.end_date)}`;
}
/** Reisetage inklusive An- und Abreisetag. */
export function tripDays(trip: Pick<Trip, 'start_date' | 'end_date'>): number {
  return Math.round((noon(trip.end_date).getTime() - noon(trip.start_date).getTime()) / 86_400_000) + 1;
}
export function nights(trip: Pick<Trip, 'start_date' | 'end_date'>): number {
  return Math.max(0, tripDays(trip) - 1);
}
export function daysUntil(iso: string, today: string): number {
  return Math.round((noon(iso).getTime() - noon(today).getTime()) / 86_400_000);
}
/** „in 12 Tagen“, „morgen“, „heute“ — null, wenn die Reise schon begonnen hat. */
export function countdown(trip: Pick<Trip, 'start_date'>, today: string): string | null {
  const days = daysUntil(trip.start_date, today);
  if (days < 0) return null;
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  return `in ${days} Tagen`;
}
const MONTHS_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
/** Für den Kopf einer Reise: „12.–15. November 2026“, „30. November – 2. Dezember 2026“. */
export function longRange(trip: Pick<Trip, 'start_date' | 'end_date'>): string {
  return rangeWith(trip, MONTHS_LONG);
}
const MONTHS_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
/** Kompakt für Karten: „12.–15. Nov. 2026“, „30. Nov. – 2. Dez. 2026“, „30. Dez. 2026 – 2. Jan. 2027“. */
export function shortRange(trip: Pick<Trip, 'start_date' | 'end_date'>): string {
  return rangeWith(trip, MONTHS_SHORT);
}
function rangeWith(trip: Pick<Trip, 'start_date' | 'end_date'>, months: string[]): string {
  const [sy, sm, sd] = trip.start_date.split('-').map(Number);
  const [ey, em, ed] = trip.end_date.split('-').map(Number);
  if (sy === ey && sm === em) return sd === ed ? `${sd}. ${months[sm - 1]} ${sy}` : `${sd}.–${ed}. ${months[em - 1]} ${ey}`;
  if (sy === ey) return `${sd}. ${months[sm - 1]} – ${ed}. ${months[em - 1]} ${ey}`;
  return `${sd}. ${months[sm - 1]} ${sy} – ${ed}. ${months[em - 1]} ${ey}`;
}

// ---------- Phase einer Reise ----------
/** Wo eine Reise zeitlich steht — „unterwegs“ ergibt sich aus dem Zeitraum, nicht aus einem Status. */
export type TripPhase = 'upcoming' | 'ongoing' | 'past' | 'cancelled';
export function tripPhase(trip: Pick<Trip, 'start_date' | 'end_date' | 'status'>, today: string): TripPhase {
  if (trip.status === 'CANCELLED') return 'cancelled';
  if (trip.end_date < today) return 'past';
  return trip.start_date <= today ? 'ongoing' : 'upcoming';
}
/** „In 37 Tagen“, „Morgen“, „Heute geht's los“, „Unterwegs · Tag 2 von 4“, „Vorbei“, „Abgesagt“. */
export function whenText(trip: Pick<Trip, 'start_date' | 'end_date' | 'status'>, today: string): string {
  const phase = tripPhase(trip, today);
  if (phase === 'cancelled') return 'Abgesagt';
  if (phase === 'past') return 'Vorbei';
  if (phase === 'ongoing') return `Unterwegs · Tag ${daysUntil(today, trip.start_date) + 1} von ${tripDays(trip)}`;
  const days = daysUntil(trip.start_date, today);
  return days === 0 ? 'Heute geht’s los' : days === 1 ? 'Morgen' : `In ${days} Tagen`;
}
export interface TripGroups {
  upcoming: Trip[];
  past: Trip[];
  cancelled: Trip[];
}
/** Meine Reisen: bevorstehend (inkl. laufender, früheste zuerst), vergangen (neueste zuerst), abgesagt. */
export function groupTrips(trips: Trip[], today: string): TripGroups {
  const groups: TripGroups = { upcoming: [], past: [], cancelled: [] };
  for (const trip of trips) {
    const phase = tripPhase(trip, today);
    groups[phase === 'ongoing' ? 'upcoming' : phase].push(trip);
  }
  groups.upcoming.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id);
  groups.past.sort((a, b) => b.end_date.localeCompare(a.end_date) || b.id - a.id);
  groups.cancelled.sort((a, b) => b.start_date.localeCompare(a.start_date) || b.id - a.id);
  return groups;
}

// ---------- Personen ----------
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
export function peopleLabel(count: number): string {
  return count === 1 ? '1 Person' : `${count} Personen`;
}

export const TRANSPORT_LABELS: Record<Exclude<Trip['transport_type'], ''>, string> = {
  FLIGHT: 'Flugzeug',
  TRAIN: 'Zug',
  CAR: 'Auto',
  BUS: 'Bus',
  OTHER: 'Sonstiges',
};
export function transportIcon(type: Trip['transport_type']): IconName {
  return type === 'TRAIN' ? 'train' : type === 'BUS' ? 'bus' : type === 'FLIGHT' ? 'travel' : 'car';
}

// ---------- Packliste ----------
export const PACKING_ORDER: PackingCategory[] = ['DOKUMENTE', 'KLEIDUNG', 'TECHNIK', 'HYGIENE', 'GESUNDHEIT', 'UNTERWEGS', 'SONSTIGES'];
export const PACKING_META: Record<PackingCategory, { label: string; icon: IconName }> = {
  DOKUMENTE: { label: 'Wichtige Dokumente', icon: 'file-text' },
  KLEIDUNG: { label: 'Kleidung', icon: 'shirt' },
  TECHNIK: { label: 'Technik', icon: 'smartphone' },
  HYGIENE: { label: 'Hygiene', icon: 'bottle' },
  GESUNDHEIT: { label: 'Gesundheit', icon: 'pill' },
  UNTERWEGS: { label: 'Unterwegs', icon: 'backpack' },
  SONSTIGES: { label: 'Sonstiges', icon: 'package' },
};
export type PackingView = 'all' | 'open' | 'done';
export interface PackingGroup {
  category: PackingCategory;
  label: string;
  icon: IconName;
  packed: number;
  total: number;
  items: PackingItem[];
}
/** Gruppen in fester Reihenfolge; die Zählung gilt immer für die ganze Kategorie, die Liste folgt der Ansicht. */
export function packingGroups(items: PackingItem[], view: PackingView): PackingGroup[] {
  return PACKING_ORDER.map((category) => {
    const all = items.filter((i) => i.category === category);
    const shown = all.filter((i) => (view === 'open' ? !i.is_packed : view === 'done' ? i.is_packed : true));
    return {
      category,
      ...PACKING_META[category],
      packed: all.filter((i) => i.is_packed).length,
      total: all.length,
      items: shown,
    };
  }).filter((g) => g.items.length > 0);
}
export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
// ---------- Budget ----------
export const BUDGET_ORDER: BudgetCategory[] = ['UNTERKUNFT', 'TRANSPORT', 'ESSEN', 'AKTIVITAETEN', 'SHOPPING', 'SONSTIGES', 'RESERVE'];
export const BUDGET_META: Record<BudgetCategory, { label: string; icon: IconName }> = {
  UNTERKUNFT: { label: 'Unterkunft', icon: 'bed' },
  TRANSPORT: { label: 'Transport', icon: 'train' },
  ESSEN: { label: 'Essen', icon: 'utensils' },
  AKTIVITAETEN: { label: 'Aktivitäten', icon: 'ticket' },
  SHOPPING: { label: 'Shopping', icon: 'cart' },
  SONSTIGES: { label: 'Sonstiges', icon: 'more' },
  RESERVE: { label: 'Reserve', icon: 'shield' },
};
export interface BudgetRow {
  category: BudgetCategory;
  label: string;
  icon: IconName;
  planned: number;
  spent: number;
  remaining: number;
  /** ausgegeben in % des geplanten Betrags; ohne Plan 100, sobald etwas ausgegeben ist */
  pct: number;
  over: boolean;
}
/** Nur Kategorien mit Plan oder Ausgabe, in fester Reihenfolge. */
export function budgetRows(planned: TripBudgetCategory[], expenses: TripExpense[], currency: string): BudgetRow[] {
  return BUDGET_ORDER.map((category) => {
    const plan = Number(planned.find((p) => p.category === category)?.planned_amount ?? 0);
    const spent = expenses.filter((e) => (e.category ?? 'SONSTIGES') === category).reduce((s, e) => s + tripValue(e, currency), 0);
    return {
      category,
      ...BUDGET_META[category],
      planned: plan,
      spent,
      remaining: plan - spent,
      pct: plan > 0 ? Math.round((spent / plan) * 100) : spent > 0 ? 100 : 0,
      over: spent > plan && plan > 0,
    };
  }).filter((r) => r.planned > 0 || r.spent > 0);
}
/** Betrag aus Budget-/Ausgaben-Dialog — der gemeinsame Leser (shared/currency/money-input.ts). Leer → 0, ungültig → null. */
export const parseBudgetAmount = parseMoneyInput;
export function totalBudget(trip: Trip | null, planned: TripBudgetCategory[]): number {
  const own = Number(trip?.budget_amount || 0);
  return own > 0 ? own : planned.reduce((s, p) => s + Number(p.planned_amount), 0);
}

// ---------- Geld ----------
/** Geldbetrag (zentraler Formatter in shared/currency): „700 €“, „250.000 ¥“. `compact` lässt „,00“ weg. */
export function formatMoney(value: string | number, currency: string, compact = false): string {
  return formatAmount(value, currency, compact);
}
/** Wert einer Ausgabe in der Reisewährung (fürs Budget) — ohne Umrechnung 0, nie der Originalbetrag einer anderen
 * Währung (keine Beträge verschiedener Währungen direkt addieren). */
export function tripValue(expense: Pick<TripExpense, 'amount' | 'amount_trip' | 'currency'>, tripCurrency: string): number {
  if (expense.amount_trip != null) return Number(expense.amount_trip);
  return expense.currency === tripCurrency || !expense.currency ? Number(expense.amount) : 0;
}

// ---------- Planung ----------
/** „Heute“ (auch für Überfälliges) oder „12. März“ — für die Aufgabenliste. */
export function dueLabel(date: string | null, today: string): { text: string; urgent: boolean } {
  if (!date) return { text: 'Ohne Datum', urgent: false };
  if (date <= today) return { text: date < today ? 'Überfällig' : 'Heute', urgent: true };
  return { text: noon(date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }), urgent: false };
}
export type TaskView = 'open' | 'done' | 'mine';
/** Offene nach Fälligkeit (ohne Datum zuletzt), erledigte zuletzt erledigt zuerst; „Meine“ = mir zugewiesen. */
export function filterTasks(tasks: TripTask[], view: TaskView, me: number | null): TripTask[] {
  const byDue = (a: TripTask, b: TripTask) =>
    (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || (a.due_time ?? '').localeCompare(b.due_time ?? '') || a.id - b.id;
  if (view === 'done') return tasks.filter((t) => t.status === 'DONE').sort((a, b) => b.id - a.id);
  if (view === 'mine') return tasks.filter((t) => t.status === 'OPEN' && me !== null && t.assignee === me).sort(byDue);
  return tasks.filter((t) => t.status === 'OPEN').sort(byDue);
}
/** Wenige, allgemeine und aus den Reisedaten abgeleitete Hinweise — keine Rechts-, Gesundheits- oder Finanzberatung. */
export function planningTips(trip: Pick<Trip, 'transport_type' | 'start_date' | 'end_date'>): string[] {
  const tips = ['Ausweis oder Reisepass rechtzeitig auf Gültigkeit prüfen.'];
  if (trip.transport_type === 'FLIGHT') tips.push('Online Check-in öffnet oft 24–48 Stunden vor Abflug.');
  if (trip.transport_type === 'TRAIN' || trip.transport_type === 'BUS') tips.push('Tickets auch offline speichern.');
  if (trip.transport_type === 'CAR') tips.push('Route und Pausen vorab planen.');
  tips.push('Klären, wie du vor Ort bezahlst (Karte, Bargeld).');
  return tips.slice(0, 3);
}

// ---------- Bordkarte („Von hier nach dort“, 31.10.2026) ----------
/** „Berlin, Deutschland“ → Ort „Berlin“ und Zusatz „Deutschland“ — für die große Zielzeile der Bordkarte. */
export function placeParts(value: string | null | undefined): { place: string; region: string } {
  const [place, ...rest] = (value ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  return { place: place ?? '', region: rest.join(', ') };
}
/** Der Abschnitt rechts auf der Bordkarte: große Zahl und was sie bedeutet. Nur aus Datum und Zeitraum. */
export function passStub(trip: Pick<Trip, 'start_date' | 'end_date' | 'status'>, today: string): { big: string; small: string } {
  const phase = tripPhase(trip, today);
  if (phase === 'cancelled') return { big: '–', small: 'Abgesagt' };
  if (phase === 'past') return { big: String(tripDays(trip)), small: tripDays(trip) === 1 ? 'Tag unterwegs' : 'Tage unterwegs' };
  if (phase === 'ongoing') return { big: String(daysUntil(today, trip.start_date) + 1), small: `Tag von ${tripDays(trip)}` };
  const days = daysUntil(trip.start_date, today);
  if (days === 0) return { big: 'Heute', small: 'geht’s los' };
  if (days === 1) return { big: '1', small: 'Tag bis zur Abreise' };
  return { big: String(days), small: 'Tage bis zur Abreise' };
}
/** Packliste als Anteil — bewusst getrennt von den Aufgaben: ein gepacktes T-Shirt und eine Buchung wiegen nicht
 * gleich (Abnahme 31.10.2026). Ohne Packliste: null. */
export function packingShare(packed: number, total: number): { packed: number; total: number; pct: number } | null {
  return total ? { packed, total, pct: percent(packed, total) } : null;
}

// ---------- Planung als Countdown-Linie ----------
/** Abschnitte der Planung, gemessen an der Reise: was überfällig ist, was vor der Abreise erledigt sein muss, dann
 * der Abreisetag als Marke, was unterwegs ansteht, was danach kommt und was kein Datum hat. */
export type TimelineKey = 'late' | 'before' | 'during' | 'after' | 'none';
export const TIMELINE_LABELS: Record<TimelineKey, string> = {
  late: 'Überfällig',
  before: 'Vor der Abreise',
  during: 'Unterwegs',
  after: 'Nach der Reise',
  none: 'Ohne Datum',
};
export function taskTimeline(
  tasks: readonly TripTask[],
  trip: Pick<Trip, 'start_date' | 'end_date'>,
  today: string,
): { key: TimelineKey; label: string; tasks: TripTask[] }[] {
  const order: TimelineKey[] = ['late', 'before', 'during', 'after', 'none'];
  const buckets = new Map<TimelineKey, TripTask[]>(order.map((k) => [k, []]));
  for (const t of tasks) {
    const d = t.due_date;
    const key: TimelineKey = !d ? 'none' : t.status === 'OPEN' && d < today ? 'late' : d < trip.start_date ? 'before' : d <= trip.end_date ? 'during' : 'after';
    buckets.get(key)!.push(t);
  }
  return order.filter((k) => buckets.get(k)!.length).map((key) => ({ key, label: TIMELINE_LABELS[key], tasks: buckets.get(key)! }));
}

// ---------- Budget: Farben je Kategorie (gestapelter Balken, immer mit Beschriftung) ----------
export const BUDGET_COLOR: Record<BudgetCategory, string> = {
  UNTERKUNFT: '#36608b',
  TRANSPORT: '#5b8fc7',
  ESSEN: '#d9822b',
  AKTIVITAETEN: '#2e9b57',
  SHOPPING: '#c94f7c',
  SONSTIGES: '#8a93a3',
  RESERVE: '#b6c1cf',
};

// ---------- Tagesablauf (12.11.2026) ----------
export const EVENT_KIND_META: Record<TripEventKind, { label: string; icon: IconName }> = {
  TRANSPORT: { label: 'Unterwegs', icon: 'train' },
  STAY: { label: 'Unterkunft', icon: 'bed' },
  ACTIVITY: { label: 'Programm', icon: 'ticket' },
  FOOD: { label: 'Essen', icon: 'utensils' },
  OTHER: { label: 'Sonstiges', icon: 'map-pin' },
};
export const EVENT_KIND_ORDER: TripEventKind[] = ['TRANSPORT', 'STAY', 'ACTIVITY', 'FOOD', 'OTHER'];

/** Symbol eines Programmpunkts: „Unterwegs“ nimmt das Verkehrsmittel der Reise (Zug, Flugzeug, Auto …). */
export function eventIcon(kind: TripEventKind, transport: Trip['transport_type']): IconName {
  return kind === 'TRANSPORT' && transport ? transportIcon(transport) : EVENT_KIND_META[kind].icon;
}
/** „HH:MM“ in lokaler Zeit. */
export function clock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
/** „08:12 – 12:31“ oder nur „15:00“; endet es an einem anderen Tag, mit Datum („bis Do., 26. Nov., 10:00“). */
export function eventTime(event: Pick<TripEvent, 'starts_at' | 'ends_at'>): string {
  const start = clock(event.starts_at);
  if (!event.ends_at) return start;
  if (localDay(new Date(event.ends_at)) === localDay(new Date(event.starts_at))) return `${start} – ${clock(event.ends_at)}`;
  const endDay = new Date(event.ends_at).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${start} – ${endDay}, ${clock(event.ends_at)}`;
}

export interface ItineraryDay {
  key: string;
  /** „Di., 24. Nov.“ oder „Vor der Reise“ / „Nach der Reise“ */
  label: string;
  /** „Tag 1 · Abreise“, „Tag 2“, „Tag 3 · Rückreise“; leer für vorher/nachher */
  sub: string;
  today: boolean;
  /** Ein Tag der Reise selbst (auch ohne Einträge) – vorher/nachher erscheinen nur mit Einträgen */
  tripDay: boolean;
  events: TripEvent[];
}
/**
 * Der Tagesablauf: jeder Reisetag als eigener Abschnitt (auch ohne Einträge – so sieht man freie Tage), Einträge nach
 * Uhrzeit. Was vor dem ersten oder nach dem letzten Tag liegt, steht gesammelt davor bzw. danach.
 */
export function itinerary(trip: Pick<Trip, 'start_date' | 'end_date'>, events: TripEvent[], today: string): ItineraryDay[] {
  const sorted = [...events].sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id - b.id);
  const dayOf = (e: TripEvent) => localDay(new Date(e.starts_at));
  const days: ItineraryDay[] = [];
  const before = sorted.filter((e) => dayOf(e) < trip.start_date);
  if (before.length) days.push({ key: 'vorher', label: 'Vor der Reise', sub: '', today: false, tripDay: false, events: before });
  const total = tripDays(trip);
  for (let i = 0; i < total; i++) {
    const iso = addDays(trip.start_date, i);
    const role = total > 1 && i === 0 ? ' · Anreise' : total > 1 && i === total - 1 ? ' · Rückreise' : '';
    days.push({
      key: iso,
      label: noon(iso).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }),
      sub: `Tag ${i + 1}${role}`,
      today: iso === today,
      tripDay: true,
      events: sorted.filter((e) => dayOf(e) === iso),
    });
  }
  const after = sorted.filter((e) => dayOf(e) > trip.end_date);
  if (after.length) days.push({ key: 'nachher', label: 'Nach der Reise', sub: '', today: false, tripDay: false, events: after });
  return days;
}

export interface CancellationInfo {
  /** „Fr., 20. Nov.“ */
  date: string;
  /** Tage bis zur Frist (negativ = vorbei) */
  days: number;
  /** „noch 8 Tage“, „heute letzter Tag“, „abgelaufen“ */
  status: string;
  /** In den nächsten 14 Tagen (oder heute) – dann zeigt die Bordkarte eine Marke */
  soon: boolean;
  passed: boolean;
}
/** So weit vorher erscheint die Frist als Marke auf der Bordkarte. */
export const CANCELLATION_SOON_DAYS = 14;
/** Kostenlose Stornierung der Unterkunft – null ohne Frist oder bei abgesagten/abgeschlossenen Reisen. */
export function cancellationInfo(trip: Pick<Trip, 'free_cancellation_until' | 'status'>, today: string): CancellationInfo | null {
  const until = trip.free_cancellation_until;
  if (!until || trip.status === 'CANCELLED' || trip.status === 'DONE') return null;
  const days = daysUntil(until, today);
  const status = days < 0 ? 'abgelaufen' : days === 0 ? 'heute letzter Tag' : days === 1 ? 'noch 1 Tag' : `noch ${days} Tage`;
  return {
    date: noon(until).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }),
    days,
    status,
    soon: days >= 0 && days <= CANCELLATION_SOON_DAYS,
    passed: days < 0,
  };
}
