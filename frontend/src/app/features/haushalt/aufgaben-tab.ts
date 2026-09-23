import { Component, computed, inject, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Modal } from '../../shared/modal/modal';
import { Effort, Id, MemberLoadDto, TaskDto, TaskInput } from './haushalt-api.service';
import { HAUSHALT_DATA_PROVIDER } from './haushalt-data-provider';
import { daysUntil, recurrenceLabel, relativeDay, todayIso } from './haushalt-logic';

interface TaskGroup {
  key: string;
  label: string;
  tasks: TaskDto[];
}

const RECURRENCE_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Einmalig' },
  { value: 1, label: 'Täglich' },
  { value: 3, label: 'Alle 3 Tage' },
  { value: 7, label: 'Wöchentlich' },
  { value: 14, label: 'Alle 2 Wochen' },
  { value: 30, label: 'Monatlich' },
];

const EFFORT_LABELS: Record<Effort, string> = { 1: 'Klein', 2: 'Mittel', 3: 'Groß' };

/**
 * Haushaltsaufgaben mit fairer Verteilung: wiederkehrende Aufgaben wechseln
 * auf Wunsch reihum die zuständige Person, jede Erledigung zählt Aufwands-
 * punkte (klein 1 · mittel 2 · groß 3) für die Lastanzeige "Wer macht wie
 * viel". Aufgaben mit Datum stehen automatisch im gemeinsamen Kalender
 * (backend haushalt/services.py sync_task_event).
 */
@Component({
  selector: 'app-aufgaben-tab',
  standalone: true,
  imports: [Modal],
  templateUrl: './aufgaben-tab.html',
  styleUrls: ['./haushalt-common.scss', './aufgaben-tab.scss'],
})
export class AufgabenTab {
  private readonly provider = inject(HAUSHALT_DATA_PROVIDER);
  readonly saved = output<string>();

  protected readonly tasks = signal<TaskDto[] | null>(null);
  protected readonly members = signal<MemberLoadDto[]>([]);
  protected readonly loadError = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly completing = signal<Id | null>(null);

  protected readonly recurrenceOptions = RECURRENCE_OPTIONS;
  protected readonly effortOptions: Effort[] = [1, 2, 3];
  protected readonly effortLabels = EFFORT_LABELS;
  protected readonly relativeDay = relativeDay;
  protected readonly recurrenceLabel = recurrenceLabel;

  protected readonly groups = computed<TaskGroup[]>(() => {
    const tasks = this.tasks() ?? [];
    const groups: TaskGroup[] = [
      { key: 'overdue', label: 'Überfällig', tasks: [] },
      { key: 'today', label: 'Heute', tasks: [] },
      { key: 'week', label: 'Nächste 7 Tage', tasks: [] },
      { key: 'later', label: 'Später', tasks: [] },
      { key: 'undated', label: 'Ohne Datum', tasks: [] },
    ];
    for (const task of tasks) {
      if (!task.due_date) groups[4].tasks.push(task);
      else {
        const days = daysUntil(task.due_date);
        groups[days < 0 ? 0 : days === 0 ? 1 : days <= 7 ? 2 : 3].tasks.push(task);
      }
    }
    return groups.filter((group) => group.tasks.length > 0);
  });

  protected readonly totalPoints = computed(() => this.members().reduce((sum, m) => sum + m.points, 0));
  protected readonly maxPoints = computed(() => Math.max(1, ...this.members().map((m) => m.points)));

  // ---------- Formular ----------
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<Id | null>(null);
  protected readonly formTitle = signal('');
  protected readonly formRecurrence = signal<number | null>(null);
  protected readonly formDue = signal('');
  protected readonly formEffort = signal<Effort>(1);
  protected readonly formAssignee = signal<Id | null>(null);
  protected readonly formRotate = signal(false);
  protected readonly formRotation = signal<Id[]>([]);
  protected readonly formError = signal<string | null>(null);
  protected readonly formSaving = signal(false);

  protected readonly canRotate = computed(() => this.formRecurrence() !== null && this.members().length >= 2);

  constructor() {
    this.load();
  }

  protected load(): void {
    forkJoin({ tasks: this.provider.getTasks(), members: this.provider.getTaskLoad() }).subscribe({
      next: ({ tasks, members }) => {
        this.tasks.set(tasks);
        this.members.set(members);
        this.loadError.set(false);
      },
      error: () => this.loadError.set(true),
    });
  }

  private reloadLoad(): void {
    this.provider.getTaskLoad().subscribe({ next: (members) => this.members.set(members), error: () => undefined });
  }

  protected metaLine(task: TaskDto): string {
    const parts = [recurrenceLabel(task.recurrence_days)];
    if (task.assigned_to_name) parts.push(task.rotate ? `${task.assigned_to_name} (reihum)` : task.assigned_to_name);
    else parts.push('alle');
    parts.push(`Aufwand ${EFFORT_LABELS[task.effort].toLowerCase()}`);
    return parts.join(' · ');
  }

