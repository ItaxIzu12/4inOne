import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DEMO_MODE } from '../../core/demo-context';
import { AppIcon } from '../../shared/icons/app-icon';
import { HOUSEHOLD_TASKS_PREVIEW } from '../../shared/connections/auto-link-rules';
import { AutoLinkState, AutoLinksApi, LinkedHouseholdTask } from '../../shared/connections/auto-links-api.service';

const DUE = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Organisation › Aufgaben › „Aus dem Haushalt“ (Connection Engine V2, CON-03): offene Haushaltsaufgaben, die mir oder
 * niemandem zugewiesen sind — derselbe Datensatz wie im Haushalt (keine Kopie). Abhaken erledigt sie dort; ein
 * Schalter blendet den Abschnitt ein oder aus (sofort, ohne Dialog). Ohne Haushalt erscheint nichts.
 */
@Component({
  selector: 'app-org-household-tasks',
  standalone: true,
  imports: [AppIcon, RouterLink],
  templateUrl: './org-household-tasks.html',
  styleUrls: ['./org-common.scss', './org-household-tasks.scss'],
})
export class OrgHouseholdTasks {
  private readonly api = inject(AutoLinksApi);
  private readonly destroyed = inject(DestroyRef);
  protected readonly demo = inject(DEMO_MODE);

  protected readonly householdId = signal<number | null>(null);
  protected readonly state = signal<AutoLinkState | null>(null);
  protected readonly tasks = signal<LinkedHouseholdTask[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly done = signal<(number | string)[]>([]);
  protected readonly preview = HOUSEHOLD_TASKS_PREVIEW.preview;
  protected readonly on = computed(() => this.state()?.status === 'ACTIVE');
  protected readonly paused = computed(() => this.state()?.status === 'PAUSED');
  protected readonly haushaltLink = computed(() => (this.demo ? '/demo/haushalt' : '/haushalt'));

  constructor() {
    this.load();
  }

  private load(): void {
    this.api.householdTasks().pipe(takeUntilDestroyed(this.destroyed)).subscribe({
      next: (r) => {
        this.householdId.set(r.household_id);
        this.tasks.set(r.tasks);
        if (r.household_id !== null) {
          this.api.states('HOUSEHOLD', r.household_id).pipe(takeUntilDestroyed(this.destroyed)).subscribe({
            next: (s) => this.state.set(s[0] ?? null),
            error: () => this.state.set(null),
          });
        }
      },
      error: () => this.householdId.set(null),
    });
  }

  protected toggle(on: boolean): void {
    const id = this.householdId();
    if (id === null || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const link = this.state()?.link_id;
    const request = on
      ? link
        ? this.api.setStatus(link, 'ACTIVE')
        : this.api.create('HOUSEHOLD_TASKS', id)
      : link
        ? this.api.setStatus(link, 'PAUSED')
        : null;
    if (!request) {
      this.busy.set(false);
      return;
    }
    request.pipe(takeUntilDestroyed(this.destroyed)).subscribe({
      next: () => {
        this.busy.set(false);
        this.load();
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Das hat nicht geklappt. Bitte versuche es noch einmal.');
      },
    });
  }

  protected complete(task: LinkedHouseholdTask): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.done.update((list) => [...list, task.id]);
    this.api.completeHouseholdTask(task.id).pipe(takeUntilDestroyed(this.destroyed)).subscribe({
      next: () => {
        this.busy.set(false);
        // kurz als erledigt zeigen, dann neu laden (wiederkehrende Aufgaben rücken weiter)
        setTimeout(() => this.load(), 600);
      },
      error: () => {
        this.busy.set(false);
        this.done.update((list) => list.filter((id) => id !== task.id));
        this.error.set('Die Aufgabe konnte nicht erledigt werden. Bitte versuche es noch einmal.');
      },
    });
  }

  protected dueLabel(task: LinkedHouseholdTask): string {
    if (!task.due_date) return 'ohne Termin';
    const today = new Date().toLocaleDateString('sv-SE');
    if (task.due_date < today) return `überfällig · ${DUE.format(new Date(`${task.due_date}T12:00`))}`;
    if (task.due_date === today) return 'heute';
    return DUE.format(new Date(`${task.due_date}T12:00`));
  }
}
