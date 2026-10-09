import { Component, computed, input, output } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { Trip } from './reisen-api.service';
import { TRANSPORT_LABELS, formatMoney, initials, localDay, nights, peopleLabel, percent, tripDays, tripPhase, whenText } from './reisen-logic';

export type TripTab = 'uebersicht' | 'planung' | 'packliste' | 'budget';

/** Reise › Übersicht: „Wie weit bin ich mit dieser Reise?“ — konkrete Zahlen statt eines erfundenen Scores, und die
 * wichtigsten Eckdaten. Keine Kopie der anderen Reiter: jede Kachel führt dorthin. */
@Component({
  selector: 'app-trip-overview',
  imports: [AppIcon],
  templateUrl: './trip-overview.html',
  styleUrls: ['./trip-common.scss', './trip-overview.scss'],
})
export class TripOverview {
  readonly trip = input.required<Trip>();
  readonly packed = input(0);
  readonly packingTotal = input(0);
  readonly tasksOpen = input(0);
  readonly tasksTotal = input(0);
  readonly budgetSpent = input(0);
  readonly budgetTotal = input(0);
  readonly canEdit = input(true);
  readonly openTab = output<TripTab>();

  readonly today = localDay(new Date());
  readonly transportLabels = TRANSPORT_LABELS;
  protected readonly initials = initials;
  readonly when = computed(() => whenText(this.trip(), this.today));
  readonly live = computed(() => tripPhase(this.trip(), this.today) === 'ongoing');
  readonly length = computed(() => {
    const days = tripDays(this.trip());
    const n = nights(this.trip());
    return `${days === 1 ? '1 Tag' : days + ' Tage'}${n ? ' · ' + (n === 1 ? '1 Nacht' : n + ' Nächte') : ''}`;
  });
  readonly people = computed(() => this.trip().participants);
  readonly peopleText = computed(() => peopleLabel(this.people().length || 1));
  readonly packPct = computed(() => percent(this.packed(), this.packingTotal()));
  readonly budgetPct = computed(() => percent(this.budgetSpent(), this.budgetTotal()));
  readonly hasDetails = computed(() => {
    const t = this.trip();
    return !!(t.departure || t.accommodation || t.transport_type || t.transport_note || t.notes);
  });

  money(value: number): string {
    return formatMoney(value, this.trip().currency, true);
  }
}
