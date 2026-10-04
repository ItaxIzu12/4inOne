import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AppIcon } from '../../shared/icons/app-icon';
import { AppSelect, SelectOption } from '../../shared/form/select';
import { Id, MemberLoadDto, TaskDto, TaskWeekStatsDto } from './haushalt-api.service';
import { HAUSHALT_DATA_PROVIDER } from './haushalt-data-provider';
import { daysUntil, recurrenceLabel, relativeDay, todayIso } from './haushalt-logic';
import {
  GroupKey,
  NO_FILTERS,
  PRIORITY_FILTER_OPTIONS,
  PRIORITY_LABEL,
  ROOM_FILTER_OPTIONS,
  STATUS_OPTIONS,
  TaskFilters,
  dueLabel,
  durationLabel,
  endOfWeekIso,
  filterTasks,
  groupTasks,
  initials,
  room,
} from './aufgaben-logic';
import { TaskForm, TaskFormChange } from './task-form';

/**
 * Haushaltsaufgaben nach Entwurf: Filterleiste (Status, Räume, Personen,
 * Prioritäten), Gruppen als Tabelle (Raum, Zuständig, Fällig am, Dauer,
 * Priorität), daneben „Aufgaben im Überblick“, „Nächste Fälligkeiten“ und
 * „Schnell eine Aufgabe erfassen“. Wiederkehrende Aufgaben wechseln auf
 * Wunsch reihum; jede Erledigung zählt Aufwandspunkte für „Wer macht wie viel“
 * (im Routinen-Reiter). Fällige Aufgaben erscheinen automatisch unter „Heute“.
 * Das Formular teilt sich der Reiter mit den Routinen (task-form.ts).
 */
@Component({
  selector: 'app-aufgaben-tab',
  standalone: true,
  imports: [ErrorNoticeDirective, AppIcon, AppSelect, TaskForm],
  templateUrl: './aufgaben-tab.html',
  styleUrls: ['./haushalt-common.scss', './aufgaben-tab.scss'],
})
export class AufgabenTab {
  private readonly provider = inject(HAUSHALT_DATA_PROVIDER);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly saved = output<string>();
  /** Steigt bei jedem „Neue Aufgabe“ im Seitenkopf; > 0 öffnet das Formular. */
  readonly newRequest = input(0);

  protected readonly tasks = signal<TaskDto[] | null>(null);
  protected readonly doneTasks = signal<TaskDto[] | null>(null);
  protected readonly showDone = signal(false);
  protected readonly reopening = signal<Id | null>(null);
  protected readonly members = signal<MemberLoadDto[]>([]);
  protected readonly loadError = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly completing = signal<Id | null>(null);

  private readonly taskForm = viewChild.required<TaskForm>('taskForm');
  protected readonly relativeDay = relativeDay;
  /** Noch nicht fällig: erst heute oder überfällig lässt sich abhaken — sonst könnte man eine wiederkehrende
   * Aufgabe beliebig oft hintereinander „erledigen“ und sich Punkte/Fälligkeit vordatieren, ohne dass die Zeit
   * dafür wirklich vergangen ist. Aufgaben ohne Datum sind davon nicht betroffen. */
  protected notYetDue(task: TaskDto): boolean {
    return !!task.due_date && task.due_date > todayIso();
  }
  protected readonly recurrenceLabel = recurrenceLabel;

  /** Pausierte Routinen ruhen — sie stehen nur im Routinen-Reiter. */
  protected readonly visibleTasks = computed(() => (this.tasks() ?? []).filter((t) => !t.is_paused));

