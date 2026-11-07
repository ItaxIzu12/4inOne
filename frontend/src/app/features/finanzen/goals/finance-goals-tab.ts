import { Component, computed, inject } from '@angular/core';
import { LinkHints, connectionHints } from '../../../shared/connections/link-hints';
import { AppIcon } from '../../../shared/icons/app-icon';
import { SavingsGoal } from '../data/private-finance-api.service';
import { FinanceDateNav } from '../shared/finance-date-nav';
import { dayLabel, goalIcon, goalNearlyDone, goalOnTrack, goalPercent, shortMonthYear } from '../shared/finance-tabs';
import { FINANCE_CONTEXT } from '../finance-context';

/** Finanzen › Sparziele: Kopfkarte, Sparziel-Karten und Hinweise.
 * Gemeinsamer Zustand (Monat, Daten, Dialog) über FINANCE_CONTEXT von PrivateFinance; Verhalten unverändert. */
@Component({
  selector: 'app-finance-goals-tab',
  standalone: true,
  imports: [AppIcon, FinanceDateNav, LinkHints],
  templateUrl: './finance-goals-tab.html',
  // Reihenfolge wie vor der Aufteilung: Diagramme, Bausteine, Finanz-Look, späte Bausteine, eigene Regeln
  styleUrls: ['../shared/finance-charts.scss', '../shared/finance-blocks.scss', '../shared/_fin-look.scss', '../shared/finance-blocks-late.scss', './finance-goals-tab.scss'],
})
export class FinanceGoalsTab {
  protected readonly ctx = inject(FINANCE_CONTEXT);
  // Gemeinsame Werte und Aktionen unter ihrem gewohnten Namen (Template unverändert)
  protected readonly section = this.ctx.section;
  protected readonly goals = this.ctx.goals;
  protected readonly contributions = this.ctx.contributions;
  protected readonly money = this.ctx.money;
  protected readonly savedNow = this.ctx.savedNow;
  protected readonly savedDelta = this.ctx.savedDelta;
  protected readonly hints = this.ctx.hints;
  protected readonly goalPercent = this.ctx.goalPercent;
  protected readonly goalIcon = this.ctx.goalIcon;
  protected readonly dayLabel = this.ctx.dayLabel;
  protected readonly eur = this.ctx.eur.bind(this.ctx);
  protected readonly rows = this.ctx.rows;
  protected readonly monthLabel = this.ctx.monthLabel;
  protected readonly Number = Number;
  protected readonly span = this.ctx.span;
  protected readonly plan = this.ctx.plan;
  protected readonly open = this.ctx.open.bind(this.ctx);
  protected readonly amount = this.ctx.amount.bind(this.ctx);

  readonly goalStatus = { ACTIVE: 'Aktiv', COMPLETED: 'Erreicht', PAUSED: 'Pausiert' };
  readonly activeGoals = computed(() => this.ctx.goals().filter((g) => g.status === 'ACTIVE'));
  /** Wofür ein Sparziel gedacht ist („✈ Berlin Wochenende“, „✓ Schuhe vergleichen“) — ein Abruf für alle Ziele. */
  readonly goalLinks = connectionHints('SAVINGS_GOAL', () => this.ctx.goals().map((g) => g.id));
  readonly goalsOnTrack = computed(() => this.activeGoals().filter((g) => goalOnTrack(g, this.ctx.month())).length);
  readonly goalsNearlyDone = computed(() => this.activeGoals().filter(goalNearlyDone).length);
  readonly plannedRate = computed(() =>
    this.activeGoals().reduce((sum, g) => sum + Number(g.monthly_amount ?? 0), 0),
  );
  /** Sparziele: nur Hinweise zu Zielen, die die Karten nicht schon zeigen (fast erreicht, langfristig). */
  readonly goalHints = computed(() => this.ctx.hints().filter((h) => /^(near|long)-/.test(h.key)));
  readonly goalOnTrack = (goal: SavingsGoal) => goalOnTrack(goal, this.ctx.month());
  readonly shortMonthYear = shortMonthYear;
}
