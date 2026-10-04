import { Component, computed, input, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { PersonalEvent, PersonalNote, PersonalTask, TodayItem } from './organisation-api.service';
import {
  editedAt,
  eventCategory,
  groupTasks,
  localDay,
  monthGrid,
  nextDays,
  noteLines,
  taskDue,
  timeRange,
  weekdayDay,
} from './organisation-logic';

type Tab = 'overview' | 'calendar' | 'tasks' | 'notes' | 'files';

/**
 * Übersicht nach Entwurf: „Heute“ (Termine und fällige Aufgaben), „Nächste
 * Termine“ nach Tag, ein kleiner Monatskalender, „Offene Aufgaben“ und
 * „Letzte Notizen“. Zeigt nur — Öffnen und Abhaken meldet sie der Hülle.
 */
@Component({
  selector: 'app-org-overview',
  standalone: true,
  imports: [AppIcon],
  templateUrl: './org-overview.html',
  styleUrls: ['./org-common.scss', './org-overview.scss'],
})
export class OrgOverview {
  readonly events = input<PersonalEvent[]>([]);
  readonly tasks = input<PersonalTask[]>([]);
  readonly notes = input<PersonalNote[]>([]);
  readonly todayItems = input<TodayItem[]>([]);
  readonly openEvent = output<PersonalEvent>();
  readonly openTask = output<PersonalTask>();
  readonly toggleTask = output<PersonalTask>();
  readonly openNote = output<PersonalNote>();
  readonly showTab = output<Tab>();

  protected readonly todayLabel = new Date().toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  /** Nur was heute ansteht (Überfälliges steht unter „Offene Aufgaben“), höchstens fünf. */
  protected readonly todayList = computed(() => this.todayItems().filter((i) => !i.overdue).slice(0, 5));
  protected readonly next = computed(() => nextDays(this.events()));
  /** Offene Aufgaben in Reihenfolge der Dringlichkeit (überfällig, heute, Woche, später, ohne Datum). */
  protected readonly openTasks = computed(() => groupTasks(this.tasks()).flatMap((g) => g.tasks).slice(0, 5));
  protected readonly recentNotes = computed(() => this.notes().slice(0, 3));

  // Kleiner Monatskalender
  protected readonly month = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  protected readonly monthLabel = computed(() => this.month().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }));
  protected readonly days = computed(() => monthGrid(this.month(), this.events()));
  protected readonly weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  protected readonly timeRange = timeRange;
  protected readonly category = eventCategory;
  protected readonly taskDue = taskDue;
  protected readonly noteLines = noteLines;
  protected readonly editedAt = editedAt;
  protected readonly weekdayDay = weekdayDay;

  protected changeMonth(delta: number): void {
    const m = this.month();
    this.month.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  protected eventFor(item: TodayItem): PersonalEvent | undefined {
    return item.kind === 'event' ? this.events().find((e) => e.id === item.id) : undefined;
  }

  protected taskFor(item: TodayItem): PersonalTask | undefined {
    return item.kind === 'task' ? this.tasks().find((t) => t.id === item.id) : undefined;
  }

  protected openItem(item: TodayItem): void {
    const event = this.eventFor(item);
    if (event) return this.openEvent.emit(event);
    const task = this.taskFor(item);
    if (task) this.openTask.emit(task);
  }

  protected itemTime(item: TodayItem): { from: string; to: string } {
    const event = this.eventFor(item);
    if (event) {
      const [from, to] = timeRange(event).split(' – ');
      return { from, to: to ?? '' };
    }
    if (item.overdue) return { from: 'Fällig', to: '' };
    return { from: item.all_day ? 'Heute' : item.at.slice(11, 16), to: '' };
  }

  protected isToday(day: string): boolean {
    return day === localDay(new Date());
  }
}
