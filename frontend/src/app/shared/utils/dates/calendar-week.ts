/**
 * Kalenderwoche für de-DE — die EINE Stelle für Wochen in 4inOne (Finanzen, Haushalt, Organisation, Reisen).
 *
 * - Eine Woche beginnt am Montag und endet am Sonntag.
 * - Die Nummer folgt ISO 8601: KW 1 ist die Woche mit dem ersten Donnerstag des Jahres
 *   (daher kann der 1. Januar noch in KW 52/53 des Vorjahres liegen).
 * - „Diese Woche“ heißt überall: die laufende Kalenderwoche — nicht „die nächsten 7 Tage“.
 *
 * Gerechnet wird mit lokalen Kalendertagen („JJJJ-MM-TT“), mittags verankert, damit Zeitumstellungen nie einen Tag
 * verschieben. Das Backend nutzt dieselbe Regel (Python: date.weekday(), Montag = 0).
 */
export interface CalendarWeek {
  /** Montag */
  start: string;
  /** Sonntag */
  end: string;
  /** ISO-Kalenderwoche 1–53 */
  week: number;
  /** Jahr, zu dem die Kalenderwoche gehört */
  year: number;
}

function noon(day: string): Date {
  return new Date(`${day.slice(0, 10)}T12:00`);
}
export function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function plusDays(day: string, days: number): string {
  const d = noon(day);
  d.setDate(d.getDate() + days);
  return isoDay(d);
}
/** Montag = 0 … Sonntag = 6 */
export function weekdayIndex(day: string): number {
  return (noon(day).getDay() + 6) % 7;
}

export function calendarWeek(day: string): CalendarWeek {
  const start = plusDays(day, -weekdayIndex(day));
  const thursday = noon(plusDays(start, 3));
  const jan4 = isoDay(new Date(thursday.getFullYear(), 0, 4, 12));
  const firstMonday = plusDays(jan4, -weekdayIndex(jan4));
  return {
    start,
    end: plusDays(start, 6),
    week: Math.round((noon(start).getTime() - noon(firstMonday).getTime()) / (7 * 86_400_000)) + 1,
    year: thursday.getFullYear(),
  };
}
/** Liegt `day` in derselben Kalenderwoche wie `reference`? */
export function isInCalendarWeek(day: string, reference: string): boolean {
  const w = calendarWeek(reference);
  return day >= w.start && day <= w.end;
}
/** „05.10.2026 – 11.10.2026“ */
export function weekRangeLabel(day: string): string {
  const w = calendarWeek(day);
  const fmt = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
  return `${fmt(w.start)} – ${fmt(w.end)}`;
}
