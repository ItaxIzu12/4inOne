import { Component, computed, effect, input, model, output, signal, untracked } from '@angular/core';

/** Ab so vielen Terminen zeigt die Agenda zunächst nur einen Teil. */
const AGENDA_LIMIT = 10;
import { AppIcon } from '../../shared/icons/app-icon';
import { isInCalendarWeek } from '../../shared/dates/calendar-week';
import { DayRange, PersonalEvent } from './organisation-api.service';
import { dayWord, endTime, eventCategory, eventsOn, gridRange, localDay, longDay, monthGrid, startTime, timeRange, weekOf } from './organisation-logic';

export type CalendarView = 'day' | 'week' | 'month';

const SHORT_WEEKDAY = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/**
 * Kalender: Tag · Woche · Monat auf denselben Termindaten und einem gemeinsamen Bezugsdatum. Rechts (am Handy
 * darunter) die Agenda des gewählten Tags. Am Handy zeigt die Woche einen
 * Tagesstreifen statt sieben schmaler Spalten, der Monat nur Punkte. Der
 * Kalender meldet den sichtbaren Zeitraum (rangeChange) — die Hülle lädt nur
 * diesen, nie Jahre.
 */
@Component({
  selector: 'app-org-calendar',
  standalone: true,
  imports: [AppIcon],
  templateUrl: './org-calendar.html',
  styleUrls: ['./org-common.scss', './org-calendar.scss'],
})
export class OrgCalendar {
  readonly events = input<PersonalEvent[]>([]);
  readonly loading = input(false);
  readonly selectedDay = model(localDay(new Date()));
  readonly view = model<CalendarView>(
    typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches ? 'day' : 'month',
  );
  readonly openEvent = output<PersonalEvent>();
  readonly addEvent = output<string>();
  /** Monatsansicht: Klick auf einen Tag legt direkt einen Termin an diesem Tag an. */
  readonly addEventOnDay = output<string>();
  readonly rangeChange = output<DayRange>();

  protected readonly views: { key: CalendarView; label: string }[] = [
    { key: 'day', label: 'Tag' },
    { key: 'week', label: 'Woche' },
    { key: 'month', label: 'Monat' },
  ];
  protected readonly weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  protected readonly todayKey = localDay(new Date());

