import { Component, computed, input, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { Trip, TripParticipant, TripTask } from './reisen-api.service';
import { TRANSPORT_LABELS, TaskView, dueLabel, filterTasks, initials, localDay, planningTips } from './reisen-logic';

const ROLE_LABELS: Record<TripParticipant['role'], string> = { OWNER: 'Besitzer', EDITOR: 'Bearbeiter', VIEWER: 'Betrachter' };

/** Reise › Planung: Aufgaben dieser Reise (Offen / Erledigt / Meine), Teilnehmer, Transport und Unterkunft sowie
 * wenige allgemeine Hinweise. Erinnerungen sind hier einfach Aufgaben mit Datum und Uhrzeit — keine zweite Welt. */
@Component({
  selector: 'app-trip-planning',
  imports: [AppIcon],
  templateUrl: './trip-planning.html',
  styleUrls: ['./trip-common.scss', './trip-planning.scss'],
})
export class TripPlanning {
  readonly trip = input.required<Trip>();
  readonly tasks = input.required<TripTask[]>();
  readonly canEdit = input(true);
  readonly busy = input(false);
  readonly quickAdd = output<string>();
  /** Vollständiges Formular (Datum, Uhrzeit, zuständig) — mit dem schon getippten Titel. */
  readonly addTask = output<string>();
  readonly editTask = output<TripTask>();
  readonly toggleTask = output<TripTask>();
  readonly manageParticipants = output<void>();
  readonly suggest = output<void>();

  readonly today = localDay(new Date());
  readonly transportLabels = TRANSPORT_LABELS;
  readonly roleLabels = ROLE_LABELS;
  protected readonly initials = initials;
  readonly view = signal<TaskView>('open');
  readonly draft = signal('');

  /** Eigene Nutzer-ID aus der eigenen Teilnehmerzeile — für „Meine“. */
  readonly me = computed(() => this.trip().participants.find((p) => p.is_self)?.user ?? null);
  readonly shared = computed(() => this.trip().participants.length > 1);
  readonly openCount = computed(() => this.tasks().filter((t) => t.status === 'OPEN').length);
  readonly doneCount = computed(() => this.tasks().length - this.openCount());
  readonly mineCount = computed(() => filterTasks(this.tasks(), 'mine', this.me()).length);
  readonly shown = computed(() => filterTasks(this.tasks(), this.view(), this.me()));
  readonly tips = computed(() => planningTips(this.trip()));

  due(task: TripTask): { text: string; urgent: boolean } {
    const d = dueLabel(task.due_date, this.today);
    return task.due_time && task.due_date ? { ...d, text: `${d.text}, ${task.due_time.slice(0, 5)}` } : d;
  }
  addWithDetails(): void {
    this.addTask.emit(this.draft().trim());
    this.draft.set('');
  }
  /** Auch per Enter im Feld (siehe einkauf-tab submitNew): nicht vom Zustand des gesperrten Knopfs abhängig. */
  submit(event: Event): void {
    event.preventDefault();
    const input = (event.target as HTMLElement).closest('form')?.querySelector<HTMLInputElement>('#trip-task-quick');
    const title = (input?.value ?? this.draft()).trim();
    if (!title || this.busy()) return;
    // Ausdrücklich leeren (siehe einkauf-tab submitNew).
    if (input) input.value = '';
    this.quickAdd.emit(title);
    this.draft.set('');
    this.view.set('open');
  }
}
