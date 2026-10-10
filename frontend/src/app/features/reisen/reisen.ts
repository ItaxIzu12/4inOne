import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { AmountInput } from '../../shared/directives/amount-input';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppShell } from '../../layout/app-shell';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { AppDatePicker } from '../../shared/form/date-picker';
import { Field } from '../../shared/form/field';
import { AppSelect, SelectOption } from '../../shared/form/select';
import { ModalForm } from '../../shared/form/modal-form';
import { AppTimePicker } from '../../shared/form/time-picker';
import { MobileAction } from '../../shared/mobile-action/mobile-action';
import { Modal } from '../../shared/modal/modal';
import { ConnectionsSection } from '../../shared/connections/connections-section';
import {
  BudgetCategory,
  ContactOption,
  PackingCategory,
  PackingItem,
  ReisenApi,
  Trip,
  TripBudgetCategory,
  TripExpense,
  TripParticipant,
  TripTask,
} from './reisen-api.service';
import { buildTripSuggestions, guessClimate, SuggestedPackingItem, SuggestedTask } from './trip-suggestions';
import { TripList } from './trip-list';
import { TripPacking } from './trip-packing';
import { TripBudget } from './trip-budget';
import { TripPlanning } from './trip-planning';
import { TripOverview, TripTab } from './trip-overview';
import {
  BUDGET_META,
  BUDGET_ORDER,
  PACKING_META,
  PACKING_ORDER,
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_TONE,
  dateRange,
  dueLabel,
  formatMoney,
  localDay,
  longRange,
  shortRange,
  totalBudget,
  tripIcon,
} from './reisen-logic';

export { formatMoney, localDay } from './reisen-logic';
export type SuggestionScope = 'all' | 'tasks' | 'packing';
export type { TripTab } from './trip-overview';

/** Innerhalb einer Reise genau vier Reiter (docs/REISEN_V1.md). */
const TABS: { key: TripTab; label: string; icon: IconName }[] = [
  { key: 'uebersicht', label: 'Übersicht', icon: 'home' },
  { key: 'planung', label: 'Planung', icon: 'check-circle' },
  { key: 'packliste', label: 'Packliste', icon: 'luggage' },
  { key: 'budget', label: 'Budget', icon: 'coins' },
];
/** Alte Links (vor V1) landen im passenden neuen Reiter. */
const LEGACY_TABS: Record<string, TripTab> = { packlisten: 'packliste', erinnerungen: 'planung' };

@Component({
  selector: 'app-reisen',
  standalone: true,
  imports: [
    ErrorNoticeDirective,
    AmountInput,
    AppShell,
    AppIcon,
    Field,
    ModalForm,
    Modal,
    ReactiveFormsModule,
    AppSelect,
    AppDatePicker,
    AppTimePicker,
    ConnectionsSection,
    TripList,
    TripOverview,
    TripPlanning,
    TripPacking,
    TripBudget,
    MobileAction,
  ],
  templateUrl: './reisen.html',
  styleUrl: './reisen.scss',
})
export class Reisen {
  private api = inject(ReisenApi);
  private destroy = inject(DestroyRef);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected readonly formatMoney = formatMoney;
  protected readonly tripIcon = tripIcon;
  protected readonly range = dateRange;
  protected readonly shortRange = shortRange;
  protected readonly longRange = longRange;

  readonly tabs = TABS;
  readonly statusLabels = STATUS_LABELS;
  readonly statusTone = STATUS_TONE;

  // ---------- Navigation: Meine Reisen ↔ eine Reise ----------
  /** Aus ?trip= — null zeigt „Meine Reisen“. */
  readonly selectedTripId = signal<number | null>(null);
  readonly tab = signal<TripTab>('uebersicht');

