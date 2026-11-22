import { Feedback } from '../../../shared/ui/save-feedback/save-feedback';
import { DoneToggle } from '../../../shared/ui/done-toggle/done-toggle';
import { ErrorNoticeDirective } from '../../../shared/ui/error-notice/error-notice';
import { Component, computed, inject, output, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { LinkHints, connectionHints } from '../../../shared/features/connections/link-hints';
import { AppIcon, IconName } from '../../../shared/ui/icons/app-icon';
import { HaushaltOverviewDto, Id, MemberLoadDto, TaskDto, TaskRoom, UpcomingDeadlineDto } from '../data/household-api.service';
import { HAUSHALT_DATA_PROVIDER } from '../data/household-data-provider';
import { recurrenceLabel, relativeDay, todayIso } from '../shared/household-logic';
import { PRIORITY_LABEL, durationLabel, room } from '../shared/tasks-logic';
import { RoomState, doneToday, dueNow, fairness, minutesLabel, roomStates } from '../shared/home-logic';
import type { ZuhauseSection } from '../shared/home-logic';
import { UPCOMING_DAYS, formatDate, fromNow } from '../shared/contracts-logic';
import { DEMO_MODE } from '../../../core/demo-context';
import { GuideService } from '../../../core/onboarding/guide.service';
import { GuideStep, StartGuide } from '../../../shared/features/start-guide/start-guide';

/** Die vier Reiter im Haushalt. */
export type HaushaltTabKey = 'heute' | 'aufgaben' | 'einkaufen' | 'zuhause';
/** Was der leere Zustand anlegen lässt. */
export type HaushaltCreate = 'aufgabe' | 'einkauf' | 'geraet' | 'vertrag';

const DEADLINE_ICON: Record<UpcomingDeadlineDto['art'], IconName> = {
  wartung: 'clock',
  garantie: 'check-circle',
  kuendigung: 'finance',
};
const DEADLINE_LABEL: Record<UpcomingDeadlineDto['art'], string> = {
  wartung: 'Wartung',
  garantie: 'Garantie endet',
  kuendigung: 'Kündigungsfrist',
};

/**
 * Reiter „Heute“ — „Dein Zuhause, Raum für Raum“: oben die Kopfkarte (was heute ansteht, geschätzte Zeit aus den
 * eingetragenen Dauern, überfällig, heute erledigt; bei mehreren Personen die Monatsverteilung), darunter die Räume
 * nach Dringlichkeit (aus den Fälligkeiten; antippen = Aufgaben dieses Raums), dann fällige und überfällige Aufgaben
 * (höchstens 5), „Demnächst“ (Wartung, Garantieende, Kündigungsfrist in den nächsten 30 Tagen; services.UPCOMING_DAYS)
 * und der Einkauf. Grundlage GET /haushalt/uebersicht/, dazu Aufgaben und Verteilung (fehlen sie, bleibt „Heute“
 * ohne Räume nutzbar). Ist noch nichts angelegt: „Dein Zuhause im Blick“.
 */
@Component({
  selector: 'app-uebersicht-tab',
  standalone: true,
  imports: [DoneToggle, ErrorNoticeDirective, AppIcon, LinkHints, StartGuide],
  templateUrl: './today-tab.html',
  styleUrls: ['../shared/household-common.scss', './today-tab.scss', './today-hero.scss'],
})
export class UebersichtTab {
  private readonly provider = inject(HAUSHALT_DATA_PROVIDER);
  // Startleitfaden (21.11.2026): Schritte aus echten Daten (GuideService), nie in der Demo
  protected readonly guide = inject(GuideService);
  private readonly demoMode = inject(DEMO_MODE);
  protected readonly showGuide = computed(() => !this.demoMode && this.guide.shows('haushalt'));
  protected readonly guideSteps = computed<GuideStep[]>(() => {
    const h = this.guide.status()?.areas.haushalt;
    return [
      { key: 'aufgabe', title: 'Erste Aufgabe anlegen', hint: 'Was regelmäßig ansteht, z. B. Bad putzen. Auf Wunsch mit Wiederholung und wer dran ist.', done: !!h?.task },
      { key: 'einkauf', title: 'Einkauf planen', hint: 'Die gemeinsame Liste – was jemand einträgt, sehen alle im Haushalt sofort.', done: !!h?.shopping },
      { key: 'geraet', title: 'Gerät oder Vertrag ablegen', hint: 'Garantie, Kündigungsfrist, Kosten – 4inOne erinnert dich rechtzeitig.', done: !!h?.folder, optional: true,
        alt: { label: 'Oder einen Vertrag hinzufügen', icon: 'finance' } },
    ];
  });
  readonly saved = output<Feedback>();
  readonly openTab = output<HaushaltTabKey>();
  readonly openZuhause = output<ZuhauseSection>();
  readonly create = output<HaushaltCreate>();
  /** Raum-Karte angetippt: Aufgaben dieses Raums zeigen. */
  readonly openRoom = output<Exclude<TaskRoom, ''>>();

  protected readonly overview = signal<HaushaltOverviewDto | null>(null);
  protected readonly loadError = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly completing = signal<Id | null>(null);
  /** Gerade abgehakt: Haken und Durchstreichen sind kurz zu sehen, bevor die Zeile verschwindet. */
  protected readonly justDone = signal<Id | null>(null);
  /** Alle Aufgaben (offen + erledigt) und die Monatsverteilung — für Räume, Zeit, „heute erledigt“ und Fairness.
   * Fehlen sie, bleibt „Heute“ trotzdem nutzbar (dann ohne Räume). */
  protected readonly tasks = signal<TaskDto[]>([]);
  private readonly doneTasks = signal<TaskDto[]>([]);
  private readonly members = signal<MemberLoadDto[]>([]);

  protected readonly upcomingDays = UPCOMING_DAYS;
  protected readonly formatDate = formatDate;
  protected readonly fromNow = fromNow;
  protected readonly relativeDay = relativeDay;
  protected readonly priorityLabel = PRIORITY_LABEL;
  protected readonly deadlineIcon = DEADLINE_ICON;
  protected readonly deadlineLabel = DEADLINE_LABEL;

  /** Noch gar nichts angelegt → leerer Zustand mit Einstiegen statt leerer Karten. */
  protected readonly isEmpty = computed(() => {
    const data = this.overview();
    if (!data) return false;
    const s = data.summary;
    return !s.open_tasks && !s.recurring_tasks && !s.open_shopping_items && !s.devices && !s.contracts && !data.deadlines.length;
  });
  /** Nichts fällig: die nächste anstehende Aufgabe als Ausblick. */
  protected readonly nextTask = computed(() => this.overview()?.upcoming.find((t) => !!t.due_date) ?? null);
  protected readonly dueCount = computed(() => {
    const s = this.overview()?.summary;
    return s ? s.due_today + s.overdue_tasks : 0;
  });
  // ---------- Kopfkarte „Dein Zuhause heute“ und Räume ----------
  /** Wohin die heutigen Aufgaben gehören („✈ Berlin Wochenende“). */
  protected readonly links = connectionHints('HOUSEHOLD_TASK', () => this.overview()?.today.map((t) => t.id) ?? []);
  protected readonly minutes = computed(() => minutesLabel(dueNow(this.tasks())));
  protected readonly doneTodayCount = computed(() => doneToday([...this.tasks(), ...this.doneTasks()]));
  protected readonly rooms = computed<RoomState[]>(() => roomStates(this.tasks()).slice(0, 6));
  protected readonly fair = computed(() => fairness(this.members()));
  protected readonly durationLabel = durationLabel;
  protected readonly roomLabel = (value: TaskDto['room']) => room(value)?.label ?? '';

  constructor() {
    this.load();
  }

  protected pick(key: string): void {
    this.create.emit(key as HaushaltCreate);
  }

  protected load(): void {
    if (!this.demoMode) this.guide.load(); // mit jedem Neuladen: frisch angelegte Einträge sofort abhaken
    forkJoin({
      overview: this.provider.getOverview(),
      // Zusatzangaben: fehlen sie, zeigt „Heute“ das Wesentliche trotzdem
      tasks: this.provider.getTasks().pipe(catchError(() => of([] as TaskDto[]))),
      done: this.provider.getTasks('done').pipe(catchError(() => of([] as TaskDto[]))),
      members: this.provider.getTaskLoad().pipe(catchError(() => of([] as MemberLoadDto[]))),
    }).subscribe({
      next: ({ overview, tasks, done, members }) => {
        this.overview.set(overview);
        this.tasks.set(tasks);
        this.doneTasks.set(done);
        this.members.set(members);
        this.justDone.set(null);
        this.loadError.set(false);
      },
      error: () => this.loadError.set(true),
    });
  }

  protected dueChip(task: TaskDto): string {
    if (task.is_overdue) return task.due_date ? relativeDay(task.due_date) : 'Überfällig';
    return task.due_time ? `Heute, ${task.due_time.slice(0, 5)} Uhr` : 'Heute';
  }

  protected repeatLabel(task: TaskDto): string {
    return task.recurrence_days || task.recurrence_months ? recurrenceLabel(task.recurrence_days, task.recurrence_months) : '';
  }

  protected openDeadline(deadline: UpcomingDeadlineDto): void {
    this.openZuhause.emit(deadline.kind === 'vertrag' ? 'vertraege' : 'geraete');
  }

  protected complete(task: TaskDto): void {
    if (this.completing() !== null) return;
    this.completing.set(task.id);
    this.actionError.set(null);
    this.provider.completeTask(task.id, task.due_date).subscribe({
      next: (updated) => {
        this.completing.set(null);
        // Erledigt-Moment: Haken und Durchstreichen kurz zeigen, dann neu laden (bei reduzierter Bewegung sofort)
        this.justDone.set(task.id);
        const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        setTimeout(() => this.load(), calm ? 0 : 520);
        if (updated.is_done) {
          // Ü1: einmalige Aufgabe – einige Sekunden „Rückgängig“
          this.saved.emit({ message: `„${task.title}“ erledigt.`, actionLabel: 'Rückgängig', action: () => this.undoComplete(updated) });
        } else {
          this.saved.emit(
            updated.due_date ? `„${task.title}“ erledigt · wieder fällig ${relativeDay(updated.due_date)}.` : `„${task.title}“ erledigt.`,
          );
        }
      },
      error: () => {
        this.completing.set(null);
        this.actionError.set(`„${task.title}“ konnte nicht abgehakt werden. Bitte noch einmal versuchen.`);
      },
    });
  }

  /** Ü1: abgehakte einmalige Aufgabe wieder öffnen (vorhandener Endpunkt „wieder-oeffnen“). */
  private undoComplete(task: TaskDto): void {
    this.provider.reopenTask(task.id).subscribe({
      next: () => {
        this.load();
        this.saved.emit(`„${task.title}“ ist wieder offen.`);
      },
      error: () => this.actionError.set(`„${task.title}“ konnte nicht wieder geöffnet werden.`),
    });
  }

  protected readonly today = todayIso();
}
