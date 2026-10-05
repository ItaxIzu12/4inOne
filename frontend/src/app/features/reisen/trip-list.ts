import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { AppSelect, SelectOption } from '../../shared/form/select';
import { Trip } from './reisen-api.service';
import { buildTripReadiness } from './trip-readiness';
import {
  PeriodFilter,
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_TONE,
  TRANSPORT_LABELS,
  TripSort,
  dateRange,
  filterTrips,
  initials,
  localDay,
  nights,
  peopleLabel,
  percent,
  sortTrips,
  transportIcon,
  tripDays,
  tripIcon,
} from './reisen-logic';

export type TripTarget = 'packlisten' | 'budget' | 'erinnerungen';

/** Reiter „Reisen“: Filter, Liste und die Details der gewählten Reise (auf dem Handy als Blatt von unten). */
@Component({
  selector: 'app-trip-list',
  imports: [AppIcon, AppSelect],
  templateUrl: './trip-list.html',
  styleUrls: ['./trip-common.scss', './trip-list.scss'],
})
export class TripList {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly trips = input.required<Trip[]>();
  readonly selectedId = input<number | null>(null);
  readonly select = output<number>();
  readonly newTrip = output<void>();
  readonly edit = output<Trip>();
  readonly participants = output<Trip>();
  readonly openTab = output<TripTarget>();

  readonly labels = STATUS_LABELS;
  readonly tone = STATUS_TONE;
  readonly transportLabels = TRANSPORT_LABELS;
  protected readonly icon = tripIcon;
  protected readonly range = dateRange;
  protected readonly initials = initials;
  protected readonly peopleLabel = peopleLabel;
  protected readonly days = tripDays;
  protected readonly nights = nights;
  protected readonly transportIcon = transportIcon;
  protected readonly percent = percent;

  readonly status = signal('');
  readonly period = signal<PeriodFilter>('');
  readonly person = signal('');
  readonly sort = signal<TripSort>('date-asc');
  readonly filtersOpen = signal(false);
  readonly sheetOpen = signal(false);
  readonly menuOpen = signal(false);

  readonly statusOptions: SelectOption[] = [{ value: '', label: 'Alle Status' }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))];
  readonly periodOptions: SelectOption[] = [
    { value: '', label: 'Alle Zeiträume' },
    { value: 'upcoming', label: 'Bevorstehend' },
    { value: 'this-year', label: 'Dieses Jahr' },
    { value: 'past', label: 'Vergangen' },
  ];
  readonly sortOptions: SelectOption[] = [
    { value: 'date-asc', label: 'Reisedatum (aufsteigend)' },
    { value: 'date-desc', label: 'Reisedatum (absteigend)' },
    { value: 'title', label: 'Titel (A–Z)' },
    { value: 'updated', label: 'Zuletzt geändert' },
  ];
  /** Alle Mitreisenden aus allen Reisen, für den Filter „Teilnehmer“. */
  readonly personOptions = computed<SelectOption[]>(() => {
    const names = [...new Set(this.trips().flatMap((t) => t.participants.map((p) => p.display_name)))].sort((a, b) => a.localeCompare(b, 'de'));
    return [{ value: '', label: 'Alle Teilnehmer' }, ...names.map((n) => ({ value: n, label: n }))];
  });
  readonly shown = computed(() =>
    sortTrips(
      filterTrips(this.trips(), { status: this.status() as Trip['status'] | '', period: this.period(), person: this.person() }, localDay(new Date())),
      this.sort(),
    ),
  );
  readonly hasFilters = computed(() => !!(this.status() || this.period() || this.person()));
  /** Die gewählte Reise, solange sie in der gefilterten Liste steht — sonst die erste sichtbare. */
  readonly current = computed(() => {
    const list = this.shown();
    return list.find((t) => t.id === this.selectedId()) ?? list[0] ?? null;
  });

  readiness(trip: Trip): number {
    return buildTripReadiness(trip).percent;
  }
  budgetPct(trip: Trip): number {
    return percent(Number(trip.budget_spent), Number(trip.budget_amount || 0));
  }
  money(value: string | number, trip: Trip): string {
    const amount = Number(value);
    const text = amount.toLocaleString('de-DE', { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 });
    return trip.currency === 'EUR' ? `${text} €` : `${text} ${trip.currency}`;
  }
  open(trip: Trip) {
    this.select.emit(trip.id);
    this.menuOpen.set(false);
    this.sheetOpen.set(true);
    // Auf dem Handy liegt das Blatt über der Liste: den Fokus mitnehmen (am Rechner ist der Schließen-Knopf versteckt).
    setTimeout(() => {
      const close = this.host.nativeElement.querySelector<HTMLElement>('.detail.is-open .sheet-close');
      if (close && close.offsetParent) close.focus();
    });
  }
  closeSheet() {
    this.sheetOpen.set(false);
    this.menuOpen.set(false);
  }
  resetFilters() {
    this.status.set('');
    this.period.set('');
    this.person.set('');
  }
  go(target: TripTarget, trip: Trip) {
    this.select.emit(trip.id);
    this.sheetOpen.set(false);
    this.openTab.emit(target);
  }
  menu(action: 'edit' | 'participants', trip: Trip) {
    this.menuOpen.set(false);
    this.sheetOpen.set(false);
    if (action === 'edit') this.edit.emit(trip);
    else this.participants.emit(trip);
  }
}
