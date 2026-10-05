import { Component, computed, input, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { AppSelect, SelectOption } from '../../shared/form/select';
import { PersonalEvent, PersonalTask } from './organisation-api.service';
import { dayWord, groupTasks, localDay, projects, projectTone, startTime, taskDue, taskProgress, upcomingEvents } from './organisation-logic';

type StatusFilter = 'open' | 'all' | 'done';

/**
 * Aufgaben nach Entwurf: Filter (Status, Priorität, Projekt, Suche), Gruppen
 * Überfällig/Heute/Diese Woche/Später/Ohne Datum (dazu Erledigt), rechts
 * Fortschritt, nächste Termine und Projekte. Bearbeiten und Abhaken übernimmt
 * die Hülle (organisation.ts).
 */
@Component({
  selector: 'app-org-tasks',
  standalone: true,
  imports: [AppIcon, AppSelect],
  templateUrl: './org-tasks.html',
  styleUrls: ['./org-common.scss', './org-tasks.scss'],
})
export class OrgTasks {
  readonly tasks = input<PersonalTask[]>([]);
  readonly events = input<PersonalEvent[]>([]);
  readonly openTask = output<PersonalTask>();
  readonly toggleTask = output<PersonalTask>();
  readonly showCalendar = output<void>();

  protected readonly status = signal<StatusFilter>('open');
  protected readonly priority = signal('');
  protected readonly project = signal('');
  protected readonly search = signal('');
  protected readonly collapsed = signal<ReadonlySet<string>>(new Set());

  protected readonly statusOptions: SelectOption[] = [
    { value: 'open', label: 'Offene Aufgaben' },
    { value: 'all', label: 'Alle Aufgaben' },
    { value: 'done', label: 'Erledigte Aufgaben' },
  ];
  protected readonly priorityOptions: SelectOption[] = [
    { value: '', label: 'Alle Prioritäten' },
    { value: 'HIGH', label: 'Hoch' },
    { value: 'MEDIUM', label: 'Mittel' },
    { value: 'LOW', label: 'Niedrig' },
  ];
  protected readonly projectOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Alle Projekte' },
    ...[...new Set(this.tasks().map((t) => (t.project ?? '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'de'))
      .map((p) => ({ value: p, label: p })),
  ]);
  protected readonly priorities = { LOW: 'Niedrig', MEDIUM: 'Mittel', HIGH: 'Hoch' };

  private readonly filtered = computed(() => {
    const q = this.search().trim().toLocaleLowerCase('de');
    return this.tasks().filter(
      (t) =>
        (!this.priority() || t.priority === this.priority()) &&
        (!this.project() || (t.project ?? '') === this.project()) &&
        (!q || t.title.toLocaleLowerCase('de').includes(q) || (t.project ?? '').toLocaleLowerCase('de').includes(q)),
    );
  });
  protected readonly groups = computed(() => (this.status() === 'done' ? [] : groupTasks(this.filtered())));
  protected readonly doneTasks = computed(() =>
    this.status() === 'open' ? [] : this.filtered().filter((t) => t.status === 'DONE'),
  );
  protected readonly hasFilters = computed(() => !!(this.priority() || this.project() || this.search().trim()));
  protected readonly progress = computed(() => taskProgress(this.tasks()));
  protected readonly projectList = computed(() => projects(this.tasks()));
  protected readonly nextEvents = computed(() => upcomingEvents(this.events(), new Date(), 5));

  protected readonly taskDue = taskDue;
  protected readonly projectTone = projectTone;
  protected readonly dayWord = dayWord;
  protected readonly startTime = startTime;

  protected eventDay(e: PersonalEvent): string {
    return localDay(new Date(e.starts_at));
  }

  protected toggleGroup(key: string): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  protected resetFilters(): void {
    this.priority.set('');
    this.project.set('');
    this.search.set('');
  }

  protected share(part: number, whole: number): number {
    return whole ? Math.round((part / whole) * 100) : 0;
  }
}