  protected complete(task: TaskDto): void {
    if (this.completing() !== null) return;
    this.completing.set(task.id);
    this.actionError.set(null);
    this.provider.completeTask(task.id).subscribe({
      next: (updated) => {
        this.completing.set(null);
        this.tasks.update((tasks) =>
          (tasks ?? [])
            .map((t) => (t.id === task.id ? updated : t))
            .filter((t) => !t.is_done)
            .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')),
        );
        this.reloadLoad();
        if (updated.is_done) {
          this.saved.emit(`„${task.title}“ erledigt.`);
        } else {
          const next = updated.due_date ? relativeDay(updated.due_date) : '';
          const who = updated.assigned_to_name && updated.rotate ? ` · ${updated.assigned_to_name} ist dran` : '';
          this.saved.emit(`„${task.title}“ erledigt · wieder fällig ${next}${who}.`);
        }
      },
      error: () => {
        this.completing.set(null);
        this.actionError.set(`„${task.title}“ konnte nicht abgehakt werden. Bitte noch einmal versuchen.`);
      },
    });
  }

  // ---------- Formular ----------

  protected openNew(): void {
    this.editingId.set(null);
    this.formTitle.set('');
    this.formRecurrence.set(null);
    this.formDue.set(todayIso());
    this.formEffort.set(1);
    this.formAssignee.set(null);
    this.formRotate.set(false);
    this.formRotation.set([]);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(task: TaskDto): void {
    this.editingId.set(task.id);
    this.formTitle.set(task.title);
    this.formRecurrence.set(task.recurrence_days);
    this.formDue.set(task.due_date ?? '');
    this.formEffort.set(task.effort);
    this.formAssignee.set(task.assigned_to);
    this.formRotate.set(task.rotate);
    this.formRotation.set([...task.rotation_member_ids]);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
  }

  protected setRecurrence(value: string): void {
    this.formRecurrence.set(value === '' ? null : Number(value));
    if (value === '') this.formRotate.set(false);
  }

  protected setAssignee(value: string): void {
    const member = this.members().find((m) => String(m.user_id) === value);
    this.formAssignee.set(member ? member.user_id : null);
  }

  protected toggleRotate(checked: boolean): void {
    this.formRotate.set(checked);
    if (checked && this.formRotation().length === 0) {
      // Vorauswahl: alle Mitglieder — der häufigste Fall.
      this.formRotation.set(this.members().map((m) => m.user_id));
    }
  }

  protected toggleRotationMember(id: Id, checked: boolean): void {
    this.formRotation.update((ids) => (checked ? [...ids, id] : ids.filter((existing) => existing !== id)));
  }

  protected isInRotation(id: Id): boolean {
    return this.formRotation().includes(id);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.formSaving()) return;
    const title = this.formTitle().trim();
    if (!title) {
      this.formError.set('Bitte beschreibe die Aufgabe kurz.');
      return;
    }
    const rotate = this.canRotate() && this.formRotate();
    if (rotate && this.formRotation().length < 2) {
      this.formError.set('Für „reihum“ bitte mindestens zwei Personen auswählen.');
      return;
    }
    const input: TaskInput = {
      title,
      recurrence_days: this.formRecurrence(),
      due_date: this.formDue() || null,
      effort: this.formEffort(),
      assigned_to: this.formAssignee(),
      rotate,
      rotation_member_ids: rotate ? this.formRotation() : [],
    };
    const id = this.editingId();
    this.formSaving.set(true);
    this.formError.set(null);
    const request = id === null ? this.provider.createTask(input) : this.provider.updateTask(id, input);
    request.subscribe({
      next: () => {
        this.formSaving.set(false);
        this.formOpen.set(false);
        this.load();
        this.saved.emit(id === null ? 'Aufgabe angelegt.' : 'Aufgabe gespeichert.');
      },
      error: () => {
        this.formSaving.set(false);
        this.formError.set('Speichern hat nicht geklappt. Bitte Eingaben prüfen und noch einmal versuchen.');
      },
    });
  }

  protected deleteEditing(): void {
    const id = this.editingId();
    if (id === null || this.formSaving()) return;
    this.formSaving.set(true);
    this.provider.deleteTask(id).subscribe({
      next: () => {
        this.formSaving.set(false);
        this.formOpen.set(false);
        this.tasks.update((tasks) => (tasks ?? []).filter((t) => t.id !== id));
        this.saved.emit('Aufgabe gelöscht.');
      },
      error: () => {
        this.formSaving.set(false);
        this.formError.set('Löschen hat nicht geklappt. Bitte noch einmal versuchen.');
      },
    });
  }
}
