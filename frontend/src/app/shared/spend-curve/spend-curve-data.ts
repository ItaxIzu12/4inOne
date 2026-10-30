/**
 * Ausgabenverlauf eines Monats: aufsummierte Ausgaben je Tag bis heute, dazu das gleichmäßige Budget-Tempo.
 * Reine Rechnung aus echten Transaktionen (Typ „EXPENSE“) — nichts wird geschätzt oder fortgeschrieben.
 * Datumsangaben „JJJJ-MM-TT“, Monat „JJJJ-MM“.
 */
export interface SpendCurve {
  /** Monat „JJJJ-MM“. */
  month: string;
  /** Tage im Monat (28–31). */
  days: number;
  /** Aufsummierte Ausgaben je Tag, Index 0 = 1. des Monats; endet am letzten gezeigten Tag (heute oder Monatsende). */
  series: number[];
  /** Monatsbudget oder null (dann keine Tempo-Linie). */
  budget: number | null;
  /** Läuft der Monat noch? Dann ist der letzte Wert „heute“. */
  current: boolean;
}

export interface SpendTransaction {
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  date: string;
}

export function daysInMonth(month: string): number {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m, 0).getDate();
}

/** Lokales Datum „JJJJ-MM-TT“ (nicht UTC — sonst kippt der Tag kurz nach Mitternacht). */
export function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function spendCurve(transactions: readonly SpendTransaction[], month: string, budget: number | null, today = new Date()): SpendCurve {
  const days = daysInMonth(month);
  const todayIso = isoDay(today);
  const current = todayIso.startsWith(month);
  // Zukünftiger Monat: noch kein Tag vorbei; vergangener Monat: alle Tage
  const shown = current ? today.getDate() : todayIso < `${month}-01` ? 0 : days;
  const perDay = new Array<number>(days).fill(0);
  for (const t of Array.isArray(transactions) ? transactions : []) {
    if (t.type !== 'EXPENSE' || !t.date.startsWith(month)) continue;
    const day = Number(t.date.slice(8, 10));
    if (day >= 1 && day <= shown) perDay[day - 1] += Math.abs(Number(t.amount) || 0);
  }
  const series: number[] = [];
  let sum = 0;
  for (let i = 0; i < shown; i++) {
    sum += perDay[i];
    series.push(Math.round(sum * 100) / 100);
  }
  return { month, days, series, budget: budget && budget > 0 ? budget : null, current };
}

/**
 * Budget für die Tempo-Linie: Monatsbudget minus Sparbeiträge — dieselbe Grundlage wie „Noch verfügbar“
 * (Budget − ausgegeben − geplant − Sparbeiträge). Mit dem vollen Budget sähe man „weit unter Plan“, obwohl kaum
 * etwas übrig ist. Bleibt nichts für Ausgaben, gibt es keine Linie (null).
 */
export function spendingBudget(total: string | number | null | undefined, saved: string | number | null | undefined): number | null {
  if (total === null || total === undefined) return null;
  const left = (Number(total) || 0) - (Number(saved) || 0);
  return left > 0 ? Math.round(left * 100) / 100 : null;
}

/** Plan-Wert am Tag `day` (1-basiert): gleichmäßig verteiltes Budget. */
export function paceAt(curve: SpendCurve, day: number): number | null {
  return curve.budget === null ? null : Math.round((curve.budget * day * 100) / curve.days) / 100;
}

/** Restliche Tage einschließlich heute — für „etwa … € pro Tag“. 0 bei vergangenen Monaten. */
export function daysLeft(curve: SpendCurve, today = new Date()): number {
  return curve.current ? curve.days - today.getDate() + 1 : 0;
}

export function eur(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

/** Ganze Euro, für kurze Achsen- und Tempo-Angaben („≈ 175 € pro Tag“). */
export function eurRound(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

const MONTH_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
export function dayLabel(month: string, day: number): string {
  return `${day}. ${MONTH_SHORT[Number(month.slice(5, 7)) - 1]}`;
}
