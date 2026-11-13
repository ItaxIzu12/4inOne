import { Component, computed, input, output } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { Trip, TripEvent } from './reisen-api.service';
import { EVENT_KIND_META, eventIcon, eventTime, itinerary, localDay } from './reisen-logic';

/**
 * Reise › Ablauf (12.11.2026): jeder Reisetag als Abschnitt, darin die Programmpunkte nach Uhrzeit – Zugfahrt,
 * Check-in, Führung, Restaurant – mit Ort und Notiz (Buchungsnummer, Gleis, Platz). Freie Tage bleiben sichtbar
 * („Noch nichts geplant“), damit man sieht, wo noch Luft ist. Was vor oder nach der Reise liegt, steht gesammelt
 * davor bzw. danach. Selbst eingetragen, keine Buchungs-APIs (REISEN_V1.md › Bewusst nicht in V1).
 */
@Component({
  selector: 'app-trip-itinerary',
  imports: [AppIcon],
  templateUrl: './trip-itinerary.html',
  styleUrls: ['./trip-common.scss', './trip-itinerary.scss'],
})
export class TripItinerary {
  readonly trip = input.required<Trip>();
  readonly events = input.required<TripEvent[]>();
  readonly canEdit = input(true);
  /** Neuer Programmpunkt, vorbelegt mit dem Tag („YYYY-MM-DD“), an dem man „Hinzufügen“ gewählt hat. */
  readonly add = output<string>();
  readonly edit = output<TripEvent>();

  readonly today = localDay(new Date());
  protected readonly kindMeta = EVENT_KIND_META;
  protected readonly time = eventTime;
  readonly days = computed(() => itinerary(this.trip(), this.events(), this.today));
  readonly planned = computed(() => this.days().filter((d) => d.tripDay && d.events.length).length);
  readonly tripDayCount = computed(() => this.days().filter((d) => d.tripDay).length);

  icon(event: TripEvent) {
    return eventIcon(event.kind, this.trip().transport_type);
  }
  /** „Ort · Notiz“ – nur, was eingetragen ist. */
  meta(event: TripEvent): string {
    return [event.location, event.note].filter((v) => v?.trim()).join(' · ');
  }
}
