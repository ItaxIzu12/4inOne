import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AppIcon } from '../../shared/icons/app-icon';
import { ReisenApi, Trip, TripReminder, TripTask } from './reisen-api.service';
import {
  STATUS_LABELS,
  STATUS_TONE,
  SuggestionKind,
  activeTripsSummary,
  countdown,
  dateRange,
  dueLabel,
  formatMoney,
  localDay,
  percent,
  reminderIcon,
  shortWhen,
  tripSuggestion,
} from './reisen-logic';
import { TripTarget } from './trip-list';

const LIST_LIMIT = 5;
const LATER_KEY = 'reisen.vorschlag.spaeter';

/** Reiter „Übersicht“: die nächste Reise mit Vorbereitung, ein Reisevorschlag, drei Kennzahlen, die nächsten To-dos
 * und die bevorstehenden Erinnerungen.
 *
 * Keine Doppelungen: To-dos sind offene Reise-Aufgaben ohne Uhrzeit (zum Abhaken); Erinnerungen ist alles mit
 * Uhrzeit sowie Termine und Einträge aus Haushalt und Organisation. Jede Zeile erscheint also nur einmal. */
@Component({
  selector: 'app-trip-overview',
  imports: [AppIcon],
  templateUrl: './trip-overview.html',
  styleUrls: ['./trip-common.scss', './trip-overview.scss'],
})
export class TripOverview {
  private api = inject(ReisenApi);
  private router = inject(Router);
  private destroy = inject(DestroyRef);

  readonly trip = input.required<Trip>();
  readonly trips = input.required<Trip[]>();
  /** Ist die gezeigte Reise die nächste anstehende? Sonst heißt die Karte „Ausgewählte Reise“. */
  readonly isNext = input(true);
  readonly readiness = input(0);
  readonly packed = input(0);
  readonly packingTotal = input(0);
  readonly tasks = input.required<TripTask[]>();
  readonly budgetSpent = input(0);
  readonly budgetTotal = input(0);
  readonly version = input(0);
  readonly canEdit = input(true);
  readonly openTab = output<TripTarget | 'reisen'>();
  readonly toggleTask = output<{ id: number; done: boolean }>();

  readonly labels = STATUS_LABELS;
  readonly tone = STATUS_TONE;
  protected readonly range = dateRange;
  protected readonly icon = reminderIcon;
  protected readonly when = shortWhen;
  readonly today = localDay(new Date());
  readonly reminders = signal<TripReminder[]>([]);
  readonly later = signal<Record<string, string>>(readLater());

  readonly countdownText = computed(() => countdown(this.trip(), this.today));
  readonly tasksOpen = computed(() => this.tasks().filter((t) => t.status === 'OPEN').length);
  readonly budgetPct = computed(() => percent(this.budgetSpent(), this.budgetTotal()));
  readonly active = computed(() => activeTripsSummary(this.trips(), this.today));
  readonly skipped = computed(() => {
    const prefix = `${this.trip().id}:`;
    const kinds = Object.entries(this.later())
      .filter(([key, day]) => key.startsWith(prefix) && day === this.today)
      .map(([key]) => key.slice(prefix.length) as SuggestionKind);
    return new Set(kinds);
  });
  readonly suggestion = computed(() =>
    tripSuggestion(
      this.trip(),
      { packed: this.packed(), packingTotal: this.packingTotal(), tasksOpen: this.tasksOpen(), budgetTotal: this.budgetTotal() },
      this.skipped(),
    ),
  );
  /** Offene Reise-Aufgaben ohne Uhrzeit, nach Datum (ohne Datum zuletzt). */
  readonly todos = computed(() =>
    this.tasks()
      .filter((t) => t.status === 'OPEN' && !t.due_time)
      .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.id - b.id)
      .slice(0, LIST_LIMIT),
  );
  /** Alles mit Termin ab heute — außer den To-dos oben. */
  readonly upcoming = computed(() =>
    this.reminders()
      .filter((r) => !r.done && !!r.date && r.date >= this.today && !(r.source === 'TRIP_TASK' && !r.time))
      .slice(0, LIST_LIMIT),
  );

  constructor() {
    effect(() => {
      const id = this.trip().id;
      this.version();
      untracked(() =>
        this.api
          .reminders(id)
          .pipe(takeUntilDestroyed(this.destroy))
          // Nur Zusatzinformation: ohne sie bleibt die Übersicht nutzbar.
          .subscribe({ next: (r) => this.reminders.set(r?.items ?? []), error: () => this.reminders.set([]) }),
      );
    });
  }

  due(date: string | null) {
    return dueLabel(date, this.today);
  }
  money(value: number): string {
    return formatMoney(value, this.trip().currency, true);
  }
  remindLater() {
    const key = `${this.trip().id}:${this.suggestion().kind}`;
    this.later.update((map) => ({ ...map, [key]: this.today }));
    try {
      localStorage.setItem(LATER_KEY, JSON.stringify(this.later()));
    } catch {
      // ohne Speicher gilt „Später erinnern“ nur für diesen Besuch
    }
  }
  check(task: TripTask) {
    this.toggleTask.emit({ id: task.id, done: true });
  }
  openFinance() {
    void this.router.navigateByUrl(this.router.url.startsWith('/demo') ? '/demo/finanzen' : '/finanzen');
  }
}

function readLater(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(LATER_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
