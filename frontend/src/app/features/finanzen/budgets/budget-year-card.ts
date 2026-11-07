import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MONTH_NAMES, MONTH_SHORT } from '../../../shared/form/date-utils';
import { AppIcon } from '../../../shared/icons/app-icon';
import { eur, eurRound } from '../../../shared/spend-curve/spend-curve-data';
import { FinanceYearSummary } from '../data/private-finance-api.service';

/** Wie ein Monat im Jahresbild erscheint. */
export type YearTone = 'held' | 'over' | 'free' | 'empty' | 'current' | 'future';

export interface YearBar {
  month: string;
  name: string;
  short: string;
  letter: string;
  tone: YearTone;
  /** Höhen in % der höchsten Säule (0 = nichts zeichnen): Monatsbudget, Ausgaben und darauf die Sparbeiträge —
   * das Budget deckt beides, deshalb stehen beide in der Säule (wie bei „Noch verfügbar“). */
  plan: number;
  fill: number;
  save: number;
  label: string;
}

const TONE_TEXT: Record<YearTone, string> = {
  held: 'im Budget geblieben',
  over: 'Budget überschritten',
  free: 'ohne Monatsbudget',
  empty: 'keine Buchungen',
  current: 'läuft gerade',
  future: 'geplant',
};

/** Ein Monat aus summary/year/ → Säule. Bewertet werden nur abgeschlossene Monate mit Budget und Buchungen. */
export function yearBars(data: FinanceYearSummary): YearBar[] {
  const rows = data.months.map((m) => ({
    ...m,
    b: m.budget === null ? null : Number(m.budget),
    e: Number(m.expenses ?? 0),
    s: Math.max(0, Number(m.saved ?? 0)),
  }));
  const max = Math.max(1, ...rows.map((r) => Math.max(r.b ?? 0, r.e + r.s)));
  return rows.map((r) => {
    const index = Number(r.month.slice(5, 7)) - 1;
    const tone: YearTone =
      r.state === 'future' ? 'future'
      : r.state === 'current' ? 'current'
      : !r.has_data ? 'empty'
      : r.b === null || r.available === null ? 'free'
      : Number(r.available) >= 0 ? 'held'
      : 'over';
    const name = `${MONTH_NAMES[index]} ${data.year}`;
    const parts = [name];
    if (r.state !== 'future' && r.has_data) parts.push(`${eur(r.e)} ausgegeben`);
    if (r.state !== 'future' && r.s > 0) parts.push(`${eur(r.s)} für Sparziele`);
    if (r.b !== null) parts.push(`Budget ${eur(r.b)}`);
    if (tone === 'over' && r.available !== null) parts.push(`um ${eur(-Number(r.available))} überschritten`);
    else parts.push(TONE_TEXT[tone]);
    return {
      month: r.month,
      name: MONTH_NAMES[index],
      short: MONTH_SHORT[index],
      letter: MONTH_NAMES[index][0],
      tone,
      plan: r.b === null ? 0 : Math.round((r.b / max) * 100),
      fill: r.state === 'future' ? 0 : Math.round((r.e / max) * 100),
      save: r.state === 'future' ? 0 : Math.round((r.s / max) * 100),
      label: parts.join(', '),
    };
  });
}

/** Kopf der Karte: große Zahl (Ausgaben bisher), dazu die Sparbeiträge — beides zusammen steht gegen das Jahresbudget —
 * und wie viele abgeschlossene Monate gehalten haben. */
export interface YearLead {
  /** „7.401 €“ — leer, wenn das Jahr ganz in der Zukunft liegt. */
  amount: string;
  of: string;
  verdict: string;
  /** Alle bewerteten Monate gehalten (oder noch keiner bewertet). */
  ok: boolean;
}
export function yearLead(data: FinanceYearSummary): YearLead {
  const bars = yearBars(data);
  const spent = data.months.reduce((s, m) => s + Number(m.expenses ?? 0), 0);
  const saved = data.months.reduce((s, m) => s + Math.max(0, Number(m.saved ?? 0)), 0);
  const plus = saved > 0 ? `, dazu ${eurRound(saved)} für Sparziele` : '';
  const budget = data.months.reduce((s, m) => s + Number(m.budget ?? 0), 0);
  const judged = bars.filter((b) => b.tone === 'held' || b.tone === 'over');
  const held = judged.filter((b) => b.tone === 'held').length;
  const planned = data.months.filter((m) => m.budget !== null).length;
  if (data.months.every((m) => m.state === 'future')) {
    return {
      amount: '',
      of: planned ? `${planned} von 12 Monaten mit Budget geplant` : 'Für dieses Jahr ist noch kein Budget geplant',
      verdict: '',
      ok: true,
    };
  }
  return {
    amount: eurRound(spent),
    of: budget > 0 ? `ausgegeben${plus ? `${plus} –` : ''} von ${eurRound(budget)} Jahresbudget` : `bisher ausgegeben${plus}`,
    verdict: judged.length
      ? `In ${held} von ${judged.length} ${judged.length === 1 ? 'Monat' : 'Monaten'} im Budget geblieben`
      : 'Noch kein abgeschlossener Monat mit Budget',
    ok: held === judged.length,
  };
}

/**
 * „Dein Jahr“ im Budgets-Reiter: zwölf Säulen — Tönung = Monatsbudget, Füllung = Ausgaben, darauf die Sparbeiträge. Abgeschlossene Monate grün
 * (gehalten) oder rot (überschritten, gleiche Rechnung wie „Noch verfügbar“), der laufende Monat in Finanzgrün hell,
 * künftige nur als Umriss. Eine Säule antippen zeigt diesen Monat; bearbeitet wird im Jahres-Dialog.
 */
@Component({
  selector: 'app-budget-year-card',
  standalone: true,
  imports: [AppIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './budget-year-card.html',
  styleUrl: './budget-year-card.scss',
})
export class BudgetYearCard {
  readonly data = input.required<FinanceYearSummary>();
  /** Der gerade angezeigte Monat („JJJJ-MM“). */
  readonly selected = input.required<string>();
  readonly monthPick = output<string>();
  readonly edit = output<void>();

  protected readonly bars = computed(() => yearBars(this.data()));
  protected readonly lead = computed(() => yearLead(this.data()));
  protected readonly hasFree = computed(() => this.bars().some((b) => b.tone === 'free'));
}
