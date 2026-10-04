import { Type } from '@angular/core';
import { IconName } from '../../shared/icons/app-icon';
import { CATEGORY_ICON_MAP, DEFAULT_CATEGORY_ICON_KEY } from '../../shared/icons/category-icon.map';
import { FinanceSummary, FinanceTransaction } from './private-finance-api.service';

/**
 * Reine Rechenhilfen für die Finanz-Übersicht (private-finance.html, Tab
 * „Übersicht“). Keine Signale, kein HTTP — damit sie einzeln testbar sind.
 */

/** Tage, die im Monat `month` („JJJJ-MM“) ab `today` noch bleiben, heute
 * mitgezählt. Vergangene Monate: 0, zukünftige: alle Tage des Monats. */
export function daysLeftInMonth(month: string, today: Date = new Date()): number {
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const current = today.getFullYear() * 12 + today.getMonth();
  const selected = year * 12 + (mon - 1);
  if (selected < current) return 0;
  if (selected > current) return daysInMonth;
  return daysInMonth - today.getDate() + 1;
}

/** Der Betrag vor und nach dem Komma, damit die Cents kleiner gesetzt
 * werden können: „1.695,70 €“ → { whole: '1.695', rest: ',70 €' }. */
export function splitAmount(formatted: string): { whole: string; rest: string } {
  const comma = formatted.lastIndexOf(',');
  return comma === -1 ? { whole: formatted, rest: '' } : { whole: formatted.slice(0, comma), rest: formatted.slice(comma) };
}

export interface BandSegment {
  key: string;
  label: string;
  amount: number;
  /** Anteil an der Bandbreite in Prozent. */
  share: number;
  color: string;
  kind: 'category' | 'saved' | 'free';
}

/** „Wohin das Monatsbudget geht“: jede Ausgabenkategorie in ihrer Farbe,
 * dann das für Sparziele Zurückgelegte, dann der freie Rest. Wird das Budget
 * überschritten, ist das Band so breit wie alles Verbrauchte — es läuft nie
 * über 100 %. Ohne Monatsbudget gibt es kein Band (leere Liste). */
export function budgetBand(summary: FinanceSummary | null): BandSegment[] {
  if (!summary || summary.total === null) return [];
  const total = Number(summary.total);
  const saved = Number(summary.saved);
  const categories = summary.categories.map((c) => ({ ...c, value: Number(c.amount) })).filter((c) => c.value > 0);
  const spent = categories.reduce((sum, c) => sum + c.value, 0);
  const free = Math.max(0, total - spent - saved);
  const width = Math.max(total, spent + saved);
  if (width <= 0) return [];
  const share = (value: number) => (value / width) * 100;
  const segments: BandSegment[] = categories.map((c) => ({
    key: `cat-${c.id ?? c.name}`,
    label: c.name,
    amount: c.value,
    share: share(c.value),
    color: c.color,
    kind: 'category',
  }));
  if (saved > 0) {
    segments.push({ key: 'saved', label: 'Sparziele', amount: saved, share: share(saved), color: '', kind: 'saved' });
  }
  if (free > 0) {
    segments.push({ key: 'free', label: 'Frei', amount: free, share: share(free), color: '', kind: 'free' });
  }
  return segments;
}

export interface DayGroup {
  date: string;
  label: string;
  /** Saldo des Tages: Einnahmen positiv, Ausgaben negativ. */
  total: number;
  rows: FinanceTransaction[];
}

/** Buchungen wie auf einem Kontoauszug nach Tag gruppiert, Reihenfolge der
 * Eingabe bleibt erhalten (das Backend liefert die neuesten zuerst). */
export function groupByDay(rows: FinanceTransaction[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const row of rows) {
    let group = groups.find((g) => g.date === row.date);
    if (!group) {
      group = { date: row.date, label: dayLabel(row.date), total: 0, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
    group.total += (row.type === 'INCOME' ? 1 : -1) * Number(row.amount);
  }
  return groups;
}

export function dayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d));
}

/** Monat um `delta` verschieben, „JJJJ-MM“ rein und raus. */
export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number);
  const index = year * 12 + (mon - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Icon einer Kategorie nach ihrem Namen — aus dem vorhandenen Icon-System
 * der App (app-icon bzw. die Kategorie-Icons), keine zweite Bibliothek.
 * Unbekannte Namen bekommen das neutrale „Sonstiges“-Etikett. */
export type CategoryVisual = { app: IconName } | { component: Type<unknown> };

const BY_NAME: Record<string, CategoryVisual> = {
  wohnen: { component: CATEGORY_ICON_MAP['fixkosten'] },
  miete: { component: CATEGORY_ICON_MAP['fixkosten'] },
  lebensmittel: { app: 'basket' },
  einkauf: { app: 'basket' },
  mobilität: { component: CATEGORY_ICON_MAP['transport'] },
  auto: { component: CATEGORY_ICON_MAP['transport'] },
  freizeit: { component: CATEGORY_ICON_MAP['freizeit'] },
  gesundheit: { component: CATEGORY_ICON_MAP['gesundheit'] },
  reisen: { app: 'travel' },
  urlaub: { app: 'travel' },
  geschenke: { component: CATEGORY_ICON_MAP['geschenke'] },
  bildung: { component: CATEGORY_ICON_MAP['bildung'] },
};

export function categoryVisual(name: string | null | undefined): CategoryVisual {
  return BY_NAME[(name ?? '').trim().toLocaleLowerCase('de')] ?? { component: CATEGORY_ICON_MAP[DEFAULT_CATEGORY_ICON_KEY] };
}
