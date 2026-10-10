import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { Trip } from './reisen-api.service';
import { STATUS_LABELS, STATUS_TONE, formatMoney, groupTrips, localDay, shortRange, tripPhase, whenText } from './reisen-logic';

/** Meine Reisen: Bevorstehend, Vergangen und (eingeklappt) Abgesagt. Eine Karte zeigt nur das Nötigste —
 * Zeitraum, Countdown, Aufgaben, Packliste, Budget — und öffnet die Reise. Ohne Coverbild. */
@Component({
  selector: 'app-trip-list',
  imports: [AppIcon, NgTemplateOutlet],
  templateUrl: './trip-list.html',
  styleUrls: ['./trip-common.scss', './trip-list.scss'],
})
export class TripList {
  readonly trips = input.required<Trip[]>();
  readonly open = output<number>();
  readonly create = output<void>();

  readonly labels = STATUS_LABELS;
  readonly tone = STATUS_TONE;
  protected readonly range = shortRange;
  readonly today = localDay(new Date());
  readonly groups = computed(() => groupTrips(this.trips(), this.today));
  readonly cancelledOpen = signal(false);

  statusClass(trip: Trip): string {
    return `status status--${this.tone[trip.status]}`;
  }
  statusLabel(trip: Trip): string {
    return this.labels[trip.status];
  }
  when(trip: Trip): string {
    return whenText(trip, this.today);
  }
  isOngoing(trip: Trip): boolean {
    return tripPhase(trip, this.today) === 'ongoing';
  }
  money(value: string | number, trip: Trip): string {
    return formatMoney(value, trip.currency, true);
  }
  packText(trip: Trip): string {
    return trip.packing_total ? `${trip.packing_packed} / ${trip.packing_total} gepackt` : 'Keine Packliste';
  }
  tasksText(trip: Trip): string {
    return trip.tasks_open === 0 ? (trip.tasks_total ? 'Alles erledigt' : 'Keine Aufgaben') : trip.tasks_open === 1 ? '1 Aufgabe offen' : `${trip.tasks_open} Aufgaben offen`;
  }
  /** Für Screenreader eine vollständige Zeile statt vieler Einzelteile. */
  label(trip: Trip): string {
    const budget = trip.budget_amount ? `, Budget ${this.money(trip.budget_spent, trip)} von ${this.money(trip.budget_amount, trip)}` : '';
    return `${trip.title}, ${this.range(trip)}, ${this.when(trip)}, ${this.tasksText(trip)}, ${this.packText(trip)}${budget}`;
  }
}
