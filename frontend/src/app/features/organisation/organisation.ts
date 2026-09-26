import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppShell } from '../../layout/app-shell';
import { AppIcon } from '../../shared/icons/app-icon';
import { ConnectionsSection } from '../../shared/connections/connections-section';
import { AppDatePicker } from '../../shared/form/date-picker';
import { AppDateTimePicker } from '../../shared/form/date-time-picker';
import { Field } from '../../shared/form/field';
import { AppSelect, SelectOption } from '../../shared/form/select';
import { AppTimePicker } from '../../shared/form/time-picker';
import { ModalForm } from '../../shared/form/modal-form';
import {
  OrganisationApi,
  PersonalEvent,
  PersonalTask,
  TodayData,
  TodayItem,
} from './organisation-api.service';

export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function localInput(value: string): string {
  const d = new Date(value);
  return `${localDay(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
@Component({
  selector: 'app-organisation',
  standalone: true,
  imports: [AppShell, AppIcon, ConnectionsSection, Field, ModalForm, ReactiveFormsModule, DatePipe, AppSelect, AppDatePicker, AppDateTimePicker, AppTimePicker],
  templateUrl: './organisation.html',
  styleUrl: './organisation.scss',
})
export class Organisation {
  private api = inject(OrganisationApi);
  private destroy = inject(DestroyRef);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private loaded = false;
  readonly tab = signal<'today' | 'calendar' | 'tasks'>('today');
  readonly events = signal<PersonalEvent[]>([]);
  readonly tasks = signal<PersonalTask[]>([]);
  readonly today = signal<TodayData | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly editor = signal<'event' | 'task' | null>(null);
  readonly editId = signal<number | undefined>(undefined);
  readonly selectedDay = signal(localDay(new Date()));
  readonly month = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly filter = signal('all');
  readonly filterOptions: SelectOption[] = [
    { value: 'all', label: 'Alle Aufgaben' },
    { value: 'active', label: 'Offene Aufgaben' },
    { value: 'done', label: 'Erledigte Aufgaben' },
  ];
  readonly priorityOptions: SelectOption[] = [
    { value: 'LOW', label: 'Niedrig' },
    { value: 'MEDIUM', label: 'Mittel' },
    { value: 'HIGH', label: 'Hoch' },
  ];
  readonly statusOptions: SelectOption[] = [
    { value: 'OPEN', label: 'Offen' },
    { value: 'IN_PROGRESS', label: 'In Bearbeitung' },
    { value: 'DONE', label: 'Erledigt' },
  ];
  readonly priorities = { LOW: 'Niedrig', MEDIUM: 'Mittel', HIGH: 'Hoch' };
  readonly statuses = { OPEN: 'Offen', IN_PROGRESS: 'In Bearbeitung', DONE: 'Erledigt' };
  readonly weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  readonly monthLabel = computed(() =>
    this.month().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
  );
  readonly dayLabel = computed(() =>
    new Date(`${this.selectedDay()}T12:00`).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  );
  readonly days = computed(() => {
    const m = this.month();
    const start = new Date(m.getFullYear(), m.getMonth(), 1);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = localDay(d);
      return {
        key,
        number: d.getDate(),
        outside: d.getMonth() !== m.getMonth(),
        today: key === localDay(new Date()),
        label: d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }),
        hasEvents: this.events().some((e) => this.onDay(e, key)),
      };
    });
  });
  readonly dayEvents = computed(() =>
    this.events().filter((e) => this.onDay(e, this.selectedDay())),
  );
  readonly upcoming = computed(() =>
    this.events()
      .filter((e) => new Date(e.starts_at) >= new Date())
      .slice(0, 3),
  );
  readonly visibleTasks = computed(() =>
    this.tasks()
      .filter(
        (t) =>
          this.filter() === 'all' ||
          (this.filter() === 'active' ? t.status !== 'DONE' : t.status === 'DONE'),
      )
      .sort(
        (a, b) =>
          (a.due_date || '9999').localeCompare(b.due_date || '9999') ||
          (a.due_time || '').localeCompare(b.due_time || ''),
      ),
  );
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', Validators.maxLength(5000)],
    starts_at: [''],
    ends_at: [''],
    location: ['', Validators.maxLength(240)],
    due_date: [''],
    due_time: [''],
    priority: ['MEDIUM'],
    status: ['OPEN'],
  });
  constructor() {
    this.load(true);
    // Wechsel auf ein anderes Objekt derselben Seite (z. B. Aufgabe → verknüpfter Termin)
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      if (this.loaded) this.openFromQuery();
    });
  }
  onDay(e: PersonalEvent, day: string) {
    const start = new Date(`${day}T00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return (
      new Date(e.starts_at) < end &&
      (new Date(e.starts_at) >= start || (!!e.ends_at && new Date(e.ends_at) > start))
    );
  }
  load(openRequested = false) {
    this.loading.set(true);
    this.error.set('');
    forkJoin({ events: this.api.events(), tasks: this.api.tasks(), today: this.api.today() })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.events.set(r.events);
          this.tasks.set(r.tasks);
          this.today.set(r.today);
          this.loading.set(false);
          this.loaded = true;
          if (openRequested) this.openFromQuery();
        },
        error: () => {
          this.loading.set(false);
          this.error.set(
            'Deine Organisation konnte nicht geladen werden. Bitte versuche es erneut.',
          );
        },
      });
  }
  /** Deep-Link (?kind=task|event&id=…): öffnet das Objekt und räumt die Adresse auf,
   * damit derselbe Link später erneut wirkt. Kommt aus dem Dashboard und aus „Verknüpft“. */
  private openFromQuery() {
    const q = this.route.snapshot.queryParamMap;
    const kind = q.get('kind');
    const id = Number(q.get('id'));
    if ((kind !== 'event' && kind !== 'task') || !id) return;
    const item = kind === 'event' ? this.events().find((e) => e.id === id) : this.tasks().find((t) => t.id === id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { kind: null, id: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (item) this.open(kind, item);
  }
  selectToday() {
    const date = this.today()?.date || localDay(new Date());
    const day = new Date(`${date}T12:00`);
    this.month.set(new Date(day.getFullYear(), day.getMonth(), 1));
    this.selectedDay.set(date);
    this.tab.set('calendar');
  }
  changeMonth(delta: number) {
    const m = this.month();
    const next = new Date(m.getFullYear(), m.getMonth() + delta, 1);
    this.month.set(next);
    this.selectedDay.set(localDay(next));
  }
  open(kind: 'event' | 'task', item?: PersonalEvent | PersonalTask) {
    this.form.reset({
      title: '',
      description: '',
      starts_at: `${this.selectedDay()}T09:00`,
      ends_at: '',
      location: '',
      due_date: '',
      due_time: '',
      priority: 'MEDIUM',
      status: 'OPEN',
    });
    this.editor.set(kind);
    this.editId.set(item?.id);
    this.formError.set('');
    if (item) {
      this.form.patchValue({ title: item.title, description: item.description });
      if ('starts_at' in item)
        this.form.patchValue({
          starts_at: localInput(item.starts_at),
          ends_at: item.ends_at ? localInput(item.ends_at) : '',
          location: item.location,
        });
      else
        this.form.patchValue({
          due_date: item.due_date || '',
          due_time: item.due_time?.slice(0, 5) || '',
          priority: item.priority,
          status: item.status,
        });
    }
  }
  openToday(item: TodayItem) {
    const entry =
      item.kind === 'event'
        ? this.events().find((e) => e.id === item.id)
        : this.tasks().find((t) => t.id === item.id);
    if (entry) this.open(item.kind, entry);
  }
  close() {
    if (!this.saving()) this.editor.set(null);
  }
  save() {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (this.form.invalid || !v.title.trim()) {
      this.formError.set('Bitte gib einen Titel ein (maximal 120 Zeichen).');
      return;
    }
    if (this.editor() === 'event' && (!v.starts_at || (v.ends_at && v.ends_at < v.starts_at))) {
      this.formError.set('Bitte prüfe Beginn und Ende des Termins.');
      return;
    }
    if (this.editor() === 'task' && v.due_time && !v.due_date) {
      this.formError.set('Bitte wähle zur Uhrzeit auch ein Fälligkeitsdatum.');
      return;
    }
    this.saving.set(true);
    this.formError.set('');
    const request: Observable<PersonalEvent | PersonalTask> =
      this.editor() === 'event'
        ? this.api.saveEvent(
            {
              title: v.title.trim(),
              description: v.description,
              location: v.location,
              starts_at: new Date(v.starts_at).toISOString(),
              ends_at: v.ends_at ? new Date(v.ends_at).toISOString() : null,
            },
            this.editId(),
          )
        : this.api.saveTask(
            {
              title: v.title.trim(),
              description: v.description,
              due_date: v.due_date || null,
              due_time: v.due_time || null,
              priority: v.priority as PersonalTask['priority'],
              status: v.status as PersonalTask['status'],
            },
            this.editId(),
          );
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.saving.set(false);
        this.editor.set(null);
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.formError.set(
          'Speichern fehlgeschlagen. Bitte prüfe deine Angaben und versuche es erneut.',
        );
      },
    });
  }
  toggle(task: PersonalTask) {
    if (this.saving()) return;
    this.saving.set(true);
    this.api
      .saveTask({ status: task.status === 'DONE' ? 'OPEN' : 'DONE' }, task.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Der Aufgabenstatus konnte nicht gespeichert werden.');
        },
      });
  }
  remove() {
    const id = this.editId(),
      kind = this.editor();
    if (!id || !kind || this.saving()) return;
    this.saving.set(true);
    this.api
      .remove(kind, id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editor.set(null);
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.formError.set('Löschen fehlgeschlagen. Bitte versuche es erneut.');
        },
      });
  }
  isOverdue(task: PersonalTask) {
    return task.status !== 'DONE' && !!task.due_date && task.due_date < localDay(new Date());
  }
}
