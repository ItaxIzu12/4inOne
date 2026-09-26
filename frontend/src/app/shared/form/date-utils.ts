/** Kleine Datumshilfen für die Auswahlfelder. Alles als Text (`JJJJ-MM`, `JJJJ-MM-TT`), rechnet in UTC — keine Zeitzonenfehler. */

export const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function toMonth(year: number, month0: number): string {
  const y = year + Math.floor(month0 / 12);
  const m = ((month0 % 12) + 12) % 12;
  return `${pad(y, 4)}-${pad(m + 1)}`;
}

export function toDate(year: number, month0: number, day: number): string {
  const d = new Date(Date.UTC(year, month0, day));
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** „2026-09“ / „2026-09-25“ → Bestandteile; null bei ungültiger Eingabe. */
export function parse(value: string): { year: number; month0: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value ?? '');
  if (!match) return null;
  const year = Number(match[1]);
  const month0 = Number(match[2]) - 1;
  const day = match[3] ? Number(match[3]) : 1;
  if (month0 < 0 || month0 > 11 || day < 1 || day > daysInMonth(year, month0)) return null;
  return { year, month0, day };
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Wochentag mit Montag = 0. */
export function weekdayMon0(year: number, month0: number, day: number): number {
  return (new Date(Date.UTC(year, month0, day)).getUTCDay() + 6) % 7;
}

export function addDays(date: string, days: number): string {
  const p = parse(date)!;
  return toDate(p.year, p.month0, p.day + days);
}

/** Monate verschieben; der Tag wird aufs Monatsende begrenzt (31.01. + 1 Monat = 28./29.02.). */
export function addMonths(date: string, months: number): string {
  const p = parse(date)!;
  const target = toMonth(p.year, p.month0 + months);
  const t = parse(target)!;
  return toDate(t.year, t.month0, Math.min(p.day, daysInMonth(t.year, t.month0)));
}

export function todayIso(): string {
  const now = new Date();
  return toDate(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Vorgabedatum für „neu“ im gewählten Monat („JJJJ-MM“): heute, wenn es der laufende Monat ist; sonst der 1. eines
 * künftigen bzw. der letzte Tag eines vergangenen Monats (dort trägt man meist Zurückliegendes nach). */
export function defaultDateInMonth(month: string, today: string = todayIso()): string {
  const p = parse(month.slice(0, 7));
  if (!p || today.slice(0, 7) === month.slice(0, 7)) return today;
  return month.slice(0, 7) > today.slice(0, 7) ? toDate(p.year, p.month0, 1) : toDate(p.year, p.month0, daysInMonth(p.year, p.month0));
}

/** Anzeige: Monat → „September 2026“, Datum → „25.09.2026“. */
export function display(value: string, mode: 'month' | 'date'): string {
  const p = parse(value);
  if (!p) return '';
  return mode === 'month' ? `${MONTH_NAMES[p.month0]} ${p.year}` : `${pad(p.day)}.${pad(p.month0 + 1)}.${p.year}`;
}
