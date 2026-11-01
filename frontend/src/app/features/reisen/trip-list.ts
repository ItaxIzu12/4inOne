import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { Trip } from './reisen-api.service';
import { STATUS_LABELS, STATUS_TONE, groupTrips, localDay, packingShare, placeParts, shortRange, tripPhase, whenText } from './reisen-logic';
import { TripPass } from './trip-pass';

const MONTH_ABBR = ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'];

/** Meine Reisen („Von hier nach dort“, 31.10.2026): die laufende bzw. nächste Reise als Bordkarte in der Reisefarbe,
 * alle weiteren kommenden als Karten mit Kalenderblatt, Countdown und Vorbereitung, daneben „Neue Reise“. Vergangene
 * als kompakte Zeilen (zunächst die letzten {@link PAST_PREVIEW}), Abgesagt eingeklappt. Ohne Coverbild — es gibt
 * keine echten Bilder je Reise, und ein Stockfoto würde etwas vortäuschen. */
/** So viele vergangene Reisen sind zunächst sichtbar; der Rest kommt über „Alle anzeigen“. */
const PAST_PREVIEW = 3;

@Component({
  selector: 'app-trip-list',
  imports: [AppIcon, NgTemplateOutlet, TripPass],
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
  readonly pastOpen = signal(false);

  /** Laufende Reisen (meist eine) — ganz oben, hervorgehoben. */
  readonly ongoing = computed(() => this.groups().upcoming.filter((t) => this.isOngoing(t)));
  /** Kommende Reisen ohne die laufenden: die nächste als Karte, der Rest als Zeilen. */
  private readonly ahead = computed(() => this.groups().upcoming.filter((t) => !this.isOngoing(t)));
  readonly next = computed(() => this.ahead()[0] ?? null);
  readonly later = computed(() => this.ahead().slice(1));
  readonly pastShown = computed(() => (this.pastOpen() ? this.groups().past : this.groups().past.slice(0, PAST_PREVIEW)));
  readonly pastHidden = computed(() => this.groups().past.length - this.pastShown().length);

  /** Kalenderblatt: Monat (Kürzel) und Tag des ersten Reisetags. */
  leaf(trip: Trip): { month: string; day: number } {
    const [, m, d] = trip.start_date.split('-').map(Number);
    return { month: MONTH_ABBR[m - 1], day: d };
  }
  place(trip: Trip): string {
    return placeParts(trip.destination).place || trip.destination;
  }
  /** Packliste der Karte — getrennt von den Aufgaben (die stehen als Text daneben). */
  packing(trip: Trip) {
    return packingShare(trip.packing_packed, trip.packing_total);
  }
  statusClass(trip: Trip): string {
    return `status status--${this.tone[trip.status]}`;
  }
  statusLabel(trip: Trip): string {
    return this.labels[trip.status];
  }
  when(trip: Trip): string {
    return whenText(trip, this.today);
  }
  isPast(trip: Trip): boolean {
    return tripPhase(trip, this.today) === 'past';
  }
  isOngoing(trip: Trip): boolean {
    return tripPhase(trip, this.today) === 'ongoing';
  }
}
