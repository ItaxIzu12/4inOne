import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { MobileAction } from '../../shared/mobile-action/mobile-action';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppShell } from '../../layout/app-shell';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { ConnectionsSection } from '../../shared/connections/connections-section';
import { AppDatePicker } from '../../shared/form/date-picker';
import { Field } from '../../shared/form/field';
import { AppSelect, SelectOption } from '../../shared/form/select';
import { AppTimePicker } from '../../shared/form/time-picker';
import { ModalForm } from '../../shared/form/modal-form';
import { ScopeNote } from '../../shared/scope-note/scope-note';
import { CalendarShares, DayRange, EventInput, OrganisationApi, PersonalEvent, PersonalNote, PersonalTask, Repeat, SharedCalendar, TaskInput } from './organisation-api.service';
import { EVENT_CATEGORIES, eventsOn, localDay } from './organisation-logic';
import { CalendarView, OrgCalendar } from './org-calendar';
import { CalendarFilter, OrgCalendars } from './org-calendars';
import { OrgDaySheet } from './org-day-sheet';
import { AttachmentField } from '../../shared/attachments/attachment-field';
import { OrgTasks } from './org-tasks';
import { OrgNotes } from './org-notes';
import { OrgImportDialog } from './org-import-dialog';
import { OrgToday } from './org-today';
import { SaveFeedback } from '../../shared/save-feedback/save-feedback';

export { localDay } from './organisation-logic';

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export type OrgTab = 'today' | 'calendar' | 'tasks' | 'notes';
// Organisation (31.10.2026): „Heute“ zuerst — der Tag als eine Linie aus Terminen, Aufgaben und freier Zeit.
const TABS: { key: OrgTab; label: string; icon: IconName }[] = [
  { key: 'today', label: 'Heute', icon: 'clock' },
  { key: 'calendar', label: 'Kalender', icon: 'calendar' },
  { key: 'tasks', label: 'Aufgaben', icon: 'check-circle' },
  { key: 'notes', label: 'Notizen', icon: 'file-text' },
];
const TAB_KEYS = TABS.map((t) => t.key);
const HEAD_ACTIONS: Record<OrgTab, string> = {
  today: 'Termin hinzufügen',
  calendar: 'Termin hinzufügen',
  tasks: 'Aufgabe hinzufügen',
  notes: 'Notiz erstellen',
};
const REPEAT_OPTIONS: SelectOption[] = [
  { value: '', label: 'Einmalig' },
  { value: 'daily', label: 'Täglich' },
  { value: 'weekly', label: 'Wöchentlich' },
  { value: 'monthly', label: 'Monatlich' },
  { value: 'yearly', label: 'Jährlich' },
];

/** Erste Fehlermeldung eines Felds aus einer 400-Antwort (DRF liefert sie pro Feld). */
function apiFieldError(error: unknown, field: string): string {
  if (!(error instanceof HttpErrorResponse) && !(error as { status?: number })?.status) return '';
  const body = (error as { error?: Record<string, unknown> }).error;
  const value = body?.[field];
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : '';
}

/**
 * Organisation: Kalender · Aufgaben · Notizen — privat, nur für die eigene
 * Person (der Server filtert nach Eigentümer). Diese Komponente ist die
 * Seitenhülle: Kopf, Reiter, Laden und die gemeinsamen Formulare. Der
 * Kalender lädt nur seinen sichtbaren Zeitraum; nach Änderungen wird gezielt
 * der betroffene Teil neu geladen, nie die ganze Seite. Fehler stehen direkt
 * am Feld; nur ein fehlgeschlagenes Speichern erscheint oben.
 */
