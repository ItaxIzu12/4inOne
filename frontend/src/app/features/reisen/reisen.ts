import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { AmountInput } from '../../shared/directives/amount-input';
import { DatePipe } from '@angular/common';
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
import { BudgetCategory, ContactOption, PackingCategory, PackingItem, ReisenApi, Trip, TripBudgetCategory, TripExpense, TripParticipant, TripTask } from './reisen-api.service';
import { buildTripSuggestions, SuggestedPackingItem, SuggestedTask } from './trip-suggestions';
import { buildTripReadiness, TripReadiness } from './trip-readiness';
import { TripList, TripTarget } from './trip-list';
import { TripPacking } from './trip-packing';
import { TripBudget } from './trip-budget';
import { TripReminders } from './trip-reminders';
import { TripOverview } from './trip-overview';
import { BUDGET_META, BUDGET_ORDER, PACKING_META, PACKING_ORDER, STATUS_LABELS, STATUS_ORDER, formatMoney, localDay, totalBudget, tripIcon } from './reisen-logic';

export { formatMoney, localDay } from './reisen-logic';

export type ReisenTab = 'uebersicht' | 'reisen' | 'packlisten' | 'budget' | 'erinnerungen';
const TABS: { key: ReisenTab; label: string; icon: IconName }[] = [
  { key: 'uebersicht', label: 'Übersicht', icon: 'home' },
  { key: 'reisen', label: 'Reisen', icon: 'travel' },
  { key: 'packlisten', label: 'Packlisten', icon: 'luggage' },
  { key: 'budget', label: 'Budget', icon: 'coins' },
  { key: 'erinnerungen', label: 'Erinnerungen', icon: 'bell' },
];
// Hauptknopf im Seitenkopf, passend zum Reiter.
const HEAD_ACTIONS: Record<ReisenTab, string> = {
  uebersicht: '',
  reisen: 'Neue Reise',
  packlisten: 'Element hinzufügen',
  budget: 'Ausgabe erfassen',
  erinnerungen: 'Erinnerung hinzufügen',
};

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
    DatePipe,
    TripList,
    TripPacking,
    TripBudget,
    TripReminders,
    TripOverview,
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

  readonly tabs = TABS;
  readonly tab = signal<ReisenTab>(tabFromQuery(this.route.snapshot.queryParamMap.get('tab')));
  /** Ohne gewählte Reise oder ohne Schreibrecht führt der Hauptknopf zu „Neue Reise“ — Text und Aktion passen zusammen. */
  readonly headAction = computed(() => {
    const tab = this.tab();
    const tripTab = tab === 'packlisten' || tab === 'budget' || tab === 'erinnerungen';
    return tripTab && (!this.selectedTrip() || !this.canEdit()) ? HEAD_ACTIONS.reisen : HEAD_ACTIONS[tab];
  });
  readonly trips = signal<Trip[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selectedTripId = signal<number | null>(null);
  readonly selectedTrip = computed(() => this.trips().find((t) => t.id === this.selectedTripId()) ?? null);
  readonly tripOptions = computed<SelectOption[]>(() =>
    this.trips().map((t) => ({ value: String(t.id), label: t.title })),
  );
  readonly selectedTripValue = computed(() => (this.selectedTripId() !== null ? String(this.selectedTripId()) : ''));
  /** Nächste bevorstehende Reise (heute oder später) für die Hervorhebung in der Übersicht — sonst, falls keine
   * bevorstehende existiert, die zuletzt angelegte, damit die Karte nie grundlos leer bleibt, obwohl Reisen
   * existieren. */
  readonly nextTrip = computed(() => {
    const today = localDay(new Date());
    const upcoming = this.trips()
      .filter((t) => t.status !== 'CANCELLED' && t.start_date >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    return upcoming[0] ?? this.trips()[0] ?? null;
  });

  readonly statusOptions: SelectOption[] = STATUS_ORDER.map((value) => ({ value, label: STATUS_LABELS[value] }));
  readonly statusLabels = STATUS_LABELS;
  // Alle drei mit führender "Keine Angabe"-Option: ausschließlich als Grundlage für die Smart-Setup-Vorschläge
  // gedacht, deshalb nie erzwungen (siehe trip-suggestions.ts).
  readonly travelTypeOptions: SelectOption[] = [
    { value: '', label: 'Keine Angabe' },
    { value: 'CITY_TRIP', label: 'Städtereise' },
    { value: 'BEACH', label: 'Strandurlaub' },
    { value: 'BUSINESS', label: 'Geschäftsreise' },
    { value: 'ROAD_TRIP', label: 'Roadtrip' },
    { value: 'ACTIVE', label: 'Aktivurlaub' },
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
  readonly baggageTypeOptions: SelectOption[] = [
    { value: '', label: 'Keine Angabe' },
    { value: 'HAND_LUGGAGE', label: 'Nur Handgepäck' },
    { value: 'CHECKED_BAGGAGE', label: 'Aufgabegepäck' },
    { value: 'CAR_LUGGAGE', label: 'Gepäck im Auto' },
    { value: 'UNKNOWN', label: 'Noch unklar' },
  ];
  // Reihenfolge, in der die Packliste gruppiert angezeigt wird (siehe packingGroups()).
  readonly packingCategoryOrder: PackingCategory[] = PACKING_ORDER;
  readonly packingCategoryLabels = Object.fromEntries(PACKING_ORDER.map((c) => [c, PACKING_META[c].label])) as Record<PackingCategory, string>;
  readonly packingCategoryOptions: SelectOption[] = this.packingCategoryOrder.map((value) => ({
    value,
    label: this.packingCategoryLabels[value],
  }));
  readonly currencyOptions: SelectOption[] = [
    { value: 'EUR', label: 'Euro (€)' },
    { value: 'USD', label: 'US-Dollar ($)' },
    { value: 'GBP', label: 'Britisches Pfund (£)' },
    { value: 'CHF', label: 'Schweizer Franken (CHF)' },
  ];
  // Reihenfolge, in der das geplante Budget je Kategorie angezeigt wird (siehe budgetCategoryRows()).
  readonly budgetCategoryOrder: BudgetCategory[] = BUDGET_ORDER;
  readonly budgetMeta = BUDGET_META;
  readonly budgetCategoryLabels = Object.fromEntries(BUDGET_ORDER.map((c) => [c, BUDGET_META[c].label])) as Record<BudgetCategory, string>;
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
  /** Reisen desselben Nutzers, die sich mit dem gerade eingegebenen Zeitraum überschneiden — siehe
   * checkTripOverlaps() in reisen-api.service.ts. Nicht leer: die Warnung ersetzt die Formularfelder,
   * bis der Nutzer "Daten ändern" oder "Trotzdem erstellen" wählt (dismissOverlapWarning()/erneuter
   * saveTrip()-Aufruf). Rein informativ, blockiert das Speichern nie automatisch. */
  readonly tripOverlaps = signal<Trip[]>([]);
  readonly tripForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    destination: ['', Validators.maxLength(160)],
    start_date: ['', Validators.required],
    end_date: ['', Validators.required],
    status: ['PLANNED'],
    travel_type: [''],
    transport_type: [''],
    baggage_type: [''],
    budget_amount: [''],
    currency: ['EUR'],
    accommodation: ['', Validators.maxLength(160)],
    accommodation_area: ['', Validators.maxLength(120)],
    transport_note: ['', Validators.maxLength(160)],
    notes: ['', Validators.maxLength(5000)],
  });

  // ---------- Reisedetails der ausgewählten Reise ----------
  readonly packing = signal<PackingItem[]>([]);
  readonly tasks = signal<TripTask[]>([]);
  readonly expenses = signal<TripExpense[]>([]);
  readonly budgetCategories = signal<TripBudgetCategory[]>([]);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');

  readonly packingPackedCount = computed(() => this.packing().filter((i) => i.is_packed).length);
  /** Kein irreführendes 100 %, wenn noch gar keine Packitems existieren (siehe Anforderung) — dann einfach 0. */
  readonly packingProgress = computed(() => {
    const items = this.packing();
    return items.length ? Math.round((this.packingPackedCount() / items.length) * 100) : 0;
  });
  /** Gruppiert nach Kategorie, in fester Reihenfolge, leere Kategorien werden ausgeblendet — siehe
   * packingCategoryOrder. Abgehakte Artikel landen innerhalb ihrer Gruppe ans Ende (is_packed zuletzt in der
   * Server-Sortierung), das bleibt hier erhalten, weil die Reihenfolge von packing() übernommen wird. */
  readonly packingGroups = computed(() => {
    const items = this.packing();
    return this.packingCategoryOrder
      .map((category) => ({
        category,
        label: this.packingCategoryLabels[category],
        items: items.filter((i) => i.category === category),
      }))
      .filter((group) => group.items.length > 0);
  });
  readonly openTasks = computed(() => this.tasks().filter((t) => t.status === 'OPEN'));
  /** Reisebereitschaft der GEÖFFNETEN (ausgewählten) Reise — siehe trip-readiness.ts für die Berechnungsregel.
   * Packliste/Aufgaben kommen bewusst aus packing()/tasks() (den geladenen Detail-Listen), nicht aus den in
   * Trip eingebetteten Summenfeldern: togglePacking()/toggleTask() aktualisieren nur diese Listen optimistisch,
   * ohne die Trip-Liste neu zu laden — sonst würde die Prozentzahl nach dem Abhaken nicht sofort mitziehen. */
  readonly readiness = computed<TripReadiness | null>(() => {
    const trip = this.selectedTrip();
    if (!trip) return null;
    return buildTripReadiness({
      start_date: trip.start_date,
      end_date: trip.end_date,
      packing_total: this.packing().length,
      packing_packed: this.packingPackedCount(),
      tasks_total: this.tasks().length,
      tasks_open: this.openTasks().length,
      budget_amount: trip.budget_amount,
    });
  });
  readonly budgetTotal = computed(() => totalBudget(this.selectedTrip(), this.budgetCategories()));
  /** Schreiben darf, wer die Reise angelegt hat oder als Besitzer/Bearbeiter mitreist. */
  readonly canEdit = computed(() => {
    const role = this.selectedTrip()?.my_role;
    return role === 'OWNER' || role === 'EDITOR';
  });
  /** Hochzählen lädt die Erinnerungen neu (nach Anlegen/Ändern einer Erinnerung). */
  readonly reminderVersion = signal(0);
  readonly budgetSpent = computed(() => this.expenses().reduce((sum, e) => sum + Number(e.amount), 0));
  readonly budgetProgress = computed(() => {
    const total = this.budgetTotal();
    return total > 0 ? Math.min(100, (this.budgetSpent() / total) * 100) : this.budgetSpent() > 0 ? 100 : 0;
  });
  /** Feste Reihenfolge, jede Kategorie erscheint immer (auch ohne gespeicherte Zeile, dann 0) — siehe
   * ANZEIGE-Beispiel: "Geplant: Transport 500 €, Unterkunft 400 €, ...". Bewusst kein Ist-je-Kategorie, nur
   * geplant (siehe TripBudgetCategory-Docstring im Backend). */
  readonly budgetCategoryRows = computed(() => {
    const rows = this.budgetCategories();
    return this.budgetCategoryOrder.map((category) => ({
      category,
      label: this.budgetCategoryLabels[category],
      row: rows.find((r) => r.category === category) ?? null,
    }));
  });
  readonly budgetCategoryTotal = computed(() => this.budgetCategories().reduce((sum, r) => sum + Number(r.planned_amount), 0));

  // ---------- Packliste anlegen/bearbeiten ----------
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

  // ---------- Aufgaben anlegen/bearbeiten ----------
  readonly taskEditor = signal(false);
  readonly editTaskId = signal<number | undefined>(undefined);
  readonly taskSaving = signal(false);
  readonly taskFormError = signal('');
  readonly taskForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    due_date: [''],
    due_time: [''],
    note: ['', Validators.maxLength(240)],
  });

  // ---------- Ausgaben anlegen/bearbeiten ----------
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

  // ---------- Budget planen ----------
  readonly planEditor = signal(false);
  readonly planSaving = signal(false);
  readonly planError = signal('');
  readonly planTotal = signal('');
  readonly planDraft = signal<Record<string, string>>({});
  readonly planSum = computed(() =>
    Object.values(this.planDraft()).reduce((sum, raw) => sum + (Number(raw.replace(',', '.')) || 0), 0),
  );
  readonly actionError = signal('');

  constructor() {
    this.load();
    // Ein Wechsel der ausgewählten Reise lädt Packliste/Aufgaben/Ausgaben neu — dieselbe Reise bleibt über
    // Übersicht, Packliste, Aufgaben und Budget hinweg ausgewählt (siehe selectTrip()).
    effect(() => {
      const id = this.selectedTripId();
      untracked(() => {
        if (id !== null) this.loadTripDetail(id);
        else {
          this.packing.set([]);
          this.tasks.set([]);
          this.expenses.set([]);
          this.budgetCategories.set([]);
        }
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
          // Deep-Link aus einer Verknüpfung (?trip=), z. B. vom Sparziel in Finanzen.
          const linked = Number(this.route.snapshot.queryParamMap.get('trip'));
          if (linked && trips.some((t) => t.id === linked)) {
            // Der Reiter kommt aus ?tab= (Standard: Übersicht).
            this.selectedTripId.set(linked);
            return;
          }
          const current = this.selectedTripId();
          if (current === null || !trips.some((t) => t.id === current)) {
            this.selectedTripId.set(this.nextTrip()?.id ?? trips[0]?.id ?? null);
          }
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Deine Reisen konnten nicht geladen werden. Bitte versuche es erneut.');
        },
      });
  }

  /** Zähler der Reisen (gepackt, offene Aufgaben, ausgegeben) leise neu laden — ohne Ladezustand, damit die
   * Reiter ihren Zustand (Filter, aufgeklappte Gruppen) behalten. */
  refreshTrips(): void {
    this.api
      .trips()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (trips) => this.trips.set(trips), error: () => undefined });
  }

  /** Erneuter Ladeversuch nach einem detailError() — ein zweites selectTrip(id) mit DERSELBEN ID würde den
   * Signal-Effect nicht erneut auslösen (kein Werte­wechsel), deshalb ein eigener Einstiegspunkt fürs Template. */
  retryTripDetail(): void {
    const id = this.selectedTripId();
    if (id !== null) this.loadTripDetail(id);
  }
  private loadTripDetail(tripId: number): void {
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
          this.packing.set(r.packing);
          this.tasks.set(r.tasks);
          this.expenses.set(r.expenses);
          this.budgetCategories.set(r.budgetCategories);
          this.detailLoading.set(false);
        },
        error: () => {
          this.detailLoading.set(false);
          this.detailError.set('Die Details dieser Reise konnten nicht geladen werden.');
        },
      });
  }

  selectTrip(id: number): void {
    this.selectedTripId.set(id);
  }

  selectTab(tab: ReisenTab): void {
    this.tab.set(tab);
    this.actionError.set('');
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
    queueMicrotask(() => document.getElementById(`reisen-tab-${next}`)?.focus());
  }
  /** Hauptknopf im Kopf — öffnet das passende Formular des Reiters (ohne gewählte Reise: eine neue Reise). */
  headActionClick(): void {
    const tab = this.tab();
    if (tab === 'uebersicht' || tab === 'reisen' || !this.selectedTrip() || !this.canEdit()) return this.openTripEditor();
    if (tab === 'packlisten') return this.openPackingEditor();
    if (tab === 'budget') return this.openExpenseEditor();
    return this.openTaskEditor();
  }
  /** Aus einem Reiter heraus („Zur Packliste“, „Budget“ in den Reisedetails …). */
  openTarget(target: TripTarget): void {
    this.selectTab(target);
  }

  // ---------- Reise anlegen/bearbeiten ----------
  /** Frühester wählbarer Beginn: heute bei einer neuen Reise oder einer, die noch nicht begonnen hat — sonst
   * (die Reise läuft schon oder ist vorbei) keine Einschränkung, sonst ließe sich ihr Datum gar nicht mehr
   * anfassen oder korrigieren. */
  readonly minStartDate = signal(localDay(new Date()));
  openTripEditor(trip?: Trip): void {
    this.tripForm.reset({
      title: trip?.title ?? '',
      destination: trip?.destination ?? '',
      start_date: trip?.start_date ?? '',
      end_date: trip?.end_date ?? '',
      status: trip?.status ?? 'PLANNED',
      travel_type: trip?.travel_type ?? '',
      transport_type: trip?.transport_type ?? '',
      baggage_type: trip?.baggage_type ?? '',
      budget_amount: trip?.budget_amount ?? '',
      currency: trip?.currency ?? 'EUR',
      accommodation: trip?.accommodation ?? '',
      accommodation_area: trip?.accommodation_area ?? '',
      transport_note: trip?.transport_note ?? '',
      notes: trip?.notes ?? '',
    });
    this.minStartDate.set(trip && trip.start_date < localDay(new Date()) ? '' : localDay(new Date()));
    this.editTripId.set(trip?.id);
    this.tripFormError.set('');
    this.tripOverlaps.set([]);
    this.tripEditor.set(true);
  }
  closeTripEditor(): void {
    if (this.tripSaving()) return;
    // "Daten ändern" (Abbrechen-Button während der Überschneidungs-Warnung): nur die Warnung verwerfen und im
    // Formular bleiben, nicht den ganzen Dialog schließen.
    if (this.tripOverlaps().length) {
      this.tripOverlaps.set([]);
      return;
    }
    this.tripEditor.set(false);
  }
  saveTrip(): void {
    if (this.tripSaving()) return;
    this.tripForm.markAllAsTouched();
    const v = this.tripForm.getRawValue();
    if (!v.title.trim() || v.title.length > 120) {
      this.tripFormError.set('Bitte gib einen Titel ein (maximal 120 Zeichen).');
      return;
    }
    // Pflichtfelder: eine Reise ohne konkreten Zeitraum wird in V1 nicht gespeichert (siehe
    // reisen-api.service.ts Trip.start_date-Docstring) — "Reiseideen" sind ein eigenes, hier noch
    // nicht gebautes Konzept.
    if (!v.start_date || !v.end_date) {
      this.tripFormError.set('Bitte gib Beginn und Ende der Reise an.');
      return;
    }
    if (v.end_date < v.start_date) {
      this.tripFormError.set('Das Ende darf nicht vor dem Beginn liegen.');
      return;
    }
    if (v.budget_amount && Number(v.budget_amount) < 0) {
      this.tripFormError.set('Das Budget darf nicht negativ sein.');
      return;
    }
    this.tripFormError.set('');

    // "Trotzdem erstellen": die Warnung steht schon, der Nutzer hat sich trotz Überschneidung entschieden.
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
          if (overlaps.length) this.tripOverlaps.set(overlaps);
          else this.commitTrip(v);
        },
        // Ein fehlgeschlagener Prüf-Aufruf darf das Speichern nicht verhindern — die serverseitige Prüfung beim
        // nächsten Bearbeiten bleibt die eigentliche Absicherung, das Frontend zeigt die Warnung nur zusätzlich.
        error: () => {
          this.tripSaving.set(false);
          this.commitTrip(v);
        },
      });
  }
  private commitTrip(v: ReturnType<typeof this.tripForm.getRawValue>): void {
    // Vor dem eigentlichen Speichern festhalten: ein Edit darf das Smart Setup nicht erneut auslösen, nur eine
    // wirklich neue Reise soll das (editTripId() wird erst wieder in openTripEditor() verändert).
    const wasCreate = !this.editTripId();
    this.tripSaving.set(true);
    this.api
      .saveTrip(
        {
          title: v.title.trim(),
          destination: v.destination.trim(),
          start_date: v.start_date,
          end_date: v.end_date,
          status: v.status as Trip['status'],
          travel_type: v.travel_type as Trip['travel_type'],
          transport_type: v.transport_type as Trip['transport_type'],
          baggage_type: v.baggage_type as Trip['baggage_type'],
          budget_amount: v.budget_amount ? v.budget_amount : null,
          currency: v.currency as Trip['currency'],
          accommodation: v.accommodation.trim(),
          accommodation_area: v.accommodation_area.trim(),
          transport_note: v.transport_note.trim(),
          notes: v.notes,
        },
        this.editTripId(),
      )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (savedTrip) => {
          this.tripSaving.set(false);
          this.tripEditor.set(false);
          this.tripOverlaps.set([]);
          this.load();
          if (wasCreate) this.openSmartSetup(savedTrip);
        },
        error: () => {
          this.tripSaving.set(false);
          this.tripOverlaps.set([]);
          this.tripFormError.set('Speichern fehlgeschlagen. Bitte prüfe deine Angaben und versuche es erneut.');
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
          if (this.selectedTripId() === id) this.selectedTripId.set(null);
          this.load();
        },
        error: () => {
          this.tripSaving.set(false);
          this.tripFormError.set('Löschen fehlgeschlagen. Bitte versuche es erneut.');
        },
      });
  }

  // ---------- Teilnehmer ----------
  /** Nicht null: der Teilnehmer-Dialog für genau diese Reise ist offen. Als ID statt als Snapshot-Objekt
   * gespeichert, damit participantsEditorTrip() automatisch aktuell bleibt, sobald load() die Teilnehmerliste
   * dieser Reise (eingebettet in Trip, siehe reisen-api.service.ts) neu lädt. */
  readonly participantsEditorTripId = signal<number | null>(null);
  readonly participantsEditorTrip = computed(() => this.trips().find((t) => t.id === this.participantsEditorTripId()) ?? null);
  /** Teilnehmer verwalten (hinzufügen/Rolle ändern/jemand anderen entfernen) darf nur, wer OWNER ist — Ersteller
   * oder Teilnehmer mit Rolle OWNER (siehe reisen/permissions.py TripParticipantManagePermission). */
  readonly canManageParticipants = computed(() => this.participantsEditorTrip()?.my_role === 'OWNER');
  readonly participantsSaving = signal(false);
  readonly participantsError = signal('');
  readonly contacts = signal<ContactOption[]>([]);
  readonly contactOptions = computed<SelectOption[]>(() => this.contacts().map((c) => ({ value: String(c.id), label: c.name })));
  readonly newParticipantContactId = signal<number | null>(null);
  readonly newParticipantContactValue = computed(() => (this.newParticipantContactId() !== null ? String(this.newParticipantContactId()) : ''));
  readonly newParticipantRole = signal<TripParticipant['role']>('VIEWER');

  openParticipantsEditor(trip: Trip): void {
    this.participantsEditorTripId.set(trip.id);
    this.participantsError.set('');
    this.newParticipantContactId.set(null);
    this.newParticipantRole.set('VIEWER');
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
          this.participantsError.set('Hinzufügen fehlgeschlagen. Ist diese Person schon Teilnehmer dieser Reise?');
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
        error: () => this.participantsError.set(`Rolle von „${participant.display_name}“ konnte nicht geändert werden.`),
      });
  }
  removeParticipant(participant: TripParticipant): void {
    this.participantsError.set('');
    this.api
      .removeParticipant(participant.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          // Verlässt man die Reise selbst, bleibt kein Zugriff mehr auf sie — der Dialog muss sich dann
          // schließen, sonst zeigt participantsEditorTrip() nach load() plötzlich eine Reise, die gar nicht
          // mehr in trips() auftaucht.
          if (participant.is_self) this.participantsEditorTripId.set(null);
          this.refreshTrips();
        },
        error: () => this.participantsError.set(`„${participant.display_name}“ konnte nicht entfernt werden.`),
      });
  }

  // ---------- Smart Setup ----------
  /** Nicht null: die Teaser- oder Review-Stufe des Smart Setups ist offen (siehe smartSetupReview). Erscheint nur
   * direkt nach dem ERSTELLEN einer Reise (siehe commitTrip()), nie beim Bearbeiten — sonst stünde man nach jeder
   * Änderung wieder vor denselben Vorschlägen. */
  readonly smartSetupTrip = signal<Trip | null>(null);
  readonly smartSetupReview = signal(false);
  readonly smartSetupSuggestions = signal<{ packing: SuggestedPackingItem[]; tasks: SuggestedTask[] }>({ packing: [], tasks: [] });
  readonly smartSetupPackingChecked = signal<boolean[]>([]);
  readonly smartSetupTasksChecked = signal<boolean[]>([]);
  /** Für die Anzeige gruppiert wie die eigentliche Packliste — der Index zeigt weiter auf die ungruppierte Liste,
   * damit togglePackingSuggestion()/smartSetupPackingChecked() unverändert funktionieren. */
  readonly smartSetupPackingGroups = computed(() => {
    const items = this.smartSetupSuggestions().packing;
    return this.packingCategoryOrder
      .map((category) => ({
        category,
        label: this.packingCategoryLabels[category],
        entries: items.map((item, index) => ({ item, index })).filter((entry) => entry.item.category === category),
      }))
      .filter((group) => group.entries.length > 0);
  });
  readonly smartSetupSaving = signal(false);
  readonly smartSetupError = signal('');

  /** Vorschläge auch für eine bestehende Reise (Packlisten › „Vorschläge hinzufügen“) — ohne das, was schon da ist. */
  openSuggestionsForSelected(): void {
    const trip = this.selectedTrip();
    if (!trip) return;
    const packed = new Set(this.packing().map((i) => i.title.toLocaleLowerCase('de')));
    const tasks = new Set(this.tasks().map((t) => t.title.toLocaleLowerCase('de')));
    this.openSmartSetup(trip, (title) => packed.has(title.toLocaleLowerCase('de')), (title) => tasks.has(title.toLocaleLowerCase('de')));
    this.smartSetupReview.set(true);
  }
  private openSmartSetup(trip: Trip, hasItem: (title: string) => boolean = () => false, hasTask: (title: string) => boolean = () => false): void {
    const all = buildTripSuggestions(trip);
    const suggestions = { packing: all.packing.filter((i) => !hasItem(i.title)), tasks: all.tasks.filter((t) => !hasTask(t.title)) };
    this.smartSetupSuggestions.set(suggestions);
    this.smartSetupPackingChecked.set(suggestions.packing.map(() => true));
    this.smartSetupTasksChecked.set(suggestions.tasks.map(() => true));
    this.smartSetupReview.set(false);
    this.smartSetupError.set('');
    this.smartSetupTrip.set(trip);
  }
  skipSmartSetup(): void {
    if (this.smartSetupSaving()) return;
    // Egal ob übernommen oder übersprungen: die gerade erstellte Reise soll danach ausgewählt bleiben, statt dass
    // load()s Datums-Sortierung (nextTrip()) unbemerkt eine andere, zeitlich frühere Reise auswählt.
    const trip = this.smartSetupTrip();
    this.smartSetupTrip.set(null);
    if (trip) this.selectTrip(trip.id);
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
  acceptAllSmartSetup(): void {
    const { packing, tasks } = this.smartSetupSuggestions();
    this.commitSmartSetup(packing.map(() => true), tasks.map(() => true));
  }
  acceptSelectedSmartSetup(): void {
    this.commitSmartSetup(this.smartSetupPackingChecked(), this.smartSetupTasksChecked());
  }
  private commitSmartSetup(packingFlags: boolean[], taskFlags: boolean[]): void {
    const trip = this.smartSetupTrip();
    if (!trip || this.smartSetupSaving()) return;
    const packing = this.smartSetupSuggestions().packing.filter((_, i) => packingFlags[i]);
    const tasks = this.smartSetupSuggestions().tasks.filter((_, i) => taskFlags[i]);
    if (!packing.length && !tasks.length) {
      this.smartSetupTrip.set(null);
      return;
    }
    this.smartSetupSaving.set(true);
    this.smartSetupError.set('');
    // Alles wird ganz normal über die bestehenden Endpunkte angelegt (is_packed: false, status: 'OPEN') — es gibt
    // keine eigene "Vorschlag"-Markierung, weil damit nichts fälschlich als erledigt gelten kann und die Einträge
    // sich später wie jeder andere Eintrag bearbeiten/löschen lassen.
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
          this.selectTrip(trip.id);
          // dieselbe Reise: Details und Zähler neu laden, damit die neuen Einträge sofort erscheinen
          this.loadTripDetail(trip.id);
          this.refreshTrips();
          this.reminderVersion.update((v) => v + 1);
        },
        error: () => {
          this.smartSetupSaving.set(false);
          this.smartSetupError.set('Einige Vorschläge konnten nicht übernommen werden. Bitte versuche es erneut.');
        },
      });
  }

  // ---------- Packliste ----------
  openPackingEditor(item?: PackingItem, category?: PackingCategory | null): void {
    this.packingForm.reset({
      title: item?.title ?? '',
      category: item?.category ?? category ?? 'SONSTIGES',
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
    const quantity = Math.max(1, Number(v.quantity) || 1);
    this.packingSaving.set(true);
    this.packingFormError.set('');
    const id = this.editPackingId();
    this.api
      .savePackingItem(
        { trip: tripId, title: v.title.trim(), category: v.category as PackingCategory, quantity, note: v.note.trim() },
        id,
      )
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
          this.packingFormError.set('Speichern fehlgeschlagen. Bitte versuche es erneut.');
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
          this.packingFormError.set('Löschen fehlgeschlagen. Bitte versuche es erneut.');
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
        next: (saved) => this.packing.update((items) => items.map((i) => (i.id === saved.id ? saved : i))),
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

  // ---------- Erinnerungen (Reise-Aufgaben) ----------
  openTaskEditor(item?: TripTask): void {
    this.taskForm.reset({
      title: item?.title ?? '',
      due_date: item?.due_date ?? '',
      due_time: item?.due_time ? item.due_time.slice(0, 5) : '',
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
    const id = this.editTaskId();
    if (v.due_time && !v.due_date) {
      this.taskFormError.set('Bitte wähle zur Uhrzeit auch ein Datum.');
      return;
    }
    this.taskSaving.set(true);
    this.taskFormError.set('');
    this.api
      .saveTask({ trip: tripId, title: v.title.trim(), due_date: v.due_date || null, due_time: v.due_date && v.due_time ? v.due_time : null, note: v.note.trim() }, id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (saved) => {
          this.taskSaving.set(false);
          this.taskEditor.set(false);
          this.tasks.update((items) => (id ? items.map((i) => (i.id === id ? saved : i)) : [...items, saved]));
          this.reminderVersion.update((v) => v + 1);
          this.refreshTrips();
        },
        error: () => {
          this.taskSaving.set(false);
          this.taskFormError.set('Speichern fehlgeschlagen. Bitte versuche es erneut.');
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
          this.reminderVersion.update((v) => v + 1);
          this.refreshTrips();
        },
        error: () => {
          this.taskSaving.set(false);
          this.taskFormError.set('Löschen fehlgeschlagen. Bitte versuche es erneut.');
        },
      });
  }
  /** Aus den Erinnerungen: eine Reise-Aufgabe abhaken oder wieder öffnen. */
  toggleReminder(change: { id: number; done: boolean }): void {
    const item = this.tasks().find((t) => t.id === change.id);
    const status = change.done ? 'DONE' : 'OPEN';
    if (item) this.tasks.update((items) => items.map((i) => (i.id === change.id ? { ...i, status } : i)));
    this.api
      .saveTask({ status }, change.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => this.refreshTrips(),
        error: () => {
          if (item) this.tasks.update((items) => items.map((i) => (i.id === change.id ? { ...i, status: item.status } : i)));
          this.reminderVersion.update((v) => v + 1);
          this.actionError.set('Die Erinnerung konnte nicht gespeichert werden. Bitte versuche es erneut.');
        },
      });
  }
  openTaskById(id: number): void {
    const task = this.tasks().find((t) => t.id === id);
    if (task) this.openTaskEditor(task);
  }
  toggleTask(item: TripTask): void {
    const status = item.status === 'OPEN' ? 'DONE' : 'OPEN';
    this.tasks.update((items) => items.map((i) => (i.id === item.id ? { ...i, status } : i)));
    this.api
      .saveTask({ status }, item.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
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
    if (!v.amount.trim() || !Number.isFinite(amount) || amount < 0) {
      this.expenseFormError.set('Bitte gib einen gültigen Betrag ein, z. B. 45,50.');
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
          this.expenseFormError.set('Speichern fehlgeschlagen. Bitte versuche es erneut.');
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
          this.expenseFormError.set('Löschen fehlgeschlagen. Bitte versuche es erneut.');
        },
      });
  }

  // ---------- Budget planen (Gesamtbudget + je Kategorie) ----------
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
    this.planError.set('');
    this.planEditor.set(true);
  }
  setPlanAmount(category: BudgetCategory, value: string): void {
    this.planDraft.update((d) => ({ ...d, [category]: value }));
  }
  closePlanEditor(): void {
    if (!this.planSaving()) this.planEditor.set(false);
  }
  /** Speichert nur, was sich geändert hat: leer oder 0 entfernt eine geplante Kategorie (wie zuvor im Reiter). */
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
    const before = Number(trip.budget_amount || 0);
    if (total !== before) steps.push(this.api.saveTrip({ budget_amount: total > 0 ? total.toFixed(2) : null }, trip.id));
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
          this.loadTripDetail(trip.id);
          this.refreshTrips();
        },
        error: () => {
          this.planSaving.set(false);
          this.planError.set('Nicht alles konnte gespeichert werden. Bitte prüfe die Beträge und versuche es erneut.');
          this.loadTripDetail(trip.id);
          this.refreshTrips();
        },
      });
  }
}

function tabFromQuery(value: string | null): ReisenTab {
  return TABS.some((t) => t.key === value) ? (value as ReisenTab) : 'uebersicht';
}
