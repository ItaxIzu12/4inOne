import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ConnectionsSection } from '../../shared/connections/connections-section';
import { AppDatePicker } from '../../shared/form/date-picker';
import { Field } from '../../shared/form/field';
import { AppSelect, SelectOption } from '../../shared/form/select';
import { AppTimePicker } from '../../shared/form/time-picker';
import { ModalForm } from '../../shared/form/modal-form';
import { Effort, Id, MemberLoadDto, Recurrence, TaskDto, TaskInput, TaskPriority, TaskRoom } from './haushalt-api.service';
import { HAUSHALT_DATA_PROVIDER } from './haushalt-data-provider';
import { todayIso } from './haushalt-logic';
import { PRIORITIES, ROOMS } from './aufgaben-logic';

const RECURRENCE_OPTIONS: { value: Recurrence | null; label: string }[] = [
  { value: null, label: 'Einmalig' },
  { value: 'daily', label: 'Täglich' },
  { value: 'weekly', label: 'Wöchentlich' },
  { value: 'monthly', label: 'Monatlich' },
];

export const EFFORT_LABELS: Record<Effort, string> = { 1: 'Klein', 2: 'Mittel', 3: 'Groß' };

/** Was nach dem Speichern passiert ist — die Reiter laden neu und zeigen die Meldung. */
export interface TaskFormChange {
  message: string;
  deletedId?: Id;
}

/**
 * Formular für Aufgaben und Routinen (Anlegen, Bearbeiten, Löschen) — eine
 * gemeinsame Komponente für den Aufgaben- und den Routinen-Reiter, damit es
 * nur eine Aufgabenlogik gibt. Die Reiter öffnen es über openNew()/openEdit()
 * und laden nach (changed) neu.
 */
@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [ConnectionsSection, Field, ModalForm, AppSelect, AppDatePicker, AppTimePicker],
  templateUrl: './task-form.html',
  styleUrls: ['./haushalt-common.scss'],
})
export class TaskForm {
  private readonly provider = inject(HAUSHALT_DATA_PROVIDER);

  readonly members = input<MemberLoadDto[]>([]);
  /** Beschriftung: „Neue Aufgabe“ / „Neue Routine“; Routinen starten wöchentlich. */
  readonly kind = input<'aufgabe' | 'routine'>('aufgabe');
  readonly changed = output<TaskFormChange>();

  protected readonly recurrenceSelectOptions: SelectOption[] = RECURRENCE_OPTIONS.map((o) => ({ value: o.value ?? '', label: o.label }));
  protected readonly assigneeOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Alle / wer Zeit hat' },
    ...this.members().map((m) => ({ value: String(m.user_id), label: m.name })),
  ]);
  protected readonly effortOptions: Effort[] = [1, 2, 3];
  protected readonly effortLabels = EFFORT_LABELS;
  protected readonly roomOptions: SelectOption[] = [{ value: '', label: 'Ohne Raum' }, ...ROOMS.map((r) => ({ value: r.value, label: r.label }))];
  protected readonly priorityOptions = PRIORITIES;

  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<Id | null>(null);
  protected readonly formTitle = signal('');
  protected readonly formDescription = signal('');
  protected readonly formRecurrence = signal<Recurrence | null>(null);
  protected readonly formDue = signal('');
  protected readonly formTime = signal('');
  protected readonly formEffort = signal<Effort>(1);
  protected readonly formRoom = signal<TaskRoom>('');
  protected readonly formDuration = signal('');
  protected readonly formPriority = signal<TaskPriority>('mittel');
  protected readonly formAssignee = signal<Id | null>(null);
  protected readonly formRotate = signal(false);
  protected readonly formRotation = signal<Id[]>([]);
  protected readonly formError = signal<string | null>(null);
  protected readonly formSaving = signal(false);

  protected readonly canRotate = computed(() => this.formRecurrence() !== null && this.members().length >= 2);

  openNew(): void {
    this.editingId.set(null);
    this.formTitle.set('');
    this.formDescription.set('');
    this.formRecurrence.set(this.kind() === 'routine' ? 'weekly' : null);
    this.formTime.set('');
    this.formDue.set(todayIso());
    this.formEffort.set(1);
    this.formRoom.set('');
    this.formDuration.set('');
    this.formPriority.set('mittel');
    this.formAssignee.set(null);
    this.formRotate.set(false);
    this.formRotation.set([]);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  openEdit(task: TaskDto): void {
    this.editingId.set(task.id);
    this.formTitle.set(task.title);
    this.formDescription.set(task.description ?? '');
    this.formRecurrence.set(task.recurrence);
    this.formTime.set(task.due_time ? task.due_time.slice(0, 5) : '');
    this.formDue.set(task.due_date ?? '');
    this.formEffort.set(task.effort);
    this.formRoom.set(task.room ?? '');
    this.formDuration.set(task.duration_minutes ? String(task.duration_minutes) : '');
    this.formPriority.set(task.priority ?? 'mittel');
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
    this.formRecurrence.set(value === '' ? null : (value as Recurrence));
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

  protected submit(): void {
    if (this.formSaving()) return;
    const title = this.formTitle().trim();
    if (!title) {
      this.formError.set('Bitte beschreibe die Aufgabe kurz.');
      return;
    }
    const duration = this.formDuration().trim() ? Number(this.formDuration()) : null;
    if (duration !== null && !(Number.isInteger(duration) && duration >= 1 && duration <= 600)) {
      this.formError.set('Bitte die Dauer in ganzen Minuten angeben (1 bis 600).');
      return;
    }
    const rotate = this.canRotate() && this.formRotate();
    if (rotate && this.formRotation().length < 2) {
      this.formError.set('Für „reihum“ bitte mindestens zwei Personen auswählen.');
      return;
    }
    const input: TaskInput = {
      title,
      description: this.formDescription().trim(),
      recurrence: this.formRecurrence(),
      due_date: this.formDue() || null,
      due_time: this.formDue() && this.formTime() ? this.formTime() : null,
      effort: this.formEffort(),
      room: this.formRoom(),
      duration_minutes: duration,
      priority: this.formPriority(),
      assigned_to: this.formAssignee(),
      rotate,
      rotation_member_ids: rotate ? this.formRotation() : [],
    };
    const id = this.editingId();
    this.formSaving.set(true);
    this.formError.set(null);
    const request = id === null ? this.provider.createTask(input) : this.provider.updateTask(id, input);
    const routine = this.kind() === 'routine';
    request.subscribe({
      next: () => {
        this.formSaving.set(false);
        this.formOpen.set(false);
        this.changed.emit({
          message:
            id === null
              ? routine ? 'Routine angelegt.' : 'Aufgabe angelegt.'
              : routine ? 'Routine gespeichert.' : 'Aufgabe gespeichert.',
        });
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
        this.changed.emit({ message: this.kind() === 'routine' ? 'Routine gelöscht.' : 'Aufgabe gelöscht.', deletedId: id });
      },
      error: () => {
        this.formSaving.set(false);
        this.formError.set('Löschen hat nicht geklappt. Bitte noch einmal versuchen.');
      },
    });
  }
}