  readonly trips = signal<Trip[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selectedTrip = computed(() => this.trips().find((t) => t.id === this.selectedTripId()) ?? null);
  /** ?trip= zeigt auf eine Reise, die es nicht (mehr) gibt oder die man nicht sehen darf — gleiche Meldung für beides. */
  readonly missingTrip = computed(() => !this.loading() && !this.error() && this.selectedTripId() !== null && !this.selectedTrip());
  /** Schreiben darf, wer die Reise angelegt hat oder als Besitzer/Bearbeiter mitreist. */
  readonly canEdit = computed(() => {
    const role = this.selectedTrip()?.my_role;
    return role === 'OWNER' || role === 'EDITOR';
  });
  readonly isOwner = computed(() => this.selectedTrip()?.my_role === 'OWNER');

  readonly statusOptions: SelectOption[] = STATUS_ORDER.map((value) => ({ value, label: STATUS_LABELS[value] }));
  // Optional und nur Grundlage für die Vorschläge (trip-suggestions.ts) — deshalb immer mit „Keine Angabe“.
  readonly travelTypeOptions: SelectOption[] = [
    { value: '', label: 'Keine Angabe' },
    { value: 'CITY_TRIP', label: 'Städtereise' },
    { value: 'BEACH', label: 'Strandurlaub' },
    { value: 'BUSINESS', label: 'Geschäftsreise' },
    { value: 'ROAD_TRIP', label: 'Roadtrip' },
    { value: 'ACTIVE', label: 'Aktivurlaub' },
    { value: 'WINTER', label: 'Wintersport' },
    { value: 'FAMILY', label: 'Familienreise' },
    { value: 'GENERAL', label: 'Allgemein' },
  ];
  readonly transportTypeOptions: SelectOption[] = [
    { value: '', label: 'Keine Angabe' },
    { value: 'FLIGHT', label: 'Flugzeug' },
    { value: 'TRAIN', label: 'Zug' },
    { value: 'CAR', label: 'Auto' },
    { value: 'BUS', label: 'Bus' },
    { value: 'OTHER', label: 'Sonstiges' },
  ];
  readonly climateOptions: SelectOption[] = [
    { value: '', label: 'Keine Angabe' },
    { value: 'WARM', label: 'Warm' },
    { value: 'MILD', label: 'Mild' },
    { value: 'COLD', label: 'Kalt' },
    { value: 'SNOW', label: 'Schnee' },
  ];
  readonly baggageTypeOptions: SelectOption[] = [
    { value: '', label: 'Keine Angabe' },
    { value: 'HAND_LUGGAGE', label: 'Nur Handgepäck' },
    { value: 'CHECKED_BAGGAGE', label: 'Aufgabegepäck' },
    { value: 'CAR_LUGGAGE', label: 'Gepäck im Auto' },
    { value: 'UNKNOWN', label: 'Noch unklar' },
  ];
  readonly packingCategoryOrder: PackingCategory[] = PACKING_ORDER;
  readonly packingCategoryLabels = Object.fromEntries(PACKING_ORDER.map((c) => [c, PACKING_META[c].label])) as Record<PackingCategory, string>;
  readonly packingCategoryOptions: SelectOption[] = PACKING_ORDER.map((value) => ({ value, label: PACKING_META[value].label }));
  readonly currencyOptions: SelectOption[] = [
    { value: 'EUR', label: 'Euro (€)' },
    { value: 'USD', label: 'US-Dollar ($)' },
    { value: 'GBP', label: 'Britisches Pfund (£)' },
    { value: 'CHF', label: 'Schweizer Franken (CHF)' },
  ];
  readonly budgetCategoryOrder: BudgetCategory[] = BUDGET_ORDER;
  readonly budgetMeta = BUDGET_META;
  readonly budgetCategoryOptions: SelectOption[] = BUDGET_ORDER.map((value) => ({ value, label: BUDGET_META[value].label }));
  readonly participantRoleOptions: SelectOption[] = [
    { value: 'VIEWER', label: 'Betrachter' },
    { value: 'EDITOR', label: 'Bearbeiter' },
    { value: 'OWNER', label: 'Besitzer' },
  ];
  readonly participantRoleLabels: Record<TripParticipant['role'], string> = {
    OWNER: 'Besitzer',
    EDITOR: 'Bearbeiter',
    VIEWER: 'Betrachter',
  };

  // ---------- Reise anlegen/bearbeiten ----------
  readonly tripEditor = signal(false);
  readonly editTripId = signal<number | undefined>(undefined);
  readonly tripSaving = signal(false);
  readonly tripFormError = signal('');
  readonly tripMoreOpen = signal(false);
  /** Reisen, die sich mit dem eingegebenen Zeitraum überschneiden. Nicht leer: die Warnung ersetzt das Formular,
   * bis „Daten prüfen“ oder „Trotzdem speichern“ gewählt wird. Blockiert nie von selbst. */
  readonly tripOverlaps = signal<Trip[]>([]);
  readonly tripForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    destination: ['', [Validators.required, Validators.maxLength(160)]],
    departure: ['', Validators.maxLength(120)],
    start_date: ['', Validators.required],
    end_date: ['', Validators.required],
    status: ['PLANNED'],
    travel_type: [''],
    transport_type: [''],
    baggage_type: [''],
    climate: [''],
    accommodation: ['', Validators.maxLength(160)],
    accommodation_area: ['', Validators.maxLength(120)],
    transport_note: ['', Validators.maxLength(160)],
    notes: ['', Validators.maxLength(5000)],
  });
  readonly tripTouched = signal(false);
  /** Wetter am Ziel ist vorbelegt (aus Reisemonat oder Wintersport), nicht selbst gewählt — dann darf es mitwandern. */
  readonly climateGuessed = signal(false);
  private settingTripForm = false;
  readonly climateHint = computed(() => {
    if (!this.climateGuessed()) return '';
    return this.tripValue().travel_type === 'WINTER' ? 'Aus „Wintersport“ übernommen – bitte prüfen' : 'Geschätzt nach Reisemonat – bitte prüfen';
  });
  readonly titleError = computed(() => (this.tripTouched() && !this.tripValue().title.trim() ? 'Bitte gib der Reise einen Namen.' : ''));
  readonly destinationError = computed(() => (this.tripTouched() && !this.tripValue().destination.trim() ? 'Bitte gib ein Reiseziel an.' : ''));
  readonly startError = computed(() => (this.tripTouched() && !this.tripValue().start_date ? 'Bitte wähle den ersten Reisetag.' : ''));
  readonly endError = computed(() => {
    const v = this.tripValue();
    if (!this.tripTouched()) return '';
    if (!v.end_date) return 'Bitte wähle den letzten Reisetag.';
    return v.start_date && v.end_date < v.start_date ? 'Das Ende darf nicht vor dem Beginn liegen.' : '';
  });
  private readonly tripValue = signal(this.tripForm.getRawValue());

  // ---------- Inhalte der geöffneten Reise ----------
  readonly packing = signal<PackingItem[]>([]);
  readonly tasks = signal<TripTask[]>([]);
  readonly expenses = signal<TripExpense[]>([]);
  readonly budgetCategories = signal<TripBudgetCategory[]>([]);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');
  readonly actionError = signal('');
  readonly quickBusy = signal(false);

  readonly packingPackedCount = computed(() => this.packing().filter((i) => i.is_packed).length);
  readonly openTasks = computed(() => this.tasks().filter((t) => t.status === 'OPEN'));
  readonly budgetTotal = computed(() => totalBudget(this.selectedTrip(), this.budgetCategories()));
  readonly budgetSpent = computed(() => this.expenses().reduce((sum, e) => sum + Number(e.amount), 0));

  // ---------- Packliste: Formular ----------
  readonly packingEditor = signal(false);
  readonly editPackingId = signal<number | undefined>(undefined);
  readonly packingSaving = signal(false);
  readonly packingFormError = signal('');
  readonly packingForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    category: ['SONSTIGES'],
    quantity: ['1'],
    note: ['', Validators.maxLength(240)],
  });

  // ---------- Aufgaben: Formular ----------
  readonly taskEditor = signal(false);
  readonly editTaskId = signal<number | undefined>(undefined);
  readonly taskSaving = signal(false);
  readonly taskFormError = signal('');
  readonly taskForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    due_date: [''],
    due_time: [''],
    assignee: [''],
    note: ['', Validators.maxLength(240)],
  });
  /** Zuständig sein kann jede Person, die mitreist (Backend prüft dasselbe). */
  readonly assigneeOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Niemand bestimmtes' },
    ...(this.selectedTrip()?.participants ?? []).map((p) => ({ value: String(p.user), label: p.is_self ? `${p.display_name} (Du)` : p.display_name })),
  ]);

  // ---------- Ausgaben: Formular ----------
  readonly expenseEditor = signal(false);
  readonly editExpenseId = signal<number | undefined>(undefined);
  readonly expenseSaving = signal(false);
  readonly expenseFormError = signal('');
  readonly expenseForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    amount: ['', Validators.required],
    date: [localDay(new Date()), Validators.required],
    category: ['SONSTIGES'],
  });

  // ---------- Budget festlegen ----------
  readonly planEditor = signal(false);
  readonly planSaving = signal(false);
  readonly planError = signal('');
  readonly planTotal = signal('');
  readonly planCurrency = signal<Trip['currency']>('EUR');
  readonly planDraft = signal<Record<string, string>>({});
  readonly planSum = computed(() =>
    Object.values(this.planDraft()).reduce((sum, raw) => sum + (Number(raw.replace(',', '.')) || 0), 0),
  );

  constructor() {
    this.tripForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.tripValue.set(this.tripForm.getRawValue()));
    // Wetter am Ziel folgt Datum und Reiseart, solange es nur vorgeschlagen ist; eine eigene Wahl bleibt stehen.
    const { start_date, travel_type, climate } = this.tripForm.controls;
    start_date.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.suggestClimate());
    travel_type.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.suggestClimate());
    climate.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (!this.settingTripForm) this.climateGuessed.set(false);
    });
    // Die Adresse ist die Quelle: ?trip= öffnet eine Reise, ?tab= den Reiter — so funktionieren Zurück-Taste und
    // Links aus Dashboard oder Verknüpfungen.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = Number(params.get('trip'));
      this.selectedTripId.set(Number.isInteger(id) && id > 0 ? id : null);
      const raw = params.get('tab') ?? '';
      const tab = (LEGACY_TABS[raw] ?? raw) as TripTab;
      this.tab.set(TABS.some((t) => t.key === tab) ? tab : 'uebersicht');
      this.actionError.set('');
    });
    this.load();
    effect(() => {
      const trip = this.selectedTrip();
      const id = trip?.id ?? null;
      untracked(() => {
        if (id !== null) this.loadTripDetail(id);
        else this.clearDetail();
      });
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .trips()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (trips) => {
          this.trips.set(trips);
          this.loading.set(false);
          // Schnellerfassung von der Startseite (?neu=reise): das bestehende Formular öffnen, Adresse aufräumen.
          if (this.route.snapshot.queryParamMap.get('neu') === 'reise') {
            void this.router.navigate([], { relativeTo: this.route, queryParams: { neu: null }, queryParamsHandling: 'merge', replaceUrl: true });
            this.openTripEditor();
          }
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Deine Reisen konnten nicht geladen werden. Bitte versuche es erneut.');
        },
      });
  }
  /** Zähler auf den Karten leise aktualisieren — ohne Ladezustand, damit nichts springt. */
  refreshTrips(): void {
    this.api
      .trips()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (trips) => this.trips.set(trips), error: () => undefined });
  }
  private detailFor: number | null = null;
  private clearDetail(): void {
    this.detailFor = null;
    this.packing.set([]);
    this.tasks.set([]);
    this.expenses.set([]);
    this.budgetCategories.set([]);
  }
  retryTripDetail(): void {
    const id = this.selectedTripId();
    if (id !== null) this.loadTripDetail(id, true);
  }
  private loadTripDetail(tripId: number, force = false): void {
    // Dieselbe Reise nach refreshTrips() nicht neu laden — die Listen sind schon aktuell.
    if (!force && this.detailFor === tripId) return;
    this.detailFor = tripId;
    this.detailLoading.set(true);
    this.detailError.set('');
    forkJoin({
      packing: this.api.packingItems(tripId),
      tasks: this.api.tasks(tripId),
      expenses: this.api.expenses(tripId),
      budgetCategories: this.api.budgetCategories(tripId),
    })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          if (this.detailFor !== tripId) return;
          this.packing.set(r.packing);
          this.tasks.set(r.tasks);
          this.expenses.set(r.expenses);
          this.budgetCategories.set(r.budgetCategories);
          this.detailLoading.set(false);
        },
        error: () => {
          this.detailLoading.set(false);
          this.detailError.set('Diese Reise konnte nicht geladen werden.');
        },
      });
  }

  openTrip(id: number, tab: TripTab = 'uebersicht'): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { trip: id, tab: tab === 'uebersicht' ? null : tab } });
  }
  backToList(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { trip: null, tab: null } });
  }
  selectTab(tab: TripTab): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'uebersicht' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  onTabKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const keys = TABS.map((t) => t.key);
    const index = keys.indexOf(this.tab());
    const next = keys[(index + (event.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length];
    this.selectTab(next);
    setTimeout(() => document.getElementById(`reisen-tab-${next}`)?.focus());
  }

  // ---------- Reise anlegen/bearbeiten ----------
  private suggestClimate(): void {
    if (this.settingTripForm) return;
    const { climate, start_date, travel_type } = this.tripForm.getRawValue();
    if (climate && !this.climateGuessed()) return;
    const guess = travel_type === 'WINTER' ? 'SNOW' : guessClimate(start_date);
    this.settingTripForm = true;
    this.tripForm.controls.climate.setValue(guess);
    this.settingTripForm = false;
    this.climateGuessed.set(!!guess);
  }
  openTripEditor(trip?: Trip): void {
    this.settingTripForm = true;
    this.tripForm.reset({
      title: trip?.title ?? '',
      destination: trip?.destination ?? '',
      departure: trip?.departure ?? '',
      start_date: trip?.start_date ?? '',
      end_date: trip?.end_date ?? '',
      status: trip?.status ?? 'PLANNED',
      travel_type: trip?.travel_type ?? '',
      transport_type: trip?.transport_type ?? '',
      baggage_type: trip?.baggage_type ?? '',
      climate: trip?.climate ?? '',
      accommodation: trip?.accommodation ?? '',
      accommodation_area: trip?.accommodation_area ?? '',
      transport_note: trip?.transport_note ?? '',
      notes: trip?.notes ?? '',
    });
    this.settingTripForm = false;
    this.climateGuessed.set(false);
    this.tripTouched.set(false);
    this.tripMoreOpen.set(false);
    this.editTripId.set(trip?.id);
    this.tripFormError.set('');
    this.tripOverlaps.set([]);
    this.tripEditor.set(true);
  }
  closeTripEditor(): void {
    if (this.tripSaving()) return;
    // „Daten prüfen“ während der Überschneidungs-Warnung: zurück ins Formular, nicht schließen.
    if (this.tripOverlaps().length) {
      this.tripOverlaps.set([]);
      return;
    }
    this.tripEditor.set(false);
  }
  overlapText(trip: Trip): string {
    return `„${trip.title}“ vom ${shortRange(trip)}`;
  }
  saveTrip(): void {
    if (this.tripSaving()) return;
    this.tripForm.markAllAsTouched();
    this.tripTouched.set(true);
    const v = this.tripForm.getRawValue();
    if (this.titleError() || this.destinationError() || this.startError() || this.endError()) {
      this.tripFormError.set('');
      return;
    }
    this.tripFormError.set('');
    // „Trotzdem speichern“: die Warnung steht schon, der Nutzer hat entschieden.
    if (this.tripOverlaps().length) {
      this.commitTrip(v);
      return;
    }
    this.tripSaving.set(true);
    this.api
      .checkTripOverlaps(v.start_date, v.end_date, this.editTripId())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (overlaps) => {
          this.tripSaving.set(false);
          const relevant = overlaps.filter((t) => t.status !== 'CANCELLED');
          if (relevant.length) this.tripOverlaps.set(relevant);
          else this.commitTrip(v);
        },
        // Die Prüfung ist nur ein Hinweis — schlägt sie fehl, wird trotzdem gespeichert.
        error: () => {
          this.tripSaving.set(false);
          this.commitTrip(v);
        },
      });
  }
  private commitTrip(v: ReturnType<typeof this.tripForm.getRawValue>): void {
    const wasCreate = !this.editTripId();
    this.tripSaving.set(true);
    this.api
      .saveTrip(
        {
          title: v.title.trim(),
          destination: v.destination.trim(),
          departure: v.departure.trim(),
          start_date: v.start_date,
          end_date: v.end_date,
          status: v.status as Trip['status'],
          travel_type: v.travel_type as Trip['travel_type'],
          transport_type: v.transport_type as Trip['transport_type'],
          baggage_type: v.baggage_type as Trip['baggage_type'],
          climate: v.climate as Trip['climate'],
          accommodation: v.accommodation.trim(),
          accommodation_area: v.accommodation_area.trim(),
          transport_note: v.transport_note.trim(),
          notes: v.notes,
        },
        this.editTripId(),
      )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (saved) => {
          this.tripSaving.set(false);
          this.tripEditor.set(false);
          this.tripOverlaps.set([]);
          if (wasCreate) {
            this.trips.update((list) => [...list, saved]);
            this.openTrip(saved.id);
            this.openSmartSetup(saved);
          } else {
            this.trips.update((list) => list.map((t) => (t.id === saved.id ? { ...t, ...saved } : t)));
          }
          this.refreshTrips();
        },
        error: () => {
          this.tripSaving.set(false);
          this.tripOverlaps.set([]);
          this.tripFormError.set('Die Reise konnte nicht gespeichert werden. Bitte prüfe deine Angaben und versuche es erneut.');
        },
      });
  }
  removeTrip(): void {
    const id = this.editTripId();
    if (!id || this.tripSaving()) return;
    this.tripSaving.set(true);
    this.api
      .removeTrip(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.tripSaving.set(false);
          this.tripEditor.set(false);
          this.trips.update((list) => list.filter((t) => t.id !== id));
          this.backToList();
        },
        error: () => {
          this.tripSaving.set(false);
          this.tripFormError.set('Die Reise konnte nicht gelöscht werden. Bitte versuche es erneut.');
        },
      });
  }

  // ---------- Teilnehmer ----------
  readonly participantsEditorTripId = signal<number | null>(null);
  readonly participantsEditorTrip = computed(() => this.trips().find((t) => t.id === this.participantsEditorTripId()) ?? null);
  /** Teilnehmer verwalten darf nur, wer OWNER ist (reisen/permissions.py TripParticipantManagePermission). */
  readonly canManageParticipants = computed(() => this.participantsEditorTrip()?.my_role === 'OWNER');
  readonly participantsSaving = signal(false);
  readonly participantsError = signal('');
  readonly contacts = signal<ContactOption[]>([]);
  readonly contactOptions = computed<SelectOption[]>(() => this.contacts().map((c) => ({ value: String(c.id), label: c.name })));
  readonly newParticipantContactId = signal<number | null>(null);
  readonly newParticipantContactValue = computed(() => (this.newParticipantContactId() !== null ? String(this.newParticipantContactId()) : ''));
  readonly newParticipantRole = signal<TripParticipant['role']>('VIEWER');

  openParticipantsEditor(): void {
    const trip = this.selectedTrip();
    if (!trip) return;
    this.participantsEditorTripId.set(trip.id);
    this.participantsError.set('');
    this.newParticipantContactId.set(null);
    this.newParticipantRole.set('VIEWER');
    if (trip.my_role !== 'OWNER') return;
    this.api
      .contacts()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (contacts) => this.contacts.set(contacts),
        error: () => this.contacts.set([]),
      });
  }
  closeParticipantsEditor(): void {
    if (this.participantsSaving()) return;
    this.participantsEditorTripId.set(null);
  }
  addParticipant(): void {
    const tripId = this.participantsEditorTripId();
    const contactId = this.newParticipantContactId();
    if (!tripId || contactId === null || this.participantsSaving()) return;
    this.participantsSaving.set(true);
    this.participantsError.set('');
    this.api
      .addParticipant(tripId, contactId, this.newParticipantRole())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.participantsSaving.set(false);
          this.newParticipantContactId.set(null);
          this.newParticipantRole.set('VIEWER');
          this.refreshTrips();
        },
        error: () => {
          this.participantsSaving.set(false);
          this.participantsError.set('Die Person konnte nicht hinzugefügt werden. Reist sie vielleicht schon mit?');
        },
      });
  }
  changeParticipantRole(participant: TripParticipant, role: TripParticipant['role']): void {
    this.participantsError.set('');
    this.api
      .updateParticipantRole(participant.id, role)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => this.refreshTrips(),
        error: () => this.participantsError.set(`Die Rolle von „${participant.display_name}“ konnte nicht geändert werden.`),
      });
  }
  removeParticipant(participant: TripParticipant): void {
    this.participantsError.set('');
    this.api
      .removeParticipant(participant.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          // Wer die Reise selbst verlässt, sieht sie danach nicht mehr — zurück zu Meine Reisen.
          if (participant.is_self && this.participantsEditorTrip()?.my_role !== 'OWNER') {
            this.participantsEditorTripId.set(null);
            this.backToList();
            this.load();
            return;
          }
          this.refreshTrips();
        },
        error: () => this.participantsError.set(`„${participant.display_name}“ konnte nicht entfernt werden.`),
      });
  }

  // ---------- Vorschläge (Smart Setup, regelbasiert und optional) ----------
  /** Nicht null: Teaser- oder Prüf-Stufe ist offen. Erscheint direkt nach dem Anlegen einer Reise oder auf Wunsch
   * („Vorlage verwenden“, „Vorschläge ansehen“) — nie beim Bearbeiten, und übernommen wird nur, was angehakt ist. */
  readonly smartSetupTrip = signal<Trip | null>(null);
  readonly smartSetupReview = signal(false);
  /** Aus der Planung nur Aufgaben, aus der Packliste nur Packstücke; direkt nach dem Anlegen beides. */
  readonly smartSetupScope = signal<SuggestionScope>('all');
  readonly smartSetupSuggestions = signal<{ packing: SuggestedPackingItem[]; tasks: SuggestedTask[] }>({ packing: [], tasks: [] });
  readonly smartSetupPackingChecked = signal<boolean[]>([]);
  readonly smartSetupTasksChecked = signal<boolean[]>([]);
  readonly smartSetupPackingGroups = computed(() => {
    const items = this.smartSetupSuggestions().packing;
    return this.packingCategoryOrder
      .map((category) => ({
        category,
        label: this.packingCategoryLabels[category],
        icon: PACKING_META[category].icon,
        entries: items.map((item, index) => ({ item, index })).filter((entry) => entry.item.category === category),
      }))
      .filter((group) => group.entries.length > 0);
  });
  readonly smartSetupEmpty = computed(() => !this.smartSetupSuggestions().packing.length && !this.smartSetupSuggestions().tasks.length);
  readonly smartSetupTotal = computed(() => this.smartSetupSuggestions().packing.length + this.smartSetupSuggestions().tasks.length);
  readonly smartSetupSelected = computed(
    () => this.smartSetupPackingChecked().filter(Boolean).length + this.smartSetupTasksChecked().filter(Boolean).length,
  );
  readonly smartSetupAllSelected = computed(() => this.smartSetupSelected() === this.smartSetupTotal());
  readonly smartSetupHead = computed(() => {
    const scope = this.smartSetupScope();
    if (scope === 'tasks') return { title: 'Vorschläge für die Planung', icon: 'list' as IconName, empty: 'Alle vorgeschlagenen Aufgaben stehen schon in deiner Planung.' };
    if (scope === 'packing') return { title: 'Vorschläge für die Packliste', icon: 'luggage' as IconName, empty: 'Alle vorgeschlagenen Dinge stehen schon auf deiner Packliste.' };
    return { title: `Vorschläge für ${this.smartSetupTrip()?.title ?? 'deine Reise'}`, icon: 'bulb' as IconName, empty: 'Alles Vorgeschlagene steht schon auf deinen Listen.' };
  });
  /** Worauf die (festen, regelbasierten) Vorlagen beruhen — ehrlich, ohne „KI“. */
  readonly smartSetupBasis = computed(() => {
    const trip = this.smartSetupTrip();
    if (!trip) return '';
    const label = (options: SelectOption[], value: string) => (value ? options.find((o) => o.value === value)?.label : undefined);
    const facts = [
      label(this.travelTypeOptions, trip.travel_type),
      label(this.climateOptions, trip.climate),
      label(this.transportTypeOptions, trip.transport_type),
      label(this.baggageTypeOptions, trip.baggage_type),
    ].filter((f): f is string => !!f);
    return facts.length
      ? `Passend zu ${facts.join(' · ')}. Wähle aus, was du übernehmen möchtest.`
      : 'Allgemeine Vorlage. Mit Reiseart, Wetter am Ziel, Transport und Gepäck werden die Vorschläge genauer.';
  });
  readonly smartSetupSubmitLabel = computed(() => {
    const n = this.smartSetupSelected();
    if (!n) return 'Nichts ausgewählt';
    if (this.smartSetupScope() === 'tasks') return n === 1 ? '1 Aufgabe übernehmen' : `${n} Aufgaben übernehmen`;
    if (this.smartSetupScope() === 'packing') return `${n} Artikel übernehmen`;
    return n === 1 ? '1 Vorschlag übernehmen' : `${n} Vorschläge übernehmen`;
  });
  readonly smartSetupSaving = signal(false);
  readonly smartSetupError = signal('');

  suggestionDue(date: string | null): string {
    if (!date) return '';
    const due = dueLabel(date, localDay(new Date()));
    return due.urgent ? due.text : `Bis ${due.text}`;
  }
  openSuggestionsForSelected(scope: SuggestionScope = 'all'): void {
    const trip = this.selectedTrip();
    if (!trip) return;
    const packed = new Set(this.packing().map((i) => i.title.toLocaleLowerCase('de')));
    const tasks = new Set(this.tasks().map((t) => t.title.toLocaleLowerCase('de')));
    this.openSmartSetup(trip, (title) => packed.has(title.toLocaleLowerCase('de')), (title) => tasks.has(title.toLocaleLowerCase('de')), scope);
    this.smartSetupReview.set(true);
  }
  private openSmartSetup(
    trip: Trip,
    hasItem: (title: string) => boolean = () => false,
    hasTask: (title: string) => boolean = () => false,
    scope: SuggestionScope = 'all',
  ): void {
    const all = buildTripSuggestions(trip);
    const suggestions = {
      packing: scope === 'tasks' ? [] : all.packing.filter((i) => !hasItem(i.title)),
      tasks: scope === 'packing' ? [] : all.tasks.filter((t) => !hasTask(t.title)),
    };
    this.smartSetupScope.set(scope);
    this.smartSetupSuggestions.set(suggestions);
    this.smartSetupPackingChecked.set(suggestions.packing.map(() => true));
    this.smartSetupTasksChecked.set(suggestions.tasks.map(() => true));
    this.smartSetupReview.set(false);
    this.smartSetupError.set('');
    this.smartSetupTrip.set(trip);
  }
  toggleAllSuggestions(): void {
    const next = !this.smartSetupAllSelected();
    this.smartSetupPackingChecked.update((flags) => flags.map(() => next));
    this.smartSetupTasksChecked.update((flags) => flags.map(() => next));
  }
  skipSmartSetup(): void {
    if (!this.smartSetupSaving()) this.smartSetupTrip.set(null);
  }
  reviewSmartSetup(): void {
    this.smartSetupReview.set(true);
  }
  togglePackingSuggestion(index: number): void {
    this.smartSetupPackingChecked.update((flags) => flags.map((v, i) => (i === index ? !v : v)));
  }
  toggleTaskSuggestion(index: number): void {
    this.smartSetupTasksChecked.update((flags) => flags.map((v, i) => (i === index ? !v : v)));
  }
  acceptSelectedSmartSetup(): void {
    const trip = this.smartSetupTrip();
    if (!trip || this.smartSetupSaving()) return;
    const packing = this.smartSetupSuggestions().packing.filter((_, i) => this.smartSetupPackingChecked()[i]);
    const tasks = this.smartSetupSuggestions().tasks.filter((_, i) => this.smartSetupTasksChecked()[i]);
    if (!packing.length && !tasks.length) {
      this.smartSetupTrip.set(null);
      return;
    }
    this.smartSetupSaving.set(true);
    this.smartSetupError.set('');
    // Ganz normale Einträge über die bestehenden Endpunkte — danach wie jeder andere bearbeit- und löschbar.
    forkJoin([
      ...packing.map((item) =>
        this.api.savePackingItem({ trip: trip.id, title: item.title, quantity: item.quantity, category: item.category, is_packed: false }),
      ),
      ...tasks.map((task) => this.api.saveTask({ trip: trip.id, title: task.title, due_date: task.due_date, status: 'OPEN' })),
    ])
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.smartSetupSaving.set(false);
          this.smartSetupTrip.set(null);
          if (this.selectedTripId() === trip.id) this.loadTripDetail(trip.id, true);
          this.refreshTrips();
        },
        error: () => {
          this.smartSetupSaving.set(false);
          this.smartSetupError.set('Einige Vorschläge konnten nicht übernommen werden. Bitte versuche es erneut.');
        },
      });
  }

  // ---------- Packliste ----------
  quickAddPacking(entry: { title: string; category: PackingCategory }): void {
    const tripId = this.selectedTripId();
    if (!tripId || this.quickBusy()) return;
    this.quickBusy.set(true);
    this.actionError.set('');
    this.api
      .savePackingItem({ trip: tripId, title: entry.title, category: entry.category, quantity: 1, is_packed: false })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (saved) => {
          this.quickBusy.set(false);
          this.packing.update((items) => [...items, saved]);
          this.refreshTrips();
        },
        error: () => {
          this.quickBusy.set(false);
          this.actionError.set(`„${entry.title}“ konnte nicht hinzugefügt werden. Bitte versuche es erneut.`);
        },
      });
  }
  openPackingEditor(item?: PackingItem): void {
    this.packingForm.reset({
      title: item?.title ?? '',
      category: item?.category ?? 'SONSTIGES',
      quantity: String(item?.quantity ?? 1),
      note: item?.note ?? '',
    });
    this.editPackingId.set(item?.id);
    this.packingFormError.set('');
    this.packingEditor.set(true);
  }
  closePackingEditor(): void {
    if (!this.packingSaving()) this.packingEditor.set(false);
  }
  savePackingForm(): void {
    if (this.packingSaving()) return;
    this.packingForm.markAllAsTouched();
    const v = this.packingForm.getRawValue();
    const tripId = this.selectedTripId();
    if (!v.title.trim() || !tripId) {
      this.packingFormError.set('Bitte gib einen Namen ein (maximal 120 Zeichen).');
      return;
    }
    const quantity = Math.min(99, Math.max(1, Number(v.quantity) || 1));
    this.packingSaving.set(true);
    this.packingFormError.set('');
    const id = this.editPackingId();
    this.api
      .savePackingItem({ trip: tripId, title: v.title.trim(), category: v.category as PackingCategory, quantity, note: v.note.trim() }, id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (saved) => {
          this.packingSaving.set(false);
          this.packingEditor.set(false);
          this.packing.update((items) => (id ? items.map((i) => (i.id === id ? saved : i)) : [...items, saved]));
          this.refreshTrips();
        },
        error: () => {
          this.packingSaving.set(false);
          this.packingFormError.set('Der Artikel konnte nicht gespeichert werden. Bitte versuche es erneut.');
        },
      });
  }
  removePackingFromEditor(): void {
    const id = this.editPackingId();
    if (!id || this.packingSaving()) return;
    this.packingSaving.set(true);
    this.api
      .removePackingItem(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.packingSaving.set(false);
          this.packingEditor.set(false);
          this.packing.update((items) => items.filter((i) => i.id !== id));
          this.refreshTrips();
        },
        error: () => {
          this.packingSaving.set(false);
          this.packingFormError.set('Der Artikel konnte nicht gelöscht werden. Bitte versuche es erneut.');
        },
      });
  }
  togglePacking(item: PackingItem): void {
    const packed = !item.is_packed;
    this.packing.update((items) =>
      items.map((i) => (i.id === item.id ? { ...i, is_packed: packed, packed_at: packed ? new Date().toISOString() : null } : i)),
    );
    this.api
      .savePackingItem({ is_packed: packed }, item.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (saved) => {
          this.packing.update((items) => items.map((i) => (i.id === saved.id ? saved : i)));
          this.refreshTrips();
        },
        error: () => {
          this.packing.update((items) => items.map((i) => (i.id === item.id ? { ...i, is_packed: !packed } : i)));
          this.actionError.set(`„${item.title}“ konnte nicht gespeichert werden.`);
        },
      });
  }
  resetPacking(): void {
    const tripId = this.selectedTripId();
    if (!tripId) return;
    this.actionError.set('');
    this.api
      .resetPacking(tripId)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.packing.update((items) => items.map((i) => ({ ...i, is_packed: false, packed_at: null })));
          this.refreshTrips();
        },
        error: () => this.actionError.set('Die Packliste konnte nicht zurückgesetzt werden. Bitte versuche es erneut.'),
      });
  }

  // ---------- Aufgaben ----------
  quickAddTask(title: string): void {
    const tripId = this.selectedTripId();
    if (!tripId || this.quickBusy()) return;
    this.quickBusy.set(true);
    this.actionError.set('');
    this.api
      .saveTask({ trip: tripId, title, status: 'OPEN' })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (saved) => {
          this.quickBusy.set(false);
          this.tasks.update((items) => [...items, saved]);
          this.refreshTrips();
        },
        error: () => {
          this.quickBusy.set(false);
          this.actionError.set(`„${title}“ konnte nicht hinzugefügt werden. Bitte versuche es erneut.`);
        },
      });
  }
  openTaskEditor(item?: TripTask, title = ''): void {
    this.taskForm.reset({
      title: item?.title ?? title,
      due_date: item?.due_date ?? '',
      due_time: item?.due_time ? item.due_time.slice(0, 5) : '',
      assignee: item?.assignee ? String(item.assignee) : '',
      note: item?.note ?? '',
    });
    this.editTaskId.set(item?.id);
    this.taskFormError.set('');
    this.taskEditor.set(true);
  }
  closeTaskEditor(): void {
    if (!this.taskSaving()) this.taskEditor.set(false);
  }
  saveTaskForm(): void {
    if (this.taskSaving()) return;
    this.taskForm.markAllAsTouched();
    const v = this.taskForm.getRawValue();
    const tripId = this.selectedTripId();
    if (!v.title.trim() || !tripId) {
      this.taskFormError.set('Bitte gib einen Titel ein (maximal 120 Zeichen).');
      return;
    }
    if (v.due_time && !v.due_date) {
      this.taskFormError.set('Bitte wähle zur Uhrzeit auch ein Datum.');
      return;
    }
    const id = this.editTaskId();
    this.taskSaving.set(true);
    this.taskFormError.set('');
    this.api
      .saveTask(
        {
          trip: tripId,
          title: v.title.trim(),
          due_date: v.due_date || null,
          due_time: v.due_date && v.due_time ? v.due_time : null,
          assignee: v.assignee ? Number(v.assignee) : null,
          note: v.note.trim(),
        },
        id,
      )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (saved) => {
          this.taskSaving.set(false);
          this.taskEditor.set(false);
          this.tasks.update((items) => (id ? items.map((i) => (i.id === id ? saved : i)) : [...items, saved]));
          this.refreshTrips();
        },
        error: () => {
          this.taskSaving.set(false);
          this.taskFormError.set('Die Aufgabe konnte nicht gespeichert werden. Bitte versuche es erneut.');
        },
      });
  }
  removeTaskFromEditor(): void {
    const id = this.editTaskId();
    if (!id || this.taskSaving()) return;
    this.taskSaving.set(true);
    this.api
      .removeTask(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.taskSaving.set(false);
          this.taskEditor.set(false);
          this.tasks.update((items) => items.filter((i) => i.id !== id));
          this.refreshTrips();
        },
        error: () => {
          this.taskSaving.set(false);
          this.taskFormError.set('Die Aufgabe konnte nicht gelöscht werden. Bitte versuche es erneut.');
        },
      });
  }
  toggleTask(item: TripTask): void {
    const status = item.status === 'OPEN' ? 'DONE' : 'OPEN';
    this.tasks.update((items) => items.map((i) => (i.id === item.id ? { ...i, status } : i)));
    this.api
      .saveTask({ status }, item.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => this.refreshTrips(),
        error: () => {
          this.tasks.update((items) => items.map((i) => (i.id === item.id ? { ...i, status: item.status } : i)));
          this.actionError.set(`„${item.title}“ konnte nicht gespeichert werden.`);
        },
      });
  }

  // ---------- Ausgaben ----------
  openExpenseEditor(item?: TripExpense): void {
    this.expenseForm.reset({
      title: item?.title ?? '',
      amount: item ? item.amount.replace('.', ',') : '',
      date: item?.date ?? localDay(new Date()),
      category: item?.category ?? 'SONSTIGES',
    });
    this.editExpenseId.set(item?.id);
    this.expenseFormError.set('');
    this.expenseEditor.set(true);
  }
  closeExpenseEditor(): void {
    if (!this.expenseSaving()) this.expenseEditor.set(false);
  }
  saveExpenseForm(): void {
    if (this.expenseSaving()) return;
    this.expenseForm.markAllAsTouched();
    const v = this.expenseForm.getRawValue();
    const tripId = this.selectedTripId();
    const amount = Number(v.amount.trim().replace(',', '.'));
    if (!v.title.trim() || !tripId) {
      this.expenseFormError.set('Bitte beschreibe die Ausgabe, z. B. „Hotel“ (maximal 120 Zeichen).');
      return;
    }
    if (!v.amount.trim() || !Number.isFinite(amount) || amount <= 0) {
      this.expenseFormError.set('Bitte gib einen Betrag größer als 0 ein, z. B. 45,50.');
      return;
    }
    if (!v.date) {
      this.expenseFormError.set('Bitte wähle ein Datum.');
      return;
    }
    this.expenseSaving.set(true);
    this.expenseFormError.set('');
    const id = this.editExpenseId();
    this.api
      .saveExpense({ trip: tripId, title: v.title.trim(), amount: amount.toFixed(2), date: v.date, category: v.category as BudgetCategory }, id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (saved) => {
          this.expenseSaving.set(false);
          this.expenseEditor.set(false);
          this.expenses.update((items) => (id ? items.map((i) => (i.id === id ? saved : i)) : [...items, saved]));
          this.refreshTrips();
        },
        error: () => {
          this.expenseSaving.set(false);
          this.expenseFormError.set(id ? 'Die Ausgabe konnte nicht gespeichert werden.' : 'Die Ausgabe konnte nicht hinzugefügt werden.');
        },
      });
  }
  removeExpenseFromEditor(): void {
    const id = this.editExpenseId();
    if (!id || this.expenseSaving()) return;
    this.expenseSaving.set(true);
    this.api
      .removeExpense(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.expenseSaving.set(false);
          this.expenseEditor.set(false);
          this.expenses.update((items) => items.filter((i) => i.id !== id));
          this.refreshTrips();
        },
        error: () => {
          this.expenseSaving.set(false);
          this.expenseFormError.set('Die Ausgabe konnte nicht gelöscht werden. Bitte versuche es erneut.');
        },
      });
  }

  // ---------- Budget festlegen (Gesamtbudget, Währung, je Kategorie) ----------
  openPlanEditor(): void {
    const trip = this.selectedTrip();
    if (!trip) return;
    const draft: Record<string, string> = {};
    for (const category of BUDGET_ORDER) {
      const row = this.budgetCategories().find((r) => r.category === category);
      draft[category] = row ? row.planned_amount.replace('.', ',') : '';
    }
    this.planDraft.set(draft);
    this.planTotal.set(trip.budget_amount ? trip.budget_amount.replace('.', ',') : '');
    this.planCurrency.set(trip.currency);
    this.planError.set('');
    this.planEditor.set(true);
  }
  setPlanAmount(category: BudgetCategory, value: string): void {
    this.planDraft.update((d) => ({ ...d, [category]: value }));
  }
  closePlanEditor(): void {
    if (!this.planSaving()) this.planEditor.set(false);
  }
  /** Speichert nur Änderungen: leer oder 0 entfernt eine geplante Kategorie. */
  savePlan(): void {
    const trip = this.selectedTrip();
    if (!trip || this.planSaving()) return;
    const parse = (raw: string) => {
      const text = raw.trim().replace(',', '.');
      if (!text) return 0;
      const value = Number(text);
      return Number.isFinite(value) && value >= 0 ? value : null;
    };
    const total = parse(this.planTotal());
    if (total === null) {
      this.planError.set('Bitte gib ein gültiges Gesamtbudget ein, z. B. 700.');
      return;
    }
    const steps: Observable<unknown>[] = [];
    for (const category of BUDGET_ORDER) {
      const value = parse(this.planDraft()[category] ?? '');
      if (value === null) {
        this.planError.set(`Bitte gib für „${BUDGET_META[category].label}“ einen gültigen Betrag ein.`);
        return;
      }
      const existing = this.budgetCategories().find((r) => r.category === category);
      if (value === 0 && existing) steps.push(this.api.removeBudgetCategory(existing.id));
      else if (value > 0 && (!existing || Number(existing.planned_amount) !== value))
        steps.push(this.api.saveBudgetCategory({ trip: trip.id, category, planned_amount: value.toFixed(2) }, existing?.id));
    }
    const tripChanges: Partial<Trip> = {};
    if (total !== Number(trip.budget_amount || 0)) tripChanges.budget_amount = total > 0 ? total.toFixed(2) : null;
    if (this.planCurrency() !== trip.currency) tripChanges.currency = this.planCurrency();
    if (Object.keys(tripChanges).length) steps.push(this.api.saveTrip(tripChanges, trip.id));
    if (!steps.length) {
      this.planEditor.set(false);
      return;
    }
    this.planSaving.set(true);
    this.planError.set('');
    forkJoin(steps)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.planSaving.set(false);
          this.planEditor.set(false);
          this.loadTripDetail(trip.id, true);
          this.refreshTrips();
        },
        error: () => {
          this.planSaving.set(false);
          this.planError.set('Das Budget konnte nicht vollständig gespeichert werden. Bitte prüfe die Beträge und versuche es erneut.');
          this.loadTripDetail(trip.id, true);
          this.refreshTrips();
        },
      });
  }
}
