import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { MobileAction } from '../../shared/mobile-action/mobile-action';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, Observable, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppShell } from '../../layout/app-shell';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { ConnectionsSection } from '../../shared/connections/connections-section';
import { AppDatePicker } from '../../shared/form/date-picker';
import { AppDateTimePicker } from '../../shared/form/date-time-picker';
import { Field } from '../../shared/form/field';
import { AppSelect, SelectOption } from '../../shared/form/select';
import { AppTimePicker } from '../../shared/form/time-picker';
import { ModalForm } from '../../shared/form/modal-form';
import { OrganisationApi, PersonalEvent, PersonalNote, PersonalTask, TodayData } from './organisation-api.service';
import { EVENT_CATEGORIES, localDay } from './organisation-logic';
import { OrgOverview } from './org-overview';
import { OrgCalendar } from './org-calendar';
import { OrgTasks } from './org-tasks';
import { OrgNotes } from './org-notes';
import { OrgFiles } from './org-files';

export { localDay } from './organisation-logic';

function localInput(value: string): string {
  const d = new Date(value);
  return `${localDay(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export type OrgTab = 'overview' | 'calendar' | 'tasks' | 'notes' | 'files';
const TABS: { key: OrgTab; label: string; icon: IconName }[] = [
  { key: 'overview', label: 'Übersicht', icon: 'home' },
  { key: 'calendar', label: 'Kalender', icon: 'calendar' },
  { key: 'tasks', label: 'Aufgaben', icon: 'check-circle' },
  { key: 'notes', label: 'Notizen', icon: 'file-text' },
  { key: 'files', label: 'Dateien', icon: 'folder' },
];
// Hauptknopf im Seitenkopf, passend zum Reiter.
const HEAD_ACTIONS: Record<OrgTab, string> = {
  overview: '',
  calendar: 'Termin erstellen',
  tasks: 'Aufgabe erstellen',
  notes: 'Notiz erstellen',
  files: 'Datei hochladen',
};

/**
 * Organisation: privater Bereich für Termine, Aufgaben, Notizen und Dateien
 * (docs/ORGANISATION_V1.md). Diese Komponente ist die Seitenhülle: Kopf,
 * Reiter, Laden der Daten und die gemeinsamen Formulare. Die Reiter sind
 * eigene Komponenten (org-*.ts) und melden nur, was geöffnet werden soll.
 * Alles ist privat — der Server filtert nach Eigentümer.
 */
@Component({
  selector: 'app-organisation',
  standalone: true,
  imports: [
    MobileAction,
    ErrorNoticeDirective, AppShell, AppIcon, ConnectionsSection, Field, ModalForm, ReactiveFormsModule, AppSelect,
    AppDatePicker, AppDateTimePicker, AppTimePicker, OrgOverview, OrgCalendar, OrgTasks, OrgNotes, OrgFiles,
  ],
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
  readonly tabs = TABS;
  readonly tab = signal<OrgTab>('overview');
  readonly headAction = computed(() => HEAD_ACTIONS[this.tab()]);
  readonly events = signal<PersonalEvent[]>([]);
  readonly tasks = signal<PersonalTask[]>([]);
  readonly notes = signal<PersonalNote[]>([]);
  readonly today = signal<TodayData | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly editor = signal<'event' | 'task' | null>(null);
  readonly editId = signal<number | undefined>(undefined);
  /** Ausgewählter Tag im Kalender — Vorgabe für „Termin erstellen“. */
  readonly selectedDay = signal(localDay(new Date()));
  /** Steigt bei „Datei hochladen“ im Kopf; der Dateien-Reiter öffnet dann die Auswahl. */
  readonly uploadRequest = signal(0);
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
  readonly categoryOptions: SelectOption[] = EVENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }));
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', Validators.maxLength(5000)],
    starts_at: [''],
    ends_at: [''],
    location: ['', Validators.maxLength(240)],
    category: ['sonstiges'],
    due_date: [''],
    due_time: [''],
    priority: ['MEDIUM'],
    status: ['OPEN'],
    project: ['', Validators.maxLength(60)],
  });

  constructor() {
    const tab = this.route.snapshot.queryParamMap.get('tab') as OrgTab | null;
    if (tab && TABS.some((t) => t.key === tab)) this.tab.set(tab);
    this.load(true);
    // Wechsel auf ein anderes Objekt derselben Seite (z. B. Aufgabe → verknüpfter Termin)
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      if (this.loaded) this.openFromQuery();
    });
  }

  load(openRequested = false) {
    this.loading.set(this.events().length === 0 && this.tasks().length === 0);
    this.error.set('');
    forkJoin({
      events: this.api.events(),
      tasks: this.api.tasks(),
      today: this.api.today(),
      // Notizen sind Zusatz: fehlen sie, bleiben Termine und Aufgaben nutzbar.
      notes: this.api.notes().pipe(catchError(() => of([] as PersonalNote[]))),
    })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.events.set(r.events);
          this.tasks.set(r.tasks);
          this.today.set(r.today);
          this.notes.set(r.notes);
          this.loading.set(false);
          this.loaded = true;
          if (openRequested) this.openFromQuery();
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Deine Organisation konnte nicht geladen werden. Bitte versuche es erneut.');
        },
      });
  }

  selectTab(tab: OrgTab) {
    this.tab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'overview' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onTabKeydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const keys = TABS.map((t) => t.key);
    const index = keys.indexOf(this.tab());
    const next = keys[(index + (event.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length];
    this.selectTab(next);
    queueMicrotask(() => document.getElementById(`org-tab-${next}`)?.focus());
  }

  /** Hauptknopf im Kopf — öffnet das passende Formular des Reiters. */
  headActionClick() {
    switch (this.tab()) {
      case 'calendar':
        return this.open('event');
      case 'tasks':
        return this.open('task');
      case 'notes':
        return this.openNote();
      case 'files':
        return this.uploadRequest.update((n) => n + 1);
    }
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

  open(kind: 'event' | 'task', item?: PersonalEvent | PersonalTask, day?: string) {
    this.form.reset({
      title: '',
      description: '',
      starts_at: `${day ?? this.selectedDay()}T09:00`,
      ends_at: '',
      location: '',
      category: 'sonstiges',
      due_date: '',
      due_time: '',
      priority: 'MEDIUM',
      status: 'OPEN',
      project: '',
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
          category: item.category ?? 'sonstiges',
        });
      else
        this.form.patchValue({
          due_date: item.due_date || '',
          due_time: item.due_time?.slice(0, 5) || '',
          priority: item.priority,
          status: item.status,
          project: item.project ?? '',
        });
    }
  }

  newEventOn(day: string) {
    this.selectedDay.set(day);
    this.open('event', undefined, day);
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
              category: v.category as PersonalEvent['category'],
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
              project: v.project.trim(),
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
        this.formError.set('Speichern fehlgeschlagen. Bitte prüfe deine Angaben und versuche es erneut.');
      },
    });
  }

  toggle(task: PersonalTask) {
    if (this.saving()) return;
    this.saving.set(true);
    // Sofort sichtbar abhaken; bei einem Fehler springt die Zeile zurück.
    const next: PersonalTask['status'] = task.status === 'DONE' ? 'OPEN' : 'DONE';
    this.tasks.update((list) => list.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    this.api
      .saveTask({ status: next }, task.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.tasks.update((list) => list.map((t) => (t.id === task.id ? task : t)));
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

  // ---------- Notizen ----------
  readonly noteOpen = signal(false);
  readonly noteId = signal<number | undefined>(undefined);
  readonly noteTitle = signal('');
  readonly noteBody = signal('');
  readonly notePinned = signal(false);
  readonly noteError = signal('');

  openNote(note?: PersonalNote) {
    this.noteId.set(note?.id);
    this.noteTitle.set(note?.title ?? '');
    this.noteBody.set(note?.body ?? '');
    this.notePinned.set(note?.pinned ?? false);
    this.noteError.set('');
    this.noteOpen.set(true);
  }

  saveNote() {
    if (this.saving()) return;
    const title = this.noteTitle().trim();
    if (!title) {
      this.noteError.set('Bitte gib einen Titel ein.');
      return;
    }
    this.saving.set(true);
    this.api
      .saveNote({ title, body: this.noteBody().trim(), pinned: this.notePinned() }, this.noteId())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.noteOpen.set(false);
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.noteError.set('Speichern fehlgeschlagen. Bitte versuche es erneut.');
        },
      });
  }

  togglePin(note: PersonalNote) {
    this.api
      .saveNote({ title: note.title, body: note.body, pinned: !note.pinned }, note.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: () => this.load(), error: () => this.error.set('Die Notiz konnte nicht gespeichert werden.') });
  }

  removeNote() {
    const id = this.noteId();
    if (!id || this.saving()) return;
    this.saving.set(true);
    this.api
      .removeNote(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.noteOpen.set(false);
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.noteError.set('Löschen fehlgeschlagen. Bitte versuche es erneut.');
        },
      });
  }
}
