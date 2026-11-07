import { Component, computed, inject } from '@angular/core';
import { isInCalendarWeek } from '../../../shared/dates/calendar-week';
import { AppDatePicker } from '../../../shared/form/date-picker';
import { AppIcon } from '../../../shared/icons/app-icon';
import { FinancePeriod, addDays, customRangeError, weekTitle } from '../overview/finance-periods';
import { shiftMonth } from './finance-overview';
import { FINANCE_CONTEXT } from '../finance-context';

/** Datumsauswahl unter den Reitern (Tag, Woche, Monat, eigener Zeitraum) — in jedem Reiter an derselben Stelle.
 * Gemeinsamer Zustand (Monat, Daten, Dialog) über FINANCE_CONTEXT von PrivateFinance; Verhalten unverändert. */
@Component({
  selector: 'app-finance-date-nav',
  standalone: true,
  imports: [AppDatePicker, AppIcon],
  templateUrl: './finance-date-nav.html',
  // Reihenfolge wie vor der Aufteilung: Diagramme, Bausteine, Finanz-Look, späte Bausteine, eigene Regeln
  styleUrls: ['./finance-charts.scss', './finance-blocks.scss', './finance-blocks-late.scss', './finance-date-nav.scss'],
})
export class FinanceDateNav {
  protected readonly ctx = inject(FINANCE_CONTEXT);
  // Gemeinsame Werte und Aktionen unter ihrem gewohnten Namen (Template unverändert)
  protected readonly period = this.ctx.period;
  protected readonly periodDay = this.ctx.periodDay;
  protected readonly periodRange = this.ctx.periodRange;
  protected readonly month = this.ctx.month;
  protected readonly error = this.ctx.error;
  protected readonly span = this.ctx.span;
  protected readonly range = this.ctx.range;
  protected readonly setMonth = this.ctx.setMonth.bind(this.ctx);

  /** Welche Datumsauswahl oben steht: in der Übersicht folgt sie dem Zeitraum, sonst immer der Monat. */
  readonly navMode = computed<FinancePeriod>(() => (this.ctx.tab() === 'overview' ? this.ctx.period() : 'month'));
  /** Zurück zum aktuellen Zeitraum der Ansicht — nur, wenn man ihn verlassen hat (wie im Organisation-Kalender):
   * „Aktueller Tag“, „Aktuelle Woche“ (Mo–So) oder „Aktueller Monat“. Der eigene Zeitraum hat keinen. */
  readonly jumpLabel = computed(() => {
    switch (this.navMode()) {
      case 'day':
        return this.ctx.periodDay() !== this.ctx.todayDay ? 'Aktueller Tag' : '';
      case 'week':
        return isInCalendarWeek(this.ctx.periodDay(), this.ctx.todayDay) ? '' : 'Aktuelle Woche';
      case 'month':
        return this.ctx.month() !== this.ctx.todayDay.slice(0, 7) ? 'Aktueller Monat' : '';
      default:
        return '';
    }
  });
  jumpToCurrent() {
    if (this.navMode() === 'month') this.ctx.setMonth(this.ctx.todayDay.slice(0, 7));
    else this.setDay(this.ctx.todayDay);
  }
  readonly weekLabel = computed(() => weekTitle(this.ctx.periodDay()));
  readonly rangeIssue = computed(() => (this.navMode() === 'custom' ? customRangeError(this.ctx.periodRange()) : null));
  stepPeriod(delta: number) {
    this.setDay(addDays(this.ctx.periodDay(), this.ctx.period() === 'week' ? delta * 7 : delta));
  }
  /** Tag und Woche teilen sich mit dem Monat EIN Bezugsdatum: wandert der Tag in einen anderen Monat,
   * folgt der Monat (Budgets, Transaktionen, Sparziele zeigen dann diesen Monat). */
  setDay(day: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    this.ctx.periodDay.set(day);
    if (day.slice(0, 7) !== this.ctx.month()) this.ctx.setMonth(day.slice(0, 7), false);
  }
  setRangeFrom(value: string) {
    this.ctx.periodRange.update((r) => ({ ...r, from: value }));
  }
  setRangeTo(value: string) {
    this.ctx.periodRange.update((r) => ({ ...r, to: value }));
  }
  stepMonth(delta: number) {
    this.ctx.setMonth(shiftMonth(this.ctx.month(), delta));
  }
}
