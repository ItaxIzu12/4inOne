import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { Component, computed, effect, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AppIcon } from '../../shared/icons/app-icon';
import { Id, MemberLoadDto, TaskDto } from './haushalt-api.service';
import { HAUSHALT_DATA_PROVIDER } from './haushalt-data-provider';
import { recurrenceLabel, relativeDay, todayIso } from './haushalt-logic';
import { NO_FILTERS, PRIORITY_LABEL, TaskFilters, dueLabel, durationLabel, filterTasks, room } from './aufgaben-logic';
import { ScopeNote } from '../../shared/scope-note/scope-note';
import { RoutinenTab } from './routinen-tab';
import { TaskForm, TaskFormChange } from './task-form';

/** Ansichten im Reiter Aufgaben — „Wiederkehrend“ ersetzt den früheren Reiter Routinen. */
export type AufgabenView = 'alle' | 'heute' | 'ueberfaellig' | 'wiederkehrend' | 'erledigt';
export const AUFGABEN_VIEWS: AufgabenView[] = ['alle', 'heute', 'ueberfaellig', 'wiederkehrend', 'erledigt'];
const VIEW_LABEL: Record<AufgabenView, string> = {
  alle: 'Alle',
  heute: 'Heute',
  ueberfaellig: 'Überfällig',
  wiederkehrend: 'Wiederkehrend',
  erledigt: 'Erledigt',
};
const VIEW_STATUS: Record<AufgabenView, TaskFilters['status']> = {
  alle: '',
  heute: 'today',
  ueberfaellig: 'overdue',
  wiederkehrend: '',
  erledigt: 'done',
};

/**
 * Haushaltsaufgaben — derselbe Aufbau wie Organisation → Aufgaben: Ansichten
 * (mit Anzahl), darüber eine Suche, darunter eine ruhige Liste (Haken, Titel,
 * darunter Fälligkeit · Raum · Zuständig · Dauer · Priorität). Gemeinsame
 * Haushaltsangaben stehen in der Zeile statt in Spalten. „Wiederkehrend“ zeigt
 * die Serien mit „Wer macht wie viel“ (routinen-tab). Das Formular teilt sich
 * der Reiter mit den wiederkehrenden Aufgaben (task-form.ts).
 */
@Component({
  selector: 'app-aufgaben-tab',
  standalone: true,
  imports: [ErrorNoticeDirective, AppIcon, RouterLink, TaskForm, RoutinenTab, ScopeNote],
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
  /** Alle · Heute · Überfällig · Wiederkehrend · Erledigt — in der URL (?ansicht=). */
  readonly view = model<AufgabenView>('alle');
  protected readonly views = AUFGABEN_VIEWS;
  protected readonly viewLabel = VIEW_LABEL;
  /** „Aufgabe hinzufügen“ in der Ansicht Wiederkehrend öffnet das Formular der Routinen. */
  protected readonly routineRequest = signal(0);

  protected readonly tasks = signal<TaskDto[] | null>(null);
  protected readonly doneTasks = signal<TaskDto[] | null>(null);
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

  // ---------- Ansicht und Suche ----------
  /** Suche über Titel, Beschreibung, Raum und zuständige Person — innerhalb der Ansicht. */
  protected readonly search = signal('');
  private matches(t: TaskDto, q: string): boolean {
    return !q || [t.title, t.description, room(t.room)?.label ?? '', t.assigned_to_name ?? ''].some((v) => v.toLocaleLowerCase('de').includes(q));
  }
  private byDue(list: TaskDto[]): TaskDto[] {
    return [...list].sort(
      (a, b) =>
        (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') ||
        (a.due_time ?? '99').localeCompare(b.due_time ?? '99') ||
        String(a.id).localeCompare(String(b.id)),
    );
  }
  private inView(view: AufgabenView): TaskDto[] {
    if (view === 'erledigt') return this.doneTasks() ?? [];
    const filters: TaskFilters = { ...NO_FILTERS, status: VIEW_STATUS[view] };
    return this.byDue(filterTasks(this.visibleTasks(), filters));
  }
  protected readonly visible = computed(() => {
    const q = this.search().trim().toLocaleLowerCase('de');
    return this.inView(this.view()).filter((t) => this.matches(t, q));
  });
  /** Anzahl je Ansicht für die Chips (Alle ohne Zahl). */
  protected readonly counts = computed(() => ({
    heute: this.inView('heute').length,
    ueberfaellig: this.inView('ueberfaellig').length,
    wiederkehrend: this.visibleTasks().filter((t) => !!(t.recurrence_days || t.recurrence_months)).length,
    erledigt: (this.doneTasks() ?? []).length,
  }) as Partial<Record<AufgabenView, number>>);
  protected readonly emptyText = computed(() => {
    if (this.search().trim()) return `Keine Aufgabe passt zu „${this.search().trim()}“.`;
    return {
      alle: 'Keine offenen Aufgaben. Leg eine Aufgabe an oder richte eine wiederkehrende Aufgabe ein.',
      heute: 'Heute ist nichts fällig.',
      ueberfaellig: 'Nichts überfällig – alles im Griff.',
      wiederkehrend: '',
      erledigt: 'Noch nichts erledigt.',
    }[this.view()];
  });

  protected selectView(view: AufgabenView): void {
    this.view.set(view);
  }

  /** Zeile unter dem Titel: nur, was etwas aussagt (Priorität „Normal“ fällt weg). */
  protected meta(t: TaskDto): { due: string; late: boolean; parts: string[] } {
    const due = dueLabel(t);
    const parts: string[] = [];
    const r = room(t.room);
    if (r) parts.push(r.label);
    if (t.assigned_to_name) parts.push(t.rotate ? `${t.assigned_to_name} (reihum)` : t.assigned_to_name);
    if (t.duration_minutes) parts.push(durationLabel(t.duration_minutes));
    if (t.priority !== 'mittel') parts.push(PRIORITY_LABEL[t.priority]);
    if (t.recurrence_days || t.recurrence_months) parts.push(recurrenceLabel(t.recurrence_days, t.recurrence_months));
    return { due: t.due_date ? due.text : '', late: due.tone === 'late', parts };
  }

  constructor() {
    this.load();
    effect(() => {
      if (this.newRequest() > 0) {
        untracked(() => (this.view() === 'wiederkehrend' ? this.routineRequest.update((n) => n + 1) : this.openNew()));
      }
    });
  }

  protected load(): void {
    // Erledigte gleich mitladen: der Chip „Erledigt“ zeigt ihre Anzahl.
    forkJoin({ tasks: this.provider.getTasks(), done: this.provider.getTasks('done'), members: this.provider.getTaskLoad() }).subscribe({
      next: ({ tasks, done, members }) => {
        this.tasks.set(tasks);
        this.doneTasks.set(done);
        this.members.set(members);
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
          this.view.set('erledigt');
          this.openEdit(done);
        }
      },
      error: () => undefined,
    });
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
        this.loadDone();
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