  // ---------- Filter und Gruppen ----------
  protected readonly filters = signal<TaskFilters>({ ...NO_FILTERS });
  protected readonly filtersOpen = signal(false);
  protected readonly collapsed = signal<Set<GroupKey>>(new Set());
  protected readonly hasFilters = computed(() => Object.values(this.filters()).some((v) => v !== ''));
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly roomFilterOptions = ROOM_FILTER_OPTIONS;
  protected readonly priorityFilterOptions = PRIORITY_FILTER_OPTIONS;
  protected readonly personFilterOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Alle Personen' },
    ...this.members().map((m) => ({ value: String(m.user_id), label: m.name })),
    { value: 'none', label: 'Nicht zugeteilt' },
  ]);
  protected readonly showsDone = computed(() => this.filters().status === 'done');

  protected readonly groups = computed(() => groupTasks(filterTasks(this.visibleTasks(), this.filters())));
  protected readonly filteredDone = computed(() => filterTasks(this.doneTasks() ?? [], { ...this.filters(), status: '' }));

  protected setFilter<K extends keyof TaskFilters>(key: K, value: string): void {
    this.filters.update((f) => ({ ...f, [key]: value }));
    if (key === 'status' && value === 'done') this.loadDone();
  }
  protected resetFilters(): void {
    this.filters.set({ ...NO_FILTERS });
  }
  protected toggleGroup(key: GroupKey): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ---------- Überblick ----------
  protected readonly week = signal<TaskWeekStatsDto | null>(null);
  protected readonly overdueTasks = computed(() => this.visibleTasks().filter((t) => t.is_overdue));
  protected readonly todayCount = computed(() => this.visibleTasks().filter((t) => t.due_date === todayIso()).length);
  /** „seit 1–2 Tagen“ — Spanne, wie lange überfällige Aufgaben schon liegen. */
  protected readonly overdueSpan = computed(() => {
    const days = this.overdueTasks().map((t) => -daysUntil(t.due_date!));
    if (!days.length) return 'nichts überfällig';
    const min = Math.min(...days);
    const max = Math.max(...days);
    const unit = max === 1 ? 'Tag' : 'Tagen';
    return min === max ? `seit ${max} ${unit}` : `seit ${min}–${max} Tagen`;
  });
  protected readonly weekDelta = computed(() => {
    const week = this.week();
    if (!week) return '';
    const delta = week.done_this_week - week.done_last_week;
    return delta === 0 ? 'wie in der Vorwoche' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} zur Vorwoche`;
  });
  /** „Nächste Fälligkeiten“: ab heute, nach Datum — überfällige stehen schon oben in der Tabelle. */
  protected readonly upcoming = computed(() =>
    this.visibleTasks()
      .filter((t) => !!t.due_date && t.due_date >= todayIso())
      .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
      .slice(0, 4),
  );

  // ---------- Darstellung ----------
  protected readonly room = room;
  protected readonly dueLabel = dueLabel;
  protected readonly durationLabel = durationLabel;
  protected readonly initials = initials;
  protected readonly priorityLabel = PRIORITY_LABEL;

  // ---------- Schnell erfassen ----------
  protected readonly quickTitle = signal('');
  protected readonly quickSaving = signal(false);
  protected quickAdd(when: 'none' | 'today' | 'week'): void {
    const title = this.quickTitle().trim();
    if (!title || this.quickSaving()) return;
    this.quickSaving.set(true);
    this.actionError.set(null);
    const due = when === 'today' ? todayIso() : when === 'week' ? endOfWeekIso() : null;
    this.provider
      .createTask({
        title, description: '', recurrence: null, due_date: due, due_time: null, effort: 1, assigned_to: null,
        rotate: false, rotation_member_ids: [], room: '', duration_minutes: null, priority: 'mittel',
      })
      .subscribe({
        next: () => {
          this.quickSaving.set(false);
          this.quickTitle.set('');
          this.load();
          this.saved.emit(`„${title}“ angelegt.`);
        },
        error: () => {
          this.quickSaving.set(false);
          this.actionError.set('Die Aufgabe konnte nicht angelegt werden. Bitte noch einmal versuchen.');
        },
      });
  }


  constructor() {
    this.load();
    effect(() => {
      if (this.newRequest() > 0) untracked(() => this.openNew());
    });
  }

  protected load(): void {
    forkJoin({ tasks: this.provider.getTasks(), members: this.provider.getTaskLoad(), week: this.provider.getTaskWeek() }).subscribe({
      next: ({ tasks, members, week }) => {
        this.tasks.set(tasks);
        this.members.set(members);
        this.week.set(week);
        this.loadError.set(false);
        this.openTaskFromQuery(tasks);
      },
      error: () => this.loadError.set(true),
    });
  }

  /** Deep-Link (?task=<id>) aus „Verknüpft“: öffnet die Aufgabe, auch wenn sie schon erledigt ist. */
  private openTaskFromQuery(open: TaskDto[]): void {
    const id = Number(this.route.snapshot.queryParamMap.get('task'));
    if (!id) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { task: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    const found = open.find((t) => t.id === id);
    if (found) return this.openEdit(found);
    this.provider.getTasks('done').subscribe({
      next: (rows) => {
        this.doneTasks.set(rows);
        const done = rows.find((t) => t.id === id);
        if (done) {
          this.showDone.set(true);
          this.openEdit(done);
        }
      },
      error: () => undefined,
    });
  }

  protected toggleDone(): void {
    const next = !this.showDone();
    this.showDone.set(next);
    if (next) this.loadDone();
  }

  private loadDone(): void {
    this.provider.getTasks('done').subscribe({
      next: (rows) => this.doneTasks.set(rows),
      error: () => this.actionError.set('Erledigte Aufgaben konnten nicht geladen werden.'),
    });
  }

  protected reopen(task: TaskDto): void {
    if (this.reopening() !== null) return;
    this.reopening.set(task.id);
    this.actionError.set(null);
    this.provider.reopenTask(task.id).subscribe({
      next: () => {
        this.reopening.set(null);
        this.load();
        this.loadDone();
        this.saved.emit(`„${task.title}“ ist wieder offen.`);
      },
      error: () => {
        this.reopening.set(null);
        this.actionError.set(`„${task.title}“ konnte nicht wieder geöffnet werden.`);
      },
    });
  }

  private reloadLoad(): void {
    this.provider.getTaskLoad().subscribe({ next: (members) => this.members.set(members), error: () => undefined });
    this.provider.getTaskWeek().subscribe({ next: (week) => this.week.set(week), error: () => undefined });
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
        if (this.showDone()) this.loadDone();
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

  // ---------- Formular (TaskForm) ----------

  protected openNew(): void {
    this.taskForm().openNew();
  }

  protected openEdit(task: TaskDto): void {
    this.taskForm().openEdit(task);
  }

  protected onFormChanged(change: TaskFormChange): void {
    if (change.deletedId !== undefined) this.tasks.update((tasks) => (tasks ?? []).filter((t) => t.id !== change.deletedId));
    this.load();
    this.saved.emit(change.message);
  }
}
