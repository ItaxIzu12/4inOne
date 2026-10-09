import { Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppIcon } from '../../shared/icons/app-icon';
import { ScopeNote } from '../../shared/scope-note/scope-note';
import { PersonalTask } from './organisation-api.service';
import { REPEAT_LABEL, TASK_VIEWS, TaskView, filterTasks, isRecurring, localDay, taskDue } from './organisation-logic';

/**
 * Aufgaben: Alle · Heute · Überfällig · Wiederkehrend · Erledigt (mit Anzahl),
 * darüber eine Suche. Neue Aufgaben kommen über „Aufgabe hinzufügen“ im Kopf.
 * Eine klare Liste statt Tabelle: Haken, Titel, darunter Fälligkeit · Priorität ·
 * Wiederholung. Bearbeiten und Abhaken übernimmt die Hülle (organisation.ts).
 */
@Component({
  selector: 'app-org-tasks',
  standalone: true,
  imports: [AppIcon, RouterLink, ScopeNote],
  templateUrl: './org-tasks.html',
  styleUrls: ['./org-common.scss', './org-tasks.scss'],
})
export class OrgTasks {
  readonly tasks = input<PersonalTask[]>([]);
  readonly busy = input(false);
  readonly openTask = output<PersonalTask>();
  readonly toggleTask = output<PersonalTask>();
  readonly addTask = output<void>();

  protected readonly views = TASK_VIEWS;
  protected readonly view = signal<TaskView>('all');
  /** Suche über Titel, Beschreibung und Projekt — innerhalb der gewählten Ansicht. */
  protected readonly search = signal('');
  protected readonly visible = computed(() => {
    const q = this.search().trim().toLocaleLowerCase('de');
    return filterTasks(this.tasks(), this.view()).filter(
      (t) => !q || `${t.title}\n${t.description}\n${t.project ?? ''}`.toLocaleLowerCase('de').includes(q),
    );
  });
  protected readonly counts = computed(() => {
    const result = {} as Record<TaskView, number>;
    for (const v of TASK_VIEWS) result[v.key] = filterTasks(this.tasks(), v.key).length;
    return result;
  });
  protected readonly priorities = { LOW: 'Niedrig', MEDIUM: 'Normal', HIGH: 'Hoch' } as const;
  protected readonly repeatLabel = REPEAT_LABEL;
  protected readonly isRecurring = isRecurring;
  protected readonly today = localDay(new Date());

  protected readonly emptyText = computed(() => {
    if (!this.tasks().length) return null;
    if (this.search().trim()) return `Keine Aufgabe passt zu „${this.search().trim()}“.`;
    return {
      all: 'Keine offenen Aufgaben – alles erledigt.',
      today: 'Heute ist nichts fällig.',
      overdue: 'Nichts überfällig.',
      recurring: 'Keine wiederkehrenden Aufgaben.',
      done: 'Noch nichts erledigt.',
    }[this.view()];
  });

  /** „Heute · Hoch · Wöchentlich“ — nur, was etwas aussagt (Normal-Priorität fällt weg). */
  protected meta(task: PersonalTask): { due: string; late: boolean; parts: string[] } {
    const due = taskDue(task);
    const parts: string[] = [];
    if (task.priority !== 'MEDIUM') parts.push(this.priorities[task.priority]);
    if (isRecurring(task)) parts.push(REPEAT_LABEL[task.repeat ?? 'custom'] ?? 'Wiederkehrend');
    if (task.project) parts.push(task.project);
    if (task.status === 'IN_PROGRESS') parts.push('In Bearbeitung');
    return { due: task.due_date ? due.text : '', late: due.late, parts };
  }
}