  protected readonly month = computed(() => {
    const d = new Date(`${this.selectedDay()}T12:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  /** Zeitraum, der geladen sein muss: Monatsraster (6 Wochen) oder die Woche des Tags. */
  protected readonly range = computed<DayRange>(() => {
    if (this.view() === 'month') return gridRange(this.month());
    const days = weekOf(this.selectedDay());
    return { start: days[0], end: days[6] };
  });
  protected readonly grid = computed(() => monthGrid(this.month(), this.events()));
  protected readonly week = computed(() =>
    weekOf(this.selectedDay()).map((day) => ({ day, events: eventsOn(this.events(), day) })),
  );
  protected readonly dayEvents = computed(() => eventsOn(this.events(), this.selectedDay()));
  protected readonly title = computed(() => {
    const day = new Date(`${this.selectedDay()}T12:00`);
    if (this.view() === 'month') return day.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    if (this.view() === 'week') {
      const days = weekOf(this.selectedDay());
      const [a, b] = [new Date(`${days[0]}T12:00`), new Date(`${days[6]}T12:00`)];
      const left = a.toLocaleDateString('de-DE', { day: 'numeric', month: a.getMonth() === b.getMonth() ? undefined : 'short' });
      return `${left} – ${b.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return day.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  });
  /** Agenda des Zeitraums: Heute = der Tag, Woche = alle Tage der Woche, Monat = alle Tage des Monats —
   * nach Tagen gruppiert, nur Tage mit Terminen (Heute zeigt den Tag auch leer). */
  protected readonly agendaDays = computed(() => {
    const view = this.view();
    if (view === 'day') return [{ day: this.selectedDay(), events: eventsOn(this.events(), this.selectedDay()) }];
    const days =
      view === 'week'
        ? weekOf(this.selectedDay())
        : this.grid().filter((d) => !d.outside).map((d) => d.key);
    return days.map((day) => ({ day, events: eventsOn(this.events(), day) })).filter((g) => g.events.length);
  });
  /** Im laufenden Monat sind vergangene Tage zunächst eingeklappt. */
  protected readonly showPast = signal(false);
  protected readonly showAll = signal(false);
  protected readonly pastDays = computed(() =>
    this.view() === 'month' && this.selectedDay().slice(0, 7) === this.todayKey.slice(0, 7)
      ? this.agendaDays().filter((g) => g.day < this.todayKey)
      : [],
  );
  protected readonly pastCount = computed(() => this.pastDays().reduce((n, g) => n + g.events.length, 0));
  /** Sichtbare Gruppen: ohne eingeklappte Vergangenheit, gekürzt auf AGENDA_LIMIT Termine (ganze Tage). */
  protected readonly shownDays = computed(() => {
    const groups = this.showPast() ? this.agendaDays() : this.agendaDays().filter((g) => !this.pastDays().includes(g));
    if (this.showAll() || this.view() === 'day') return groups;
    const shown: typeof groups = [];
    let count = 0;
    for (const g of groups) {
      if (count >= AGENDA_LIMIT) break;
      shown.push(g);
      count += g.events.length;
    }
    return shown;
  });
  protected readonly hiddenCount = computed(() => {
    const visible = this.showPast() ? this.agendaDays() : this.agendaDays().filter((g) => !this.pastDays().includes(g));
    const total = visible.reduce((n, g) => n + g.events.length, 0);
    return total - this.shownDays().reduce((n, g) => n + g.events.length, 0);
  });
  protected readonly agendaHeading = computed(() => {
    if (this.view() === 'day') return this.dayHeading();
    if (this.view() === 'week') return isInCalendarWeek(this.selectedDay(), this.todayKey) ? 'Termine dieser Woche' : `Termine ${this.title()}`;
    return `Termine im ${this.month().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;
  });
  protected readonly emptyPeriod = computed(() =>
    this.view() === 'week' ? 'Keine Termine in dieser Woche.' : this.view() === 'month' ? 'Keine Termine in diesem Monat.' : 'Keine Termine an diesem Tag.',
  );
  protected readonly dayHeading = computed(() => {
    const word = dayWord(this.selectedDay());
    return word === 'Heute' || word === 'Morgen' ? `${word}, ${longDay(this.selectedDay())}` : longDay(this.selectedDay());
  });
  /** Zurück zum aktuellen Zeitraum der Ansicht — nur, wenn man ihn verlassen hat:
   * „Aktueller Tag“, „Aktuelle Woche“ (Mo–So) oder „Aktueller Monat“. */
  protected readonly jumpLabel = computed(() => {
    const day = this.selectedDay();
    if (this.view() === 'day') return day !== this.todayKey ? 'Aktueller Tag' : '';
    if (this.view() === 'week') return isInCalendarWeek(day, this.todayKey) ? '' : 'Aktuelle Woche';
    return day.slice(0, 7) !== this.todayKey.slice(0, 7) ? 'Aktueller Monat' : '';
  });
  protected readonly empty = computed(() => !this.loading() && this.events().length === 0);

  protected readonly timeRange = timeRange;
  protected readonly startTime = startTime;
  protected readonly endTime = endTime;
  protected readonly category = eventCategory;
  protected readonly longDay = longDay;

  constructor() {
    // Neuer Zeitraum: Liste wieder kurz und Vergangenheit eingeklappt.
    effect(() => {
      this.view();
      this.month();
      untracked(() => {
        this.showPast.set(false);
        this.showAll.set(false);
      });
    });
    let last = '';
    effect(() => {
      const range = this.range();
      const key = `${range.start}/${range.end}`;
      if (key === last) return;
      last = key;
      untracked(() => this.rangeChange.emit(range));
    });
  }

  /** Ansicht wechseln: Tag, Woche und Monat teilen sich EIN Bezugsdatum (selectedDay) — man zoomt nur
   * hinein oder heraus und bleibt, wo man ist. Zurück zu heute führt „Aktueller …“. */
  protected setView(view: CalendarView): void {
    this.view.set(view);
  }

  /** Tag wählen; in Woche und Monat springt die Agenda zu diesem Tag (und klappt ihn bei Bedarf auf). */
  protected select(day: string): void {
    this.selectedDay.set(day);
    if (this.view() === 'day') return;
    if (day < this.todayKey) this.showPast.set(true);
    if (!this.shownDays().some((g) => g.day === day)) this.showAll.set(true);
    setTimeout(() => document.getElementById(`agenda-${day}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  /** Monat: Tag wählen und gleich einen Termin für ihn anlegen. */
  protected pickDay(day: string): void {
    this.select(day);
    this.addEventOnDay.emit(day);
  }

  protected groupLabel(day: string): string {
    const word = dayWord(day);
    const date = new Date(`${day}T12:00`).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
    return word === 'Heute' || word === 'Morgen' ? `${word} · ${date}` : date;
  }

  /** Pfeile: Tag, Woche oder Monat weiter — je nach Ansicht. */
  protected step(delta: number): void {
    const d = new Date(`${this.selectedDay()}T12:00`);
    if (this.view() === 'month') {
      // im laufenden Monat landet man bei heute, sonst beim 1.
      const next = localDay(new Date(d.getFullYear(), d.getMonth() + delta, 1));
      this.selectedDay.set(next.slice(0, 7) === this.todayKey.slice(0, 7) ? this.todayKey : next);
      return;
    }
    d.setDate(d.getDate() + delta * (this.view() === 'week' ? 7 : 1));
    this.selectedDay.set(localDay(d));
  }

  protected goToday(): void {
    this.selectedDay.set(this.todayKey);
  }

  protected weekday(day: string): string {
    return SHORT_WEEKDAY[new Date(`${day}T12:00`).getDay()];
  }

  /** Name für Screenreader: „Dienstag, 6. Oktober 2026, 2 Termine“. */
  protected dayLabel(day: string, count: number): string {
    return `${longDay(day)}${count ? `, ${count} ${count === 1 ? 'Termin' : 'Termine'}` : ', keine Termine'}`;
  }

  protected repeatHint(e: PersonalEvent): string {
    return e.recurrence ? { daily: 'täglich', weekly: 'wöchentlich', monthly: 'monatlich', yearly: 'jährlich' }[e.recurrence] : '';
  }
}
