import { IconName } from '../../shared/icons/app-icon';
import {
  BudgetCategory,
  PackingCategory,
  PackingItem,
  ReminderArea,
  Trip,
  TripBudgetCategory,
  TripExpense,
  TripReminder,
  TripStatus,
} from './reisen-api.service';

// ---------- Status ----------
export const STATUS_ORDER: TripStatus[] = ['IDEA', 'PLANNED', 'CONFIRMED', 'ACTIVE', 'DONE', 'CANCELLED'];
export const STATUS_LABELS: Record<TripStatus, string> = {
  IDEA: 'Idee',
  PLANNED: 'In Planung',
  CONFIRMED: 'Bestätigt',
  ACTIVE: 'Unterwegs',
  DONE: 'Abgeschlossen',
  CANCELLED: 'Storniert',
};
/** Farbton der Status-Pille (siehe trip-common.scss .status--*). */
export const STATUS_TONE: Record<TripStatus, 'green' | 'blue' | 'gray' | 'violet' | 'red'> = {
  IDEA: 'gray',
  PLANNED: 'blue',
  CONFIRMED: 'green',
  ACTIVE: 'violet',
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
/** „Mi“ und „12. März“ für die Zeitleiste der Erinnerungen. */
export function dayParts(iso: string): { weekday: string; day: string } {
  const d = noon(iso);
  return {
    weekday: d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', ''),
    day: d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }),
  };
}
/** „Mi, 12. März 2025, 18:00“ */
export function reminderWhen(date: string | null, time: string | null): string {
  if (!date) return 'Ohne Datum';
  const d = noon(date);
  const text = d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).replace('.,', ',');
  return time ? `${text}, ${time.slice(0, 5)}` : text;
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

// ---------- Reise-Symbol ----------
export function tripIcon(trip: Pick<Trip, 'travel_type' | 'transport_type'>): IconName {
  if (trip.travel_type === 'BEACH') return 'umbrella';
  if (trip.travel_type === 'ACTIVE') return 'mountain';
  if (trip.travel_type === 'ROAD_TRIP' || trip.transport_type === 'CAR') return 'car';
  return 'travel';
}
export const TRANSPORT_LABELS: Record<Exclude<Trip['transport_type'], ''>, string> = {
  FLIGHT: 'Flugzeug',
  TRAIN: 'Zug',
  CAR: 'Auto',
  BUS: 'Bus',
  OTHER: 'Sonstiges',
};
export function transportIcon(type: Trip['transport_type']): IconName {
  return type === 'TRAIN' ? 'train' : type === 'CAR' || type === 'BUS' ? 'car' : type === 'FLIGHT' ? 'travel' : 'car';
}

// ---------- Reisen-Liste: Filter und Sortierung ----------
export type PeriodFilter = '' | 'upcoming' | 'past' | 'this-year';
export type TripSort = 'date-asc' | 'date-desc' | 'title' | 'updated';
export interface TripFilter {
  status: TripStatus | '';
  period: PeriodFilter;
  /** Anzeigename eines Teilnehmers oder leer */
  person: string;
}
export function filterTrips(trips: Trip[], filter: TripFilter, today: string): Trip[] {
  return trips.filter((t) => {
    if (filter.status && t.status !== filter.status) return false;
    if (filter.period === 'upcoming' && t.end_date < today) return false;
    if (filter.period === 'past' && t.end_date >= today) return false;
    if (filter.period === 'this-year' && t.start_date.slice(0, 4) !== today.slice(0, 4)) return false;
    if (filter.person && !t.participants.some((p) => p.display_name === filter.person)) return false;
    return true;
  });
}
export function sortTrips(trips: Trip[], sort: TripSort): Trip[] {
  const list = [...trips];
  switch (sort) {
    case 'date-desc':
      return list.sort((a, b) => b.start_date.localeCompare(a.start_date) || b.id - a.id);
    case 'title':
      return list.sort((a, b) => a.title.localeCompare(b.title, 'de'));
    case 'updated':
      return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    default:
      return list.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id);
  }
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
/** „Noch nicht eingepackt: Ladegerät und Reiseapotheke.“ — die wichtigsten offenen Dinge zuerst (Dokumente, Technik,
 * Gesundheit), höchstens drei Namen. */
