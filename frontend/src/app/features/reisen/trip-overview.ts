import { Component, computed, input, output } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { ConnectionsSection } from '../../shared/connections/connections-section';
import { Trip, TripTask } from './reisen-api.service';
import { TRANSPORT_LABELS, cancellationInfo, dueLabel, filterTasks, formatMoney, initials, localDay, nights, peopleLabel, percent, transportIcon, tripDays, tripPhase } from './reisen-logic';
import { TripPass } from './trip-pass';

export type TripTab = 'uebersicht' | 'ablauf' | 'planung' | 'packliste' | 'budget';

/** So viele offene Aufgaben zeigt „Bis zur Abreise“; der Rest steht in der Planung. */
const NEXT_TASKS = 4;

/**
 * Reise › Übersicht („Von hier nach dort“, 31.10.2026): oben die Bordkarte (Abreise → Ziel, Tage bis zur Abreise,
 * gezählte Vorbereitung, Marken in die Reiter). Darunter links „Bis zur Abreise“ — die nächsten offenen Aufgaben
 * auf einer Linie bis zur Abreise-Marke —, rechts Packliste (Ring), Budget (was übrig ist) und wer mitreist. Zuletzt
 * „Gehört zu dieser Reise“ (Verknüpfungen mit Terminen, Aufgaben, Sparzielen und Haushalt, samt Vorschlägen) und
 * die Reisedetails. Konkrete Zahlen statt eines erfundenen Scores; jede Karte führt in ihren Reiter.
 */
@Component({
  selector: 'app-trip-overview',
  imports: [AppIcon, ConnectionsSection, TripPass],
  templateUrl: './trip-overview.html',
  styleUrls: ['./trip-common.scss', './trip-overview.scss'],
})
export class TripOverview {
  readonly trip = input.required<Trip>();
  readonly tasks = input<TripTask[]>([]);
  readonly packed = input(0);
  readonly packingTotal = input(0);
  readonly tasksOpen = input(0);
  readonly tasksTotal = input(0);
  readonly budgetSpent = input(0);
  readonly budgetTotal = input(0);
  readonly canEdit = input(true);
  readonly openTab = output<TripTab>();
  /** Reise-Dialog öffnen (z. B. um die Stornofrist einzutragen). */
  readonly editTrip = output<void>();

  readonly today = localDay(new Date());
  readonly transportLabels = TRANSPORT_LABELS;
  protected readonly initials = initials;
  readonly phase = computed(() => tripPhase(this.trip(), this.today));
  readonly length = computed(() => {
    const days = tripDays(this.trip());
    const n = nights(this.trip());
    return `${days === 1 ? '1 Tag' : days + ' Tage'}${n ? ' · ' + (n === 1 ? '1 Nacht' : n + ' Nächte') : ''}`;
  });
  readonly people = computed(() => this.trip().participants);
  readonly peopleText = computed(() => peopleLabel(this.people().length || 1));
  readonly packPct = computed(() => percent(this.packed(), this.packingTotal()));
  readonly budgetPct = computed(() => percent(this.budgetSpent(), this.budgetTotal()));
  readonly budgetLeft = computed(() => this.budgetTotal() - this.budgetSpent());
  readonly transportIcon = computed(() => transportIcon(this.trip().transport_type));

  /** Die nächsten offenen Aufgaben; „vor der Abreise“ bis zum ersten Reisetag, danach „unterwegs“. */
  readonly nextTasks = computed(() =>
    filterTasks(this.tasks(), 'open', null)
      .slice(0, NEXT_TASKS)
      .map((task) => ({ task, due: dueLabel(task.due_date, this.today), during: !!task.due_date && task.due_date >= this.trip().start_date })),
  );
  readonly moreTasks = computed(() => Math.max(0, this.tasksOpen() - NEXT_TASKS));
  /** Wo die Abreise-Marke in der Linie steht: vor der ersten Aufgabe, die in die Reise fällt oder kein Datum hat. */
  readonly departIndex = computed(() => {
    const i = this.nextTasks().findIndex((n) => n.during || !n.task.due_date);
    return i === -1 ? this.nextTasks().length : i;
  });
  readonly departLabel = computed(() =>
    new Date(`${this.trip().start_date}T12:00`).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }),
  );
  readonly hasDetails = computed(() => {
    const t = this.trip();
    return !!(t.departure || t.accommodation || t.transport_type || t.transport_note || t.notes || t.free_cancellation_until);
  });
  readonly cancellation = computed(() => cancellationInfo(this.trip(), this.today));

  money(value: number): string {
    return formatMoney(value, this.trip().currency, true);
  }
}
