import { Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppIcon } from '../../shared/icons/app-icon';
import { LinkHints, connectionHints } from '../../shared/connections/link-hints';
import { ScopeNote } from '../../shared/scope-note/scope-note';
import { PersonalTask } from './organisation-api.service';
import { REPEAT_LABEL, TASK_VIEWS, TaskGrouping, TaskView, filterTasks, groupTaskList, isRecurring, localDay, taskDue } from './organisation-logic';

const GROUPING_KEY = '4io-org-aufgaben-gruppe';

/**
 * Aufgaben: Alle · Heute · Überfällig · Wiederkehrend · Erledigt (mit Anzahl),
 * darüber eine Suche. „Alle“ und „Wiederkehrend“ sind gegliedert — nach Tag oder
 * nach Projekt (gemerkt pro Gerät). Abhaken zeigt kurz Haken und Durchstreichen. Neue Aufgaben kommen über „Aufgabe hinzufügen“ im Kopf.
 * Eine klare Liste statt Tabelle: Haken, Titel, darunter Fälligkeit · Priorität ·
 * Wiederholung. Bearbeiten und Abhaken übernimmt die Hülle (organisation.ts).
 */
@Component({
  selector: 'app-org-tasks',
  standalone: true,
  imports: [AppIcon, LinkHints, RouterLink, ScopeNote],
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
  /** Gliederung nur, wo die Liste mehrere Fälligkeiten mischt; Projekt-Wahl nur, wenn es Projekte gibt. */
  protected readonly grouping = signal<TaskGrouping>(readGrouping());
  protected readonly hasProjects = computed(() => this.tasks().some((t) => !!t.project?.trim()));
  protected readonly groups = computed(() => {
    const view = this.view();
    const by = this.hasProjects() ? this.grouping() : 'day';
    if (view === 'all' || view === 'recurring') return groupTaskList(this.visible(), by);
    return this.visible().length ? [{ key: view, label: '', late: false, tasks: this.visible() }] : [];
  });
  protected setGrouping(by: TaskGrouping): void {
    this.grouping.set(by);
    try {
      localStorage.setItem(GROUPING_KEY, by);
    } catch {
      /* ohne Speicher bleibt die Wahl nur für diesen Besuch */
    }
  }

  /** Gerade abgehakt: Haken und Durchstreichen kurz zeigen, dann erst speichern. Wieder öffnen geht sofort. */
  protected readonly justDone = signal<number | null>(null);
  protected toggle(task: PersonalTask): void {
    if (this.justDone() !== null || this.busy()) return;
    if (task.status === 'DONE') {
      this.toggleTask.emit(task);
      return;
    }
    this.justDone.set(task.id);
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      this.toggleTask.emit(task);
      this.justDone.set(null);
    }, calm ? 0 : 480);
  }

  /** Wohin Aufgaben gehören („✈ Berlin Wochenende“, „€ Reisekasse“) — ein Abruf für die sichtbare Liste. */
  protected readonly links = connectionHints('TASK', () => this.visible().map((t) => t.id));

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

  /** „Heute · Hoch · Wöchentlich“ — nur, was etwas aussagt (Normal-Priorität fällt weg). Was der Gruppenkopf schon
   * sagt („Heute“, „Morgen“, „Überfällig“), steht nicht noch einmal in der Zeile — dort bleibt nur die Uhrzeit. */
  protected meta(task: PersonalTask, group = ''): { due: string; late: boolean; parts: string[] } {
    const due = taskDue(task);
    if (group === 'today' || group === 'tomorrow') due.text = task.due_time?.slice(0, 5) ? `${task.due_time.slice(0, 5)} Uhr` : '';
    if (group === 'none') due.text = '';
    const parts: string[] = [];
    if (task.priority !== 'MEDIUM') parts.push(this.priorities[task.priority]);
    if (isRecurring(task)) parts.push(REPEAT_LABEL[task.repeat ?? 'custom'] ?? 'Wiederkehrend');
    if (task.project) parts.push(task.project);
    if (task.status === 'IN_PROGRESS') parts.push('In Bearbeitung');
    return { due: task.due_date ? due.text : '', late: due.late, parts };
  }
}

function readGrouping(): TaskGrouping {
  try {
    return localStorage.getItem(GROUPING_KEY) === 'project' ? 'project' : 'day';
  } catch {
    return 'day';
  }
}