export function notPackedHint(items: PackingItem[]): string | null {
  const priority: PackingCategory[] = ['DOKUMENTE', 'TECHNIK', 'GESUNDHEIT', 'UNTERWEGS', 'HYGIENE', 'KLEIDUNG', 'SONSTIGES'];
  const open = items
    .filter((i) => !i.is_packed)
    .sort((a, b) => priority.indexOf(a.category) - priority.indexOf(b.category) || a.id - b.id);
  if (!open.length) return null;
  const names = open.slice(0, 2).map((i) => i.title);
  const rest = open.length - names.length;
  const list = rest > 0 ? `${names.join(', ')} und ${rest} weitere` : names.join(' und ');
  return `Noch nicht eingepackt: ${list}.`;
}
/** Kurze, aus den echten Reisedaten abgeleitete Tipps — keine erfundenen Wetterdaten. */
export function packingTips(trip: Trip, items: PackingItem[]): string[] {
  const tips: string[] = [];
  const hint = notPackedHint(items);
  if (hint) tips.push(hint);
  const days = tripDays(trip);
  if (trip.baggage_type === 'HAND_LUGGAGE' || (days <= 3 && trip.transport_type !== 'CAR')) {
    tips.push(days <= 3 ? 'Für ein Wochenende reicht Handgepäck.' : 'Nur Handgepäck: Flüssigkeiten in kleine Behälter umfüllen.');
  }
  if (trip.transport_type === 'TRAIN' || trip.transport_type === 'FLIGHT' || trip.transport_type === 'BUS') {
    tips.push('Tickets und Buchungen auch offline verfügbar machen.');
  }
  if (!items.some((i) => i.category === 'DOKUMENTE')) tips.push('Denk an Ausweis oder Reisepass.');
  if (trip.accommodation) tips.push(`Buchungsbestätigung für „${trip.accommodation}“ griffbereit halten.`);
  return tips.slice(0, 4);
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
export function budgetRows(planned: TripBudgetCategory[], expenses: TripExpense[]): BudgetRow[] {
  return BUDGET_ORDER.map((category) => {
    const plan = Number(planned.find((p) => p.category === category)?.planned_amount ?? 0);
    const spent = expenses.filter((e) => (e.category ?? 'SONSTIGES') === category).reduce((s, e) => s + Number(e.amount), 0);
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
export function totalBudget(trip: Trip | null, planned: TripBudgetCategory[]): number {
  const own = Number(trip?.budget_amount || 0);
  return own > 0 ? own : planned.reduce((s, p) => s + Number(p.planned_amount), 0);
}

// ---------- Erinnerungen ----------
export const AREA_LABELS: Record<ReminderArea, string> = { REISEN: 'Reisen', HAUSHALT: 'Haushalt', ORGANISATION: 'Organisation' };
const ICON_WORDS: [RegExp, IconName][] = [
  [/check-?in|flug|boarding/i, 'travel'],
  [/dokument|pass|ausweis|visum|versicherung/i, 'file-text'],
  [/koffer|pack|gepäck/i, 'luggage'],
  [/pflanz|gieß|blume/i, 'plant'],
  [/abreise|abfahrt|fahrt|auto|taxi/i, 'car'],
  [/zug|bahn/i, 'train'],
  [/hotel|unterkunft/i, 'bed'],
  [/ticket|museum|eintritt/i, 'ticket'],
  [/essen|restaurant|tisch/i, 'utensils'],
];
export function reminderIcon(reminder: Pick<TripReminder, 'title' | 'area' | 'source'>): IconName {
  const hit = ICON_WORDS.find(([pattern]) => pattern.test(reminder.title));
  if (hit) return hit[1];
  if (reminder.area === 'HAUSHALT') return 'household';
  if (reminder.source === 'ORG_EVENT' || reminder.source === 'TRIP_EVENT') return 'calendar';
  return 'check-circle';
}
export type ReminderRange = 'all' | 'today' | 'week';
export type ReminderKind = '' | 'task' | 'event';
export interface ReminderFilter {
  range: ReminderRange;
  area: ReminderArea | '';
  kind: ReminderKind;
}
const EVENT_SOURCES = new Set(['TRIP_EVENT', 'ORG_EVENT']);
export function filterReminders(items: TripReminder[], filter: ReminderFilter, today: string): TripReminder[] {
  const weekEnd = addDays(today, 6);
  return items.filter((r) => {
    if (filter.area && r.area !== filter.area) return false;
    if (filter.kind === 'event' && !EVENT_SOURCES.has(r.source)) return false;
    if (filter.kind === 'task' && EVENT_SOURCES.has(r.source)) return false;
    if (filter.range === 'today' && r.date !== today) return false;
    if (filter.range === 'week' && (!r.date || r.date < today || r.date > weekEnd)) return false;
    return true;
  });
}
export interface ReminderDay {
  date: string | null;
  items: TripReminder[];
}
/** Nach Tag gruppiert (die Liste kommt bereits sortiert vom Backend); ohne Datum zuletzt. */
export function groupReminders(items: TripReminder[]): ReminderDay[] {
  const days: ReminderDay[] = [];
  for (const item of items) {
    const last = days[days.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else days.push({ date: item.date, items: [item] });
  }
  return days;
}
/** Haushaltseinträge, die in die Reisezeit fallen — der Hinweis „verschieben oder abgeben?“. */
export function householdConflicts(items: TripReminder[], trip: Pick<Trip, 'start_date' | 'end_date'>): TripReminder[] {
  return items.filter((r) => r.area === 'HAUSHALT' && !!r.date && r.date >= trip.start_date && r.date <= trip.end_date);
}

// ---------- Geld ----------
const CURRENCY_SYMBOLS: Record<Trip['currency'], { symbol: string; prefix: boolean }> = {
  EUR: { symbol: '€', prefix: false },
  USD: { symbol: '$', prefix: true },
  GBP: { symbol: '£', prefix: true },
  CHF: { symbol: 'CHF', prefix: true },
};
/** Immer deutsche Zahlengruppierung (1.500,00), nur Symbol/Position wechseln je Währung. `compact` lässt „,00“ weg. */
export function formatMoney(value: string | number, currency: Trip['currency'], compact = false): string {
  const number = typeof value === 'number' ? value : Number(value);
  const whole = compact && Math.round(number * 100) % 100 === 0;
  const amount = number.toLocaleString('de-DE', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
  const { symbol, prefix } = CURRENCY_SYMBOLS[currency] ?? CURRENCY_SYMBOLS.EUR;
  return prefix ? `${symbol} ${amount}` : `${amount} ${symbol}`;
}

// ---------- Übersicht ----------
export type SuggestionKind = 'packing-empty' | 'packing' | 'tasks' | 'budget' | 'ready';
export interface TripSuggestion {
  kind: SuggestionKind;
  title: string;
  text: string;
  /** Knopf und Ziel-Reiter; ohne Knopf, wenn alles vorbereitet ist */
  action: string | null;
  target: 'packlisten' | 'erinnerungen' | 'budget' | null;
}
/** Der eine nächste sinnvolle Schritt für die Reise — in fester Reihenfolge, Zurückgestelltes wird übersprungen. */
export function tripSuggestion(
  trip: Pick<Trip, 'title'>,
  state: { packed: number; packingTotal: number; tasksOpen: number; budgetTotal: number },
  skipped: ReadonlySet<SuggestionKind> = new Set(),
): TripSuggestion {
  const candidates: TripSuggestion[] = [];
  const missing = state.packingTotal - state.packed;
  if (state.packingTotal === 0) {
    candidates.push({
      kind: 'packing-empty',
      title: 'Packliste anlegen',
      text: `Für „${trip.title}“ gibt es noch keine Packliste. Passende Vorschläge helfen dir beim Start.`,
      action: 'Zur Packliste',
      target: 'packlisten',
    });
  } else if (missing > 0) {
    candidates.push({
      kind: 'packing',
      title: 'Packliste noch unvollständig',
      text: `Es fehlen noch ${missing} von ${state.packingTotal} Punkten auf deiner Packliste. Prüfe die offenen Dinge, damit du entspannt startest.`,
      action: 'Zur Packliste',
      target: 'packlisten',
    });
  }
  if (state.tasksOpen > 0) {
    candidates.push({
      kind: 'tasks',
      title: state.tasksOpen === 1 ? 'Eine Aufgabe ist noch offen' : `${state.tasksOpen} Aufgaben sind noch offen`,
      text: 'Erledige die offenen Aufgaben rechtzeitig vor der Abreise – mit Datum und Uhrzeit verpasst du nichts.',
      action: 'Zu den Erinnerungen',
      target: 'erinnerungen',
    });
  }
  if (state.budgetTotal <= 0) {
    candidates.push({
      kind: 'budget',
      title: 'Budget planen',
      text: 'Lege fest, wie viel du für Unterkunft, Transport, Essen und Aktivitäten ausgeben möchtest.',
      action: 'Budget planen',
      target: 'budget',
    });
  }
  return (
    candidates.find((c) => !skipped.has(c.kind)) ?? {
      kind: 'ready',
      title: candidates.length ? 'Für heute ist alles im Blick' : 'Alles vorbereitet',
      text: candidates.length
        ? 'Du hast die Hinweise für heute zurückgestellt. Morgen erinnern wir dich wieder.'
        : 'Packliste, Aufgaben und Budget sind erledigt. Gute Reise!',
      action: null,
      target: null,
    }
  );
}
const ACTIVE_STATUSES: TripStatus[] = ['PLANNED', 'CONFIRMED', 'ACTIVE'];
/** Laufende und bevorstehende Reisen (ohne Ideen, Abgeschlossenes und Storniertes) und ein kurzer Satz dazu. */
export function activeTripsSummary(trips: Trip[], today: string): { count: number; text: string } {
  const active = trips.filter((t) => ACTIVE_STATUSES.includes(t.status) && t.end_date >= today);
  const parts = (['ACTIVE', 'CONFIRMED', 'PLANNED'] as TripStatus[])
    .map((status) => ({ status, n: active.filter((t) => t.status === status).length }))
    .filter((p) => p.n > 0)
    .map((p) => (p.status === 'ACTIVE' ? `${p.n} unterwegs` : p.status === 'CONFIRMED' ? `${p.n} bestätigt` : `${p.n} in Planung`));
  return { count: active.length, text: parts.length ? parts.join(' · ') : 'keine geplant' };
}
/** „Heute“ (auch für Überfälliges) oder „12. März“ — für die To-do-Liste. */
export function dueLabel(date: string | null, today: string): { text: string; urgent: boolean } {
  if (!date) return { text: 'Ohne Datum', urgent: false };
  if (date <= today) return { text: date < today ? 'Überfällig' : 'Heute', urgent: true };
  return { text: noon(date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }), urgent: false };
}
/** „12. März, 18:00“ */
export function shortWhen(date: string | null, time: string | null): string {
  if (!date) return 'Ohne Datum';
  const day = noon(date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  return time ? `${day}, ${time.slice(0, 5)}` : day;
}
