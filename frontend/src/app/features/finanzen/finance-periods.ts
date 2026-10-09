import { CalendarWeek, calendarWeek, weekRangeLabel } from '../../shared/dates/calendar-week';
import { FinanceCategory, FinanceTransaction, SavingsContributionDto } from './private-finance-api.service';

/** Zeitraumansichten der Finanz-Übersicht. Monat bleibt die Budgetansicht; Tag, Woche und eigener Zeitraum zeigen
 * nur, was passiert ist — ohne künstliches Tages- oder Zeitraumbudget. */
export type FinancePeriod = 'day' | 'week' | 'month' | 'custom';
export const PERIOD_LABELS: Record<FinancePeriod, string> = {
  day: 'Tag',
  week: 'Woche',
  month: 'Monat',
  custom: 'Benutzerdefiniert',
};
/** Ein eigener Zeitraum darf höchstens so lang sein (wie das Backend, finanzen/private_api.py MAX_RANGE_DAYS). */
export const MAX_RANGE_DAYS = 366;

function noon(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00`);
}
export function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function todayIso(): string {
  return isoDay(new Date());
}
export function addDays(iso: string, days: number): string {
  const d = noon(iso);
  d.setDate(d.getDate() + days);
  return isoDay(d);
}
export function daysBetween(from: string, to: string): number {
  return Math.round((noon(to).getTime() - noon(from).getTime()) / 86_400_000);
}

/** Kalenderwoche (Mo–So, ISO 8601) — zentral in shared/dates/calendar-week.ts. */
export function isoWeek(iso: string): CalendarWeek {
  return calendarWeek(iso);
}

const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions) => noon(iso).toLocaleDateString('de-DE', opts);
/** „06.10.2026“ */
export function numericDate(iso: string): string {
  return fmtDay(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });
}
/** „Heute“, „Gestern“, „Morgen“ oder „Mo., 5. Oktober 2026“ */
export function dayTitle(iso: string, today = todayIso()): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Heute';
  if (diff === -1) return 'Gestern';
  if (diff === 1) return 'Morgen';
  return fmtDay(iso, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}
/** „05.10.2026 – 11.10.2026“ — ohne „KW“, das Datum genügt. */
export function weekTitle(iso: string): string {
  return weekRangeLabel(iso);
}

export interface PeriodRange {
  from: string;
  to: string;
}
export function rangeFor(period: FinancePeriod, anchor: string, custom: PeriodRange): PeriodRange {
  if (period === 'day') return { from: anchor, to: anchor };
  if (period === 'week') {
    const w = isoWeek(anchor);
    return { from: w.start, to: w.end };
  }
  if (period === 'custom') return custom;
  const month = anchor.slice(0, 7);
  const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}
export interface RangeProblem {
  field: 'from' | 'to';
  message: string;
}
/** Prüft einen eigenen Zeitraum: Von und Bis sind Pflicht, Bis ≥ Von, höchstens ein Jahr. Vergangene und zukünftige
 * Zeiträume sind erlaubt. Gibt das Feld mit dem Fehler zurück, oder null wenn alles passt. */
export function customRangeError(range: PeriodRange): RangeProblem | null {
  if (!range.from) return { field: 'from', message: 'Bitte wähle ein Startdatum.' };
  if (!range.to) return { field: 'to', message: 'Bitte wähle ein Enddatum.' };
  if (range.to < range.from) return { field: 'to', message: 'Das Enddatum liegt vor dem Startdatum.' };
  if (daysBetween(range.from, range.to) > MAX_RANGE_DAYS) return { field: 'to', message: 'Der Zeitraum ist länger als ein Jahr.' };
  return null;
}
/** Was die Person tun kann — für den Hinweis an Stelle der Ergebnisse. */
export function customRangeHelp(range: PeriodRange): string {
  if (!range.from || !range.to) return 'Wähle oben Start- und Enddatum, dann erscheinen hier deine Buchungen.';
  if (range.to < range.from) {
    return `Das Enddatum (${numericDate(range.to)}) liegt vor dem Startdatum (${numericDate(range.from)}). Wähle ein späteres Enddatum oder tausche die beiden Daten.`;
  }
  return 'Ein eigener Zeitraum darf höchstens ein Jahr umfassen. Wähle ein früheres Enddatum oder ein späteres Startdatum.';
}
/** Kurzform (nur der Text) */
export function customRangeProblem(range: PeriodRange): string | null {
  return customRangeError(range)?.message ?? null;
}
/** Liegt der Zeitraum (teilweise) in der Zukunft? Dann zeigt die Übersicht nur bereits erfasste Buchungen. */
export function reachesFuture(range: PeriodRange, today: string): boolean {
  return !!range.to && range.to > today;
}
/** Deckt der Zeitraum genau einen Kalendermonat ab (1. bis Monatsletzter)? Dann gibt es ein passendes Monatsbudget —
 * sonst wird kein Restbudget berechnet. */
export function exactMonth(range: PeriodRange): string | null {
  if (!range.from || !range.to || range.from.slice(0, 7) !== range.to.slice(0, 7) || !range.from.endsWith('-01')) return null;
  const month = range.from.slice(0, 7);
  return rangeFor('month', range.from, range).to === range.to ? month : null;
}

export interface PeriodTotals {
  expenses: number;
  income: number;
  saved: number;
  /** Buchungen im Zeitraum, neueste zuerst */
  rows: FinanceTransaction[];
}
const within = (iso: string, range: PeriodRange) => iso >= range.from && iso <= range.to;
/** Summen im Zeitraum (nur Euro, wie die übrige Übersicht). Gespart = Einzahlungen minus Entnahmen. */
export function periodTotals(
  transactions: FinanceTransaction[],
  contributions: SavingsContributionDto[],
  range: PeriodRange,
): PeriodTotals {
  const rows = transactions
    .filter((t) => within(t.date, range) && (t.currency ?? 'EUR') === 'EUR')
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const sum = (type: FinanceTransaction['type']) => rows.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0);
  return {
    expenses: sum('EXPENSE'),
    income: sum('INCOME'),
    saved: contributions.filter((c) => within(c.date, range)).reduce((s, c) => s + Number(c.amount), 0),
    rows,
  };
}
export interface CategoryShare {
  id: number | null;
  name: string;
  color: string;
  amount: number;
  pct: number;
}
/** Die größten Ausgabenkategorien eines Zeitraums. */
export function topCategories(
  rows: FinanceTransaction[],
  categories: FinanceCategory[],
  fallbackColor: string,
  limit = 3,
): CategoryShare[] {
  const expenses = rows.filter((t) => t.type === 'EXPENSE');
  const total = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const byId = new Map<number | null, number>();
  for (const t of expenses) byId.set(t.category ?? null, (byId.get(t.category ?? null) ?? 0) + Number(t.amount));
  return [...byId.entries()]
    .map(([id, amount]) => {
      const category = categories.find((c) => c.id === id);
      return {
        id,
        name: category?.name ?? 'Sonstiges',
        color: category?.color ?? fallbackColor,
        amount,
        pct: total > 0 ? Math.round((amount / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}