@Component({
  selector: 'app-organisation',
  standalone: true,
  imports: [
    MobileAction, ErrorNoticeDirective, AppShell, AppIcon, ConnectionsSection, Field, ModalForm, ReactiveFormsModule,
    AppSelect, AppDatePicker, AppTimePicker, OrgCalendar, OrgCalendars, OrgDaySheet, AttachmentField, OrgTasks, OrgNotes, OrgToday, ScopeNote, OrgImportDialog, SaveFeedback,
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
  readonly tab = signal<OrgTab>('today');
  readonly headAction = computed(() => HEAD_ACTIONS[this.tab()]);

  // ---------- Daten ----------
  readonly events = signal<PersonalEvent[]>([]);
  /** Kalender-Import (ICS) geöffnet, und die kurze Bestätigung danach. */
  readonly importOpen = signal(false);
  readonly notice = signal('');
  readonly tasks = signal<PersonalTask[]>([]);
  readonly notes = signal<PersonalNote[]>([]);
  readonly loading = signal(true);
  readonly eventsLoading = signal(true);
  readonly error = signal('');
  readonly eventsError = signal('');
  private range: DayRange | null = null;

  // ---------- Kalender ----------
  readonly selectedDay = signal(localDay(new Date()));
  readonly calendarView = signal<CalendarView>(
    typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches ? 'week' : 'month',
  );

  // ---------- Gemeinsame Kalender (31.10.2026) ----------
  readonly calendars = signal<SharedCalendar[]>([]);
  readonly calendarFilter = signal<CalendarFilter>('all');
  /** Kalenderfreigaben wie Outlook: für wen meiner freigegeben ist, wer seinen für mich freigegeben hat. */
  readonly shares = signal<CalendarShares | null>(null);
  /** Kalender-Ansicht nach Filter: alle, nur meine, ein gemeinsamer Kalender oder der Kalender einer Person. */
  readonly visibleEvents = computed(() => {
    const filter = this.calendarFilter();
    const list = this.events();
    if (filter === 'all') return list;
    if (filter === 'mine') return list.filter((e) => !e.calendar && !e.shared_by);
    if (typeof filter === 'string') return list.filter((e) => !e.calendar && e.shared_by === Number(filter.slice(1)));
    return list.filter((e) => e.calendar === filter);
  });
  /** Mit wem ein eigener Termin geteilt wird (Konto-IDs; nur Personen mit Kalenderfreigabe). */
  readonly audience = signal<number[]>([]);
  readonly sharePeople = computed(() => this.shares()?.given ?? []);
  toggleAudience(userId: number) {
    this.audience.update((list) => (list.includes(userId) ? list.filter((id) => id !== userId) : [...list, userId]));
  }
  makePrivate() {
    this.form.controls.calendar.setValue('');
    this.audience.set([]);
  }
  /** Kalender, in die ich Termine eintragen darf (Besitzer:in oder „Kann bearbeiten“). */
  readonly writableCalendars = computed(() => this.calendars().filter((c) => c.role !== 'VIEWER'));
  /** Der geöffnete Termin gehört zu einem gemeinsamen Kalender und wurde von jemand anderem eingetragen. */
  private readonly editingEvent = signal<PersonalEvent | null>(null);
  readonly foreignEvent = computed(() => !!this.editingEvent()?.created_by);
  /** Nur ansehen: gemeinsamer Termin ohne Schreibrecht. */
  readonly eventReadOnly = computed(() => {
    const e = this.editingEvent();
    return this.editor() === 'event' && e && e.can_edit === false ? e : null;
  });
  /** Den Kalender eines fremden Termins ändert nur, wer ihn eingetragen hat (Server-Regel). */
  readonly calendarLocked = computed(() => !!this.editId() && this.foreignEvent());
  private readonly calendarValue = signal('');
  readonly calendarHint = computed(() => {
    if (this.calendarLocked()) return `Eingetragen von ${this.editingEvent()?.created_by} – wer den Termin sieht, bestimmt nur diese Person.`;
    const id = Number(this.calendarValue());
    const calendar = this.calendars().find((c) => c.id === id);
    const chosen = new Set(this.audience());
    const names = [
      ...(calendar?.members.filter((m) => !m.is_self).map((m) => m.name) ?? []),
      ...this.sharePeople().filter((p) => chosen.has(p.user_id)).map((p) => p.name),
    ].filter((name, i, all) => all.indexOf(name) === i);
    if (!calendar && !names.length) return 'Privat – nur du siehst diesen Termin.';
    if (!names.length) return `Noch niemand außer dir in „${calendar!.name}“.`;
    return `${names.join(', ')} ${names.length === 1 ? 'sieht' : 'sehen'} diesen Termin – deine anderen Termine bleiben privat.`;
  });
  loadCalendars() {
    this.api.calendars().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (list) => {
        this.calendars.set(list);
        const filter = this.calendarFilter();
        if (typeof filter === 'number' && !list.some((c) => c.id === filter)) this.calendarFilter.set('all');
      },
      error: () => this.calendars.set([]),
    });
    this.api.shares().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (raw) => {
        // Nur eine vollständige Antwort übernehmen — sonst so tun, als gäbe es keine Freigaben
        const shares = raw && Array.isArray(raw.given) && Array.isArray(raw.received) && Array.isArray(raw.pending) ? raw : null;
        this.shares.set(shares);
        if (!shares) return;
        const filter = this.calendarFilter();
        if (typeof filter === 'string' && filter.startsWith('p') && !shares.received.some((r) => `p${r.user_id}` === filter)) this.calendarFilter.set('all');
      },
      error: () => this.shares.set(null),
    });
  }
  calendarsChanged() {
    this.loadCalendars();
    if (this.range) this.loadEvents(this.range);
  }
  /** „Samstag, 2. November · 18:30–21:00“ für die Nur-ansehen-Ansicht. */
  readOnlyWhen(e: PersonalEvent): string {
    const start = new Date(e.starts_at);
    const day = start.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    if (e.all_day) return `${day} · ganztägig`;
    const end = e.ends_at ? `–${hhmm(e.ends_at)}` : '';
    return `${day} · ${hhmm(e.starts_at)}${end} Uhr`;
  }

  // ---------- Formular Termin/Aufgabe ----------
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly editor = signal<'event' | 'task' | null>(null);
  readonly editId = signal<number | undefined>(undefined);
  readonly editingSeries = signal(false);
  readonly titleError = signal('');
  readonly dateError = signal('');
  readonly endError = signal('');
  readonly endDateError = signal('');
  readonly dueError = signal('');
  readonly timeError = signal('');
  readonly priorityOptions: SelectOption[] = [
    { value: 'LOW', label: 'Niedrig' },
    { value: 'MEDIUM', label: 'Normal' },
    { value: 'HIGH', label: 'Hoch' },
  ];
  readonly statusOptions: SelectOption[] = [
    { value: 'OPEN', label: 'Offen' },
    { value: 'IN_PROGRESS', label: 'In Bearbeitung' },
    { value: 'DONE', label: 'Erledigt' },
  ];
  readonly repeatOptions = REPEAT_OPTIONS;
  readonly categoryOptions: SelectOption[] = EVENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }));
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', Validators.maxLength(5000)],
    date: [''],
    all_day: [false],
    start_time: [''],
    end_date: [''],
    end_time: [''],
    recurrence: [''],
    location: ['', Validators.maxLength(240)],
    category: ['sonstiges'],
    due_date: [''],
    due_time: [''],
    priority: ['MEDIUM'],
    status: ['OPEN'],
    project: ['', Validators.maxLength(60)],
    /** Gemeinsamer Kalender als ID-Text, '' = privat (nur ich). */
    calendar: [''],
  });

  constructor() {
    const raw = this.route.snapshot.queryParamMap.get('tab');
    // Alte Links (Übersicht, Dateien) landen bei „Heute“.
    if (raw && TAB_KEYS.includes(raw as OrgTab)) this.tab.set(raw as OrgTab);
    else if (raw) this.selectTab('today');
    this.load(true);
    this.loadCalendars();
    if (this.tab() === 'today') this.loadToday();
    this.form.controls.calendar.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe((v) => this.calendarValue.set(v));
    // Wechsel auf ein anderes Objekt derselben Seite (z. B. Aufgabe → verknüpfter Termin)
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      if (this.loaded) this.openFromQuery();
    });
  }

  /** Aufgaben und Notizen; Termine lädt der Kalender für seinen Zeitraum (loadEvents). */
  load(openRequested = false) {
    this.loading.set(this.tasks().length === 0 && this.notes().length === 0);
    this.error.set('');
    forkJoin({ tasks: this.api.tasks(), notes: this.api.notes() })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.tasks.set(r.tasks);
          this.notes.set(r.notes);
          this.loading.set(false);
          this.loaded = true;
          if (openRequested) this.openFromQuery();
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Deine Aufgaben und Notizen konnten nicht geladen werden. Bitte versuche es erneut.');
        },
      });
    if (this.range) this.loadEvents(this.range);
  }

  onImported(created: number) {
    this.notice.set(created === 1 ? '1 Termin importiert.' : `${created} Termine importiert.`);
    if (this.range) this.loadEvents(this.range);
  }
  loadEvents(range: DayRange) {
    this.range = range;
    this.eventsLoading.set(this.events().length === 0);
    this.eventsError.set('');
    this.api
      .events(range)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (events) => {
          // Nur übernehmen, wenn noch derselbe Zeitraum gilt (schnelles Blättern).
          if (this.range === range) {
            this.events.set(events);
            this.eventsLoading.set(false);
          }
        },
        error: () => {
          this.eventsLoading.set(false);
          this.eventsError.set('Die Termine konnten nicht geladen werden.');
        },
      });
  }

  private reloadTasks() {
    this.api.tasks().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (tasks) => this.tasks.set(tasks),
      error: () => this.error.set('Die Aufgaben konnten nicht aktualisiert werden.'),
    });
  }

  private reloadNotes() {
    this.api.notes().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (notes) => this.notes.set(notes),
      error: () => this.error.set('Die Notizen konnten nicht geladen werden.'),
    });
  }

  /** „Heute“ braucht nur die Termine dieses Tages (der Kalender lädt seinen Zeitraum selbst, sobald er erscheint). */
  loadToday() {
    const day = localDay(new Date());
    this.loadEvents({ start: day, end: day });
  }

  selectTab(tab: OrgTab) {
    this.tab.set(tab);
    if (tab === 'today') this.loadToday();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'today' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onTabKeydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const index = TAB_KEYS.indexOf(this.tab());
    const next = TAB_KEYS[(index + (event.key === 'ArrowRight' ? 1 : TAB_KEYS.length - 1)) % TAB_KEYS.length];
    this.selectTab(next);
    queueMicrotask(() => document.getElementById(`org-tab-${next}`)?.focus());
  }

  /** Hauptknopf im Kopf — öffnet das passende Formular des Reiters. */
  headActionClick() {
    switch (this.tab()) {
      case 'today':
        return this.open('event', undefined, localDay(new Date()));
      case 'calendar':
        return this.open('event', undefined, this.selectedDay());
      case 'tasks':
        return this.open('task');
      case 'notes':
        return this.openNote();
    }
  }

  /** Deep-Link (?kind=task|event&id=…) aus Dashboard und „Verknüpft“: öffnet das Objekt und räumt die Adresse auf. */
  private openFromQuery() {
    const q = this.route.snapshot.queryParamMap;
    // Schnellerfassung von der Startseite: nur diese festen Werte, danach Adresse aufräumen.
    const fresh = q.get('neu');
    if (fresh === 'termin' || fresh === 'aufgabe' || fresh === 'notiz') {
      const tab: OrgTab = fresh === 'termin' ? 'calendar' : fresh === 'aufgabe' ? 'tasks' : 'notes';
      this.tab.set(tab);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { neu: null, tab },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      if (fresh === 'notiz') this.openNote();
      else this.open(fresh === 'termin' ? 'event' : 'task');
      return;
    }
    const kind = q.get('kind');
    const id = Number(q.get('id'));
    if ((kind !== 'event' && kind !== 'task') || !id) return;
    // Eine einzige Navigation: Reiter setzen und die Adresse aufräumen. Zwei getrennte Navigationen
    // (Reiter, dann kind/id leeren) überschreiben sich gegenseitig und lassen kind= stehen.
    const tab: OrgTab = kind === 'task' ? 'tasks' : 'calendar';
    this.tab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { kind: null, id: null, tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (kind === 'task') {
      const task = this.tasks().find((t) => t.id === id);
      if (task) this.open('task', task);
      return;
    }
    this.api.event(id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (event) => {
        this.selectedDay.set(localDay(new Date(event.starts_at)));
        this.open('event', event);
      },
      error: () => undefined,
    });
  }

  private clearErrors() {
    for (const s of [this.formError, this.titleError, this.dateError, this.endError, this.endDateError, this.dueError, this.timeError]) s.set('');
  }

  /** Termin von einem angeklickten Tag: der Tag steht fest und ist im Formular gesperrt. */
  readonly dateLocked = signal(false);
  /** Tagesblatt (31.10.2026): angeklickter Tag mit Terminen; nach Termin-Dialog geht es dorthin zurück. */
  readonly daySheet = signal<string | null>(null);
  private returnToDay: string | null = null;
  /** Klick auf einen Tag: mit Terminen erst das Tagesblatt, leere Tage direkt „Termin hinzufügen“. */
  openOnDay(day: string) {
    if (eventsOn(this.visibleEvents(), day).length) {
      this.daySheet.set(day);
      return;
    }
    this.addOnDay(day);
  }
  private addOnDay(day: string) {
    this.open('event', undefined, day);
    this.dateLocked.set(true);
  }
  fromSheetOpen(e: PersonalEvent) {
    this.returnToDay = this.daySheet();
    this.daySheet.set(null);
    this.open('event', e);
  }
  fromSheetAdd(day: string) {
    this.returnToDay = day;
    this.daySheet.set(null);
    this.addOnDay(day);
  }
  /** Termin-Dialog zu: war er aus dem Tagesblatt geöffnet, zurück dorthin (weitere Termine eintragen). */
  private editorClosed() {
    this.editor.set(null);
    if (this.returnToDay) this.daySheet.set(this.returnToDay);
    this.returnToDay = null;
  }
  open(kind: 'event' | 'task', item?: PersonalEvent | PersonalTask, day?: string) {
    this.dateLocked.set(false);
    this.form.reset({
      title: '', description: '', date: day ?? localDay(new Date()), all_day: false, start_time: '09:00', end_date: '',
      end_time: '', recurrence: '', location: '', category: 'sonstiges', due_date: '', due_time: '', priority: 'MEDIUM',
      status: 'OPEN', project: '',
      // Neuer Termin: im gerade gefilterten gemeinsamen Kalender, wenn ich dort schreiben darf — sonst privat
      calendar: typeof this.calendarFilter() === 'number' && this.writableCalendars().some((c) => c.id === this.calendarFilter()) ? String(this.calendarFilter()) : '',
    });
    this.calendarValue.set(this.form.controls.calendar.value);
    this.audience.set(item && 'starts_at' in item ? [...(item.shared_with ?? [])] : []);
    this.editingEvent.set(item && 'starts_at' in item ? item : null);
    this.editor.set(kind);
    this.editId.set(item?.id);
    this.editingSeries.set(false);
    this.clearErrors();
    if (!item) return;
    this.form.patchValue({ title: item.title, description: item.description });
    if ('starts_at' in item) {
      // Bei einer Wiederholung wird die Serie bearbeitet: Datum der Serie, Dauer des Vorkommens.
      const start = new Date(item.series_starts_at ?? item.starts_at);
      const length = item.ends_at ? new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime() : null;
      const end = length !== null ? new Date(start.getTime() + length) : null;
      this.editingSeries.set(!!item.recurrence);
      this.form.patchValue({
        date: localDay(start),
        all_day: item.all_day,
        start_time: item.all_day ? '' : hhmm(start.toISOString()),
        end_date: end && localDay(end) !== localDay(start) ? localDay(end) : '',
        end_time: end && !item.all_day ? hhmm(end.toISOString()) : '',
        recurrence: item.recurrence ?? '',
        location: item.location,
        category: item.category ?? 'sonstiges',
        calendar: item.calendar ? String(item.calendar) : '',
      });
    } else {
      this.form.patchValue({
        due_date: item.due_date || '',
        due_time: item.due_time?.slice(0, 5) || '',
        priority: item.priority,
        status: item.status,
        project: item.project ?? '',
        recurrence: item.repeat && item.repeat !== 'custom' ? item.repeat : '',
      });
    }
  }

  close() {
    if (!this.saving()) this.editorClosed();
  }

  /** Datum + Uhrzeit → ISO; ganztägig oder ohne Uhrzeit: Mitternacht dieses Tags. */
  private eventInput(): EventInput | null {
    const v = this.form.getRawValue();
    const allDay = v.all_day || !v.start_time;
    const starts = new Date(`${v.date}T${allDay ? '00:00' : v.start_time}`);
    let ends: Date | null = null;
    if (allDay) {
      if (v.end_date && v.end_date !== v.date) ends = new Date(`${v.end_date}T00:00`);
    } else if (v.end_time || v.end_date) {
      ends = new Date(`${v.end_date || v.date}T${v.end_time || v.start_time}`);
    }
    if (ends && ends < starts) {
      if ((v.end_date || v.date) === v.date && !allDay) this.endError.set('Das Ende liegt vor dem Beginn.');
      else this.endDateError.set('Das Enddatum liegt vor dem Startdatum.');
      return null;
    }
    return {
      title: v.title.trim(),
      description: v.description,
      location: v.location.trim(),
      category: v.category as PersonalEvent['category'],
      starts_at: starts.toISOString(),
      ends_at: ends ? ends.toISOString() : null,
      all_day: allDay,
      recurrence: v.recurrence as Repeat | '',
      calendar: v.calendar ? Number(v.calendar) : null,
      // Wer den Termin sieht, bestimmt nur, wer ihn eingetragen hat — bei fremden Terminen nichts mitschicken.
      ...(this.foreignEvent() ? {} : { shared_with: this.audience() }),
    };
  }

  save() {
    if (this.saving()) return;
    this.clearErrors();
    const v = this.form.getRawValue();
    if (!v.title.trim()) this.titleError.set('Bitte gib einen Titel ein.');
    const kind = this.editor();
    if (kind === 'event' && !v.date) this.dateError.set('Bitte wähle ein Datum.');
    if (kind === 'task' && v.due_time && !v.due_date) this.timeError.set('Zur Uhrzeit gehört ein Fälligkeitsdatum.');
    if (kind === 'task' && v.recurrence && !v.due_date) this.dueError.set('Eine wiederkehrende Aufgabe braucht ein Fälligkeitsdatum.');
    if (this.titleError() || this.dateError() || this.timeError() || this.dueError()) return;
    if (kind === 'event') {
      const input = this.eventInput();
      if (!input) return;
      this.submit(this.api.saveEvent(input, this.editId()), 'Der Termin konnte nicht gespeichert werden.');
    } else {
      const input: TaskInput = {
        title: v.title.trim(),
        description: v.description,
        due_date: v.due_date || null,
        due_time: v.due_time || null,
        priority: v.priority as PersonalTask['priority'],
        status: v.status as PersonalTask['status'],
        project: v.project.trim(),
        recurrence: (v.recurrence || null) as Repeat | null,
      };
      this.submit(this.api.saveTask(input, this.editId()), 'Die Aufgabe konnte nicht gespeichert werden.');
    }
  }

  private submit(request: Observable<PersonalEvent | PersonalTask>, failure: string) {
    const kind = this.editor();
    this.saving.set(true);
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.saving.set(false);
        this.editorClosed();
        if (kind === 'event' && this.range) this.loadEvents(this.range);
        else this.reloadTasks();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        // Feldfehler vom Server direkt am Feld; sonst eine verständliche Meldung oben. Eingaben bleiben erhalten.
        this.titleError.set(apiFieldError(error, 'title'));
        this.endError.set(apiFieldError(error, 'ends_at'));
        this.dueError.set(apiFieldError(error, 'due_date'));
        this.timeError.set(apiFieldError(error, 'due_time'));
        if (!this.titleError() && !this.endError() && !this.dueError() && !this.timeError()) this.formError.set(failure);
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
        next: (saved) => {
          this.saving.set(false);
          // Wiederkehrend: der Server hat die Fälligkeit weitergerückt, die Aufgabe bleibt offen.
          this.tasks.update((list) => list.map((t) => (t.id === saved.id ? saved : t)));
        },
        error: () => {
          this.saving.set(false);
          this.tasks.update((list) => list.map((t) => (t.id === task.id ? task : t)));
          this.error.set('Die Aufgabe konnte nicht aktualisiert werden.');
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
          this.editorClosed();
          if (kind === 'event') this.events.update((list) => list.filter((e) => e.id !== id));
          else this.tasks.update((list) => list.filter((t) => t.id !== id));
        },
        error: () => {
          this.saving.set(false);
          this.formError.set(kind === 'event' ? 'Der Termin konnte nicht gelöscht werden.' : 'Die Aufgabe konnte nicht gelöscht werden.');
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
  readonly noteBodyError = signal('');
  /** Anhänge der geöffneten Notiz (Fotos/PDF, Test 31.10.2026). */
  readonly noteAttachments = signal<PersonalNote['attachments']>([]);
  private readonly attachmentBox = viewChild(AttachmentField);
  /** Private Datei mit Anmeldung laden (Vorschau/Öffnen). */
  readonly loadFile = (id: number) => this.api.fileBlob(id);

  openNote(note?: PersonalNote) {
    this.noteId.set(note?.id);
    this.noteAttachments.set(note?.attachments ?? []);
    this.attachmentBox()?.reset();
    this.noteTitle.set(note?.title ?? '');
    this.noteBody.set(note?.body ?? '');
    this.notePinned.set(note?.pinned ?? false);
    this.noteError.set('');
    this.noteBodyError.set('');
    this.noteOpen.set(true);
  }

  saveNote() {
    if (this.saving()) return;
    const title = this.noteTitle().trim();
    const body = this.noteBody().trim();
    this.noteError.set('');
    this.noteBodyError.set(!title && !body ? 'Bitte schreib etwas in die Notiz.' : '');
    if (this.noteBodyError()) return;
    this.saving.set(true);
    let saved = false;
    this.api
      .saveNote({ title, body, pinned: this.notePinned() }, this.noteId())
      .pipe(
        // Anhänge erst nach der Notiz: eine neue Notiz braucht zuerst ihre ID
        switchMap((note) => {
          saved = true;
          this.noteId.set(note.id); // erneuter Versuch ändert dieselbe Notiz statt eine zweite anzulegen
          const box = this.attachmentBox();
          return box
            ? box.commit((file) => this.api.uploadNoteFile(note.id, file), (id) => this.api.removeFile(id)).pipe(map(() => note))
            : of(note);
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.noteOpen.set(false);
          this.reloadNotes();
        },
        error: (e: { status?: number; error?: { file?: string[] | string } }) => {
          this.saving.set(false);
          const reason = Array.isArray(e?.error?.file) ? e.error.file[0] : (e?.error?.file ?? '');
          this.noteError.set(
            saved
              ? `Die Notiz ist gespeichert, aber eine Datei konnte nicht hochgeladen werden.${reason ? ' ' + reason : ''} Du kannst es noch einmal versuchen.`
              : 'Die Notiz konnte nicht gespeichert werden.',
          );
          // Was schon hochgeladen ist, steht jetzt bei der Notiz — die Kacheln zeigen den echten Stand
          if (saved) {
            this.api.notes().pipe(takeUntilDestroyed(this.destroy)).subscribe((list) => {
              this.notes.set(list);
              this.noteAttachments.set(list.find((n) => n.id === this.noteId())?.attachments ?? []);
            });
          }
        },
      });
  }

  /** „Schnell notieren“: eine Zeile ohne Dialog als Notiz speichern (Titel ergibt sich aus der ersten Zeile). */
  quickNote(text: string) {
    if (this.saving() || !text.trim()) return;
    this.saving.set(true);
    this.api
      .saveNote({ title: '', body: text.trim(), pinned: false })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.reloadNotes();
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Die Notiz konnte nicht gespeichert werden.');
        },
      });
  }

  togglePin(note: PersonalNote) {
    this.notes.update((list) => list.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n)));
    this.api
      .saveNote({ title: note.title, body: note.body, pinned: !note.pinned }, note.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => this.reloadNotes(),
        error: () => {
          this.notes.update((list) => list.map((n) => (n.id === note.id ? note : n)));
          this.error.set('Die Notiz konnte nicht gespeichert werden.');
        },
      });
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
          this.notes.update((list) => list.filter((n) => n.id !== id));
        },
        error: () => {
          this.saving.set(false);
          this.noteError.set('Die Notiz konnte nicht gelöscht werden.');
        },
      });
  }
}
