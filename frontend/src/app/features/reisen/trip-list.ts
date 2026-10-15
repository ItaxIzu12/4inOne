import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { Trip } from './reisen-api.service';
import { STATUS_LABELS, STATUS_TONE, formatMoney, groupTrips, localDay, shortRange, tripPhase, whenText } from './reisen-logic';

/** Meine Reisen, auch mit vielen Reisen übersichtlich: „Jetzt unterwegs“ und „Als Nächstes“ als volle Karte
 * (Zeitraum, Countdown, Aufgaben, Packliste, Budget), alle weiteren kommenden und die vergangenen Reisen als kompakte
 * Zeilen; Vergangen zunächst nur die letzten {@link PAST_PREVIEW}, Abgesagt eingeklappt. Ohne Coverbild. */
/** So viele vergangene Reisen sind zunächst sichtbar; der Rest kommt über „Alle anzeigen“. */
const PAST_PREVIEW = 3;

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
  readonly pastOpen = signal(false);

  /** Laufende Reisen (meist eine) — ganz oben, hervorgehoben. */
  readonly ongoing = computed(() => this.groups().upcoming.filter((t) => this.isOngoing(t)));
  /** Kommende Reisen ohne die laufenden: die nächste als Karte, der Rest als Zeilen. */
  private readonly ahead = computed(() => this.groups().upcoming.filter((t) => !this.isOngoing(t)));
  readonly next = computed(() => this.ahead()[0] ?? null);
  readonly later = computed(() => this.ahead().slice(1));
  readonly pastShown = computed(() => (this.pastOpen() ? this.groups().past : this.groups().past.slice(0, PAST_PREVIEW)));
  readonly pastHidden = computed(() => this.groups().past.length - this.pastShown().length);

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
  money(value: string | number, trip: Trip): string {
    return formatMoney(value, trip.currency, true);
  }
  packText(trip: Trip): string {
    return trip.packing_total ? `${trip.packing_packed} / ${trip.packing_total} gepackt` : 'Keine Packliste';
  }
  tasksText(trip: Trip): string {
    return trip.tasks_open === 0 ? (trip.tasks_total ? 'Alles erledigt' : 'Keine Aufgaben') : trip.tasks_open === 1 ? '1 Aufgabe offen' : `${trip.tasks_open} Aufgaben offen`;
  }
  /** Kurzform für die kompakte Zeile: nur, was noch zu tun ist. */
  openText(trip: Trip): string {
    if (this.isPast(trip)) return ''; // vorbei: offene Punkte sind nur noch Rauschen
    const parts: string[] = [];
    if (trip.tasks_open) parts.push(trip.tasks_open === 1 ? '1 Aufgabe offen' : `${trip.tasks_open} Aufgaben offen`);
    if (trip.packing_total && trip.packing_packed < trip.packing_total) parts.push(`${trip.packing_packed}/${trip.packing_total} gepackt`);
    return parts.join(' · ');
  }
  /** Für Screenreader eine vollständige Zeile statt vieler Einzelteile. */
  label(trip: Trip): string {
    const budget = trip.budget_amount ? `, Budget ${this.money(trip.budget_spent, trip)} von ${this.money(trip.budget_amount, trip)}` : '';
    return `${trip.title}, ${this.range(trip)}, ${this.when(trip)}, ${this.tasksText(trip)}, ${this.packText(trip)}${budget}`;
  }
}
