import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { Component, computed, inject, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AppIcon } from '../../shared/icons/app-icon';
import { HaushaltOverviewDto, Id, ShoppingItemDto, TaskDto } from './haushalt-api.service';
import { HAUSHALT_DATA_PROVIDER } from './haushalt-data-provider';
import { relativeDay, todayIso } from './haushalt-logic';
import {
  EFFORT_LABEL,
  doneToday,
  nextDue,
  routineFrequency,
  routineIcon,
} from './uebersicht-logic';
import { contractState, euro, formatDate } from './vertraege-logic';

export type HaushaltTabKey = 'uebersicht' | 'aufgaben' | 'ordner' | 'einkauf' | 'routinen';

/** So viele Einträge zeigt jede Karte; der Rest steht im jeweiligen Reiter. */
const ROWS = 5;
const SHOPPING_ROWS = 8;

/**
 * Übersicht des Haushalts: vier Kennzahlen als Einstieg in die Reiter, darunter
 * „Heute im Haushalt“, Verträge, Einkauf und Routinen. Die Daten kommen aus
 * drei vorhandenen Antworten (Übersicht, Aufgaben, Einkaufsliste) — kein eigener
 * Endpunkt, keine erfundenen Werte.
 */
@Component({
  selector: 'app-uebersicht-tab',
  standalone: true,
  imports: [ErrorNoticeDirective, AppIcon],
  templateUrl: './uebersicht-tab.html',
  styleUrls: ['./haushalt-common.scss', './haushalt-stats.scss', './uebersicht-tab.scss'],
})
export class UebersichtTab {
  private readonly provider = inject(HAUSHALT_DATA_PROVIDER);
  readonly saved = output<string>();
  readonly openTab = output<HaushaltTabKey>();

  protected readonly overview = signal<HaushaltOverviewDto | null>(null);
  protected readonly tasks = signal<TaskDto[]>([]);
  protected readonly items = signal<ShoppingItemDto[]>([]);
  protected readonly loadError = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly completing = signal<Id | null>(null);
  protected readonly toggling = signal<Id | null>(null);

  protected readonly relativeDay = relativeDay;
  protected readonly effortLabel = EFFORT_LABEL;
  protected readonly contractState = contractState;
  protected readonly euro = euro;
  protected readonly formatDate = formatDate;
  protected readonly routineIcon = routineIcon;
  protected readonly routineFrequency = routineFrequency;
  protected readonly doneToday = doneToday;
  protected readonly nextDue = nextDue;

  // ---------- Kennzahlen ----------
  protected readonly routines = computed(() =>
    this.tasks()
      .filter((t) => !!(t.recurrence_days || t.recurrence_months))
      .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')),
  );
  protected readonly routinesOverdue = computed(() => this.routines().filter((t) => t.is_overdue).length);
  protected readonly openItems = computed(() => this.items().filter((i) => !i.is_checked).length);

  // ---------- Karten ----------
  /** Überfällige und heute fällige Aufgaben; ohne solche die nächsten anstehenden. */
  protected readonly todayTasks = computed(() => {
    const data = this.overview();
    if (!data) return [];
    return (data.today.length ? data.today : data.upcoming).slice(0, ROWS);
  });
  protected readonly showsUpcoming = computed(() => !!this.overview() && this.overview()!.today.length === 0);
  protected readonly shopping = computed(() => this.items().slice(0, SHOPPING_ROWS));
  protected readonly shoppingDone = computed(() => this.items().filter((i) => i.is_checked).length);
  protected readonly routineRows = computed(() => this.routines().slice(0, 3));

  constructor() {
    this.load();
  }

  protected load(): void {
    forkJoin({
      overview: this.provider.getOverview(),
      tasks: this.provider.getTasks(),
      shopping: this.provider.getShopping(),
    }).subscribe({
      next: ({ overview, tasks, shopping }) => {
        this.overview.set(overview);
        this.tasks.set(tasks);
        this.items.set(shopping.items);
        this.loadError.set(false);
      },
      error: () => this.loadError.set(true),
    });
  }

  /** Wie im Aufgaben-Tab: erst heute oder überfällig lässt sich abhaken. */
  protected notYetDue(task: TaskDto): boolean {
    return !!task.due_date && task.due_date > todayIso();
  }

  protected dueChip(task: TaskDto): string {
    if (!task.due_date) return 'Ohne Datum';
    if (task.is_overdue) return 'Überfällig';
    const day = relativeDay(task.due_date);
    return day.charAt(0).toUpperCase() + day.slice(1);
  }

  protected complete(task: TaskDto): void {
    if (this.completing() !== null) return;
    this.completing.set(task.id);
    this.actionError.set(null);
    this.provider.completeTask(task.id).subscribe({
      next: () => {
        this.completing.set(null);
        this.load();
        this.saved.emit(`„${task.title}“ erledigt.`);
      },
      error: () => {
        this.completing.set(null);
        this.actionError.set(`„${task.title}“ konnte nicht abgehakt werden. Bitte noch einmal versuchen.`);
      },
    });
  }

  protected toggleItem(item: ShoppingItemDto): void {
    if (this.toggling() !== null) return;
    this.toggling.set(item.id);
    this.actionError.set(null);
    this.provider.updateItem(item.id, { is_checked: !item.is_checked }).subscribe({
      next: (updated) => {
        this.toggling.set(null);
        this.items.update((items) => items.map((i) => (i.id === updated.id ? updated : i)));
      },
      error: () => {
        this.toggling.set(null);
        this.actionError.set(`„${item.name}“ konnte nicht abgehakt werden. Bitte noch einmal versuchen.`);
      },
    });
  }
}
