import { Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { AppSelect } from '../../shared/form/select';
import { AppIcon } from '../../shared/icons/app-icon';
import { Id, MemberLoadDto, RoutineStatsDto, TaskDto } from './haushalt-api.service';
import { HAUSHALT_DATA_PROVIDER } from './haushalt-data-provider';
import { relativeDay, todayIso } from './haushalt-logic';
import { avatarTone, initials, room } from './aufgaben-logic';
import {
  Frequency,
  ROUTINE_CHIPS,
  ROUTINE_SORT_OPTIONS,
  RoutineChip,
  RoutineSort,
  filterRoutines,
  groupRoutines,
  isDueToday,
  isRoutine,
  isShared,
  mobileMeta,
  nextDue,
  rhythm,
  routineIconFor,
  sortRoutines,
  streakLabel,
} from './routinen-logic';
import { RowMenu, RowMenuItem } from './row-menu';
import { TaskForm, TaskFormChange } from './task-form';

/**
 * Routinen nach Entwurf: vier Kennzahlen (aktiv, heute fällig,
 * Erledigungsrate, geteilt), Filter-Chips nach Rhythmus, Gruppen als Tabelle
 * (Rhythmus, nächste Fälligkeit, Verantwortlich, Serie, Status-Schalter).
 * Routinen sind wiederkehrende Aufgaben — dieselben Daten und dasselbe
 * Formular wie im Aufgaben-Reiter (task-form.ts). Der Schalter pausiert eine
 * Routine: sie ruht dann unter „Heute“ und lässt sich nicht abhaken.
 */
@Component({
  selector: 'app-routinen-tab',
  standalone: true,
  imports: [ErrorNoticeDirective, AppIcon, AppSelect, RowMenu, TaskForm],
  templateUrl: './routinen-tab.html',
  styleUrls: ['./haushalt-common.scss', './haushalt-stats.scss', './routinen-tab.scss'],
})
export class RoutinenTab {
  private readonly provider = inject(HAUSHALT_DATA_PROVIDER);
  readonly saved = output<string>();
  /** Steigt bei jedem „Routine hinzufügen“ im Seitenkopf; > 0 öffnet das Formular. */
  readonly newRequest = input(0);

  private readonly taskForm = viewChild.required<TaskForm>('taskForm');

  protected readonly tasks = signal<TaskDto[] | null>(null);
  protected readonly members = signal<MemberLoadDto[]>([]);
  protected readonly stats = signal<RoutineStatsDto | null>(null);
  protected readonly loadError = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly busy = signal<Id | null>(null);

  // ---------- Filter, Sortierung, Gruppen ----------
  protected readonly chips = ROUTINE_CHIPS;
  protected readonly sortOptions = ROUTINE_SORT_OPTIONS;
  protected readonly chip = signal<RoutineChip>('alle');
  protected readonly sort = signal<RoutineSort>('faellig');
  protected readonly collapsed = signal<ReadonlySet<Frequency>>(new Set());

  protected readonly routines = computed(() => (this.tasks() ?? []).filter(isRoutine));
  protected readonly active = computed(() => this.routines().filter((t) => !t.is_paused));
  protected readonly pausedCount = computed(() => this.routines().length - this.active().length);
  protected readonly dueToday = computed(() => this.routines().filter((t) => isDueToday(t)));
  protected readonly shared = computed(() => this.routines().filter(isShared));
  protected readonly sharedPeople = computed(
    () => new Set(this.shared().flatMap((t) => (t.rotate ? t.rotation_member_ids : [t.assigned_to]))).size,
  );
  protected readonly groups = computed(() =>
    groupRoutines(sortRoutines(filterRoutines(this.routines(), this.chip()), this.sort())),
  );
  protected readonly menus = computed(() => new Map(this.routines().map((t) => [t.id, this.menuItems(t)])));

  // ---------- Darstellung ----------
  protected readonly rhythm = rhythm;
  protected readonly mobileMeta = mobileMeta;
  protected readonly nextDue = nextDue;
  protected readonly streakLabel = streakLabel;
  protected readonly routineIconFor = routineIconFor;
  protected readonly initials = initials;
  protected readonly avatarTone = avatarTone;
  protected readonly room = room;

  // ---------- Wer macht wie viel? ----------
  protected readonly totalPoints = computed(() => this.members().reduce((sum, m) => sum + m.points, 0));
  protected readonly maxPoints = computed(() => Math.max(1, ...this.members().map((m) => m.points)));

  constructor() {
    this.load();
    effect(() => {
      if (this.newRequest() > 0) untracked(() => this.openNew());
    });
  }

  protected load(): void {
    forkJoin({
      tasks: this.provider.getTasks(),
      members: this.provider.getTaskLoad(),
      stats: this.provider.getRoutineStats(),
    }).subscribe({
      next: ({ tasks, members, stats }) => {
        this.tasks.set(tasks);
        this.members.set(members);
        this.stats.set(stats);
        this.loadError.set(false);
      },
      error: () => this.loadError.set(true),
    });
  }

  protected chipCount(key: RoutineChip): number {
    return filterRoutines(this.routines(), key).length;
  }

  protected setChip(key: RoutineChip): void {
    this.chip.set(this.chip() === key && key !== 'alle' ? 'alle' : key);
  }

  protected toggleGroup(key: Frequency): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** Noch nicht fällig: abhaken erst ab dem Fälligkeitstag (wie im Aufgaben-Reiter). */
  private notYetDue(task: TaskDto): boolean {
    return !!task.due_date && task.due_date > todayIso();
  }

  private menuItems(task: TaskDto): RowMenuItem[] {
    return [
      {
        key: 'done',
        label: this.notYetDue(task) ? `Erledigt (ab ${relativeDay(task.due_date!)})` : 'Als erledigt markieren',
        icon: 'check',
        disabled: task.is_paused || this.notYetDue(task),
      },
      { key: 'edit', label: 'Bearbeiten', icon: 'edit' },
      { key: 'pause', label: task.is_paused ? 'Fortsetzen' : 'Pausieren', icon: 'repeat' },
    ];
  }

  protected onMenu(task: TaskDto, key: string): void {
    if (key === 'done') this.complete(task);
    else if (key === 'edit') this.taskForm().openEdit(task);
    else if (key === 'pause') this.togglePaused(task);
  }

  protected whoLabel(task: TaskDto): string {
    if (task.rotate) return task.assigned_to_name ? `${task.assigned_to_name} (reihum)` : 'reihum';
    return task.assigned_to_name ?? 'Alle';
  }

  /** Schalter: optimistisch umlegen, bei Fehler zurück und Hinweis. */
  protected togglePaused(task: TaskDto): void {
    if (this.busy() !== null) return;
    const paused = !task.is_paused;
    this.busy.set(task.id);
    this.actionError.set(null);
    this.replace({ ...task, is_paused: paused });
    this.provider.setTaskPaused(task.id, paused).subscribe({
      next: (updated) => {
        this.busy.set(null);
        this.replace(updated);
        this.saved.emit(paused ? `„${task.title}“ pausiert.` : `„${task.title}“ läuft wieder.`);
      },
      error: () => {
        this.busy.set(null);
        this.replace(task);
        this.actionError.set(`„${task.title}“ konnte nicht ${paused ? 'pausiert' : 'fortgesetzt'} werden.`);
      },
    });
  }

  private complete(task: TaskDto): void {
    if (this.busy() !== null) return;
    this.busy.set(task.id);
    this.actionError.set(null);
    this.provider.completeTask(task.id, task.due_date).subscribe({
      next: (updated) => {
        this.busy.set(null);
        this.replace(updated);
        const next = updated.due_date ? relativeDay(updated.due_date) : '';
        const who = updated.rotate && updated.assigned_to_name ? ` · ${updated.assigned_to_name} ist dran` : '';
        this.saved.emit(`„${task.title}“ erledigt · wieder fällig ${next}${who}.`);
        this.provider.getTaskLoad().subscribe({ next: (m) => this.members.set(m), error: () => undefined });
        this.provider.getRoutineStats().subscribe({ next: (s) => this.stats.set(s), error: () => undefined });
      },
      error: () => {
        this.busy.set(null);
        this.actionError.set(`„${task.title}“ konnte nicht abgehakt werden. Bitte noch einmal versuchen.`);
      },
    });
  }

  private replace(task: TaskDto): void {
    this.tasks.update((tasks) => (tasks ?? []).map((t) => (t.id === task.id ? task : t)));
  }

  protected openNew(): void {
    this.taskForm().openNew();
  }

  protected onFormChanged(change: TaskFormChange): void {
    if (change.deletedId !== undefined) this.tasks.update((tasks) => (tasks ?? []).filter((t) => t.id !== change.deletedId));
    this.load();
    this.saved.emit(change.message);
  }

}
