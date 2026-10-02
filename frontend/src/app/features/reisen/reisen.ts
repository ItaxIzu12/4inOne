import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { AmountInput } from '../../shared/directives/amount-input';
import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppShell } from '../../layout/app-shell';
import { AppIcon } from '../../shared/icons/app-icon';
import { AppDatePicker } from '../../shared/form/date-picker';
import { Field } from '../../shared/form/field';
import { AppSelect, SelectOption } from '../../shared/form/select';
import { ModalForm } from '../../shared/form/modal-form';
import { Modal } from '../../shared/modal/modal';
import { BudgetCategory, ContactOption, PackingCategory, PackingItem, ReisenApi, Trip, TripBudgetCategory, TripExpense, TripParticipant, TripTask } from './reisen-api.service';
import { buildTripSuggestions, SuggestedPackingItem, SuggestedTask } from './trip-suggestions';
import { buildTripReadiness, TripReadiness } from './trip-readiness';
import { TripPlan } from './trip-plan';

export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const CURRENCY_SYMBOLS: Record<Trip['currency'], { symbol: string; prefix: boolean }> = {
  EUR: { symbol: '€', prefix: false },
  USD: { symbol: '$', prefix: true },
  GBP: { symbol: '£', prefix: true },
  CHF: { symbol: 'CHF', prefix: true },
};
/** Immer deutsche Zahlengruppierung (1.500,00), nur Symbol/Position wechseln je Währung — Reisen ist ein
 * deutschsprachiges Produkt, ein 1:1-Formatwechsel pro Währung wäre inkonsistent mit dem Rest der App. */
export function formatMoney(value: string | number, currency: Trip['currency']): string {
  const amount = (typeof value === 'number' ? value : Number(value)).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const { symbol, prefix } = CURRENCY_SYMBOLS[currency] ?? CURRENCY_SYMBOLS.EUR;
  return prefix ? `${symbol} ${amount}` : `${amount} ${symbol}`;
}

@Component({
  selector: 'app-reisen',
  standalone: true,
  imports: [ErrorNoticeDirective, AmountInput, AppShell, AppIcon, Field, ModalForm, Modal, ReactiveFormsModule, AppSelect, AppDatePicker, DatePipe, TripPlan],
  templateUrl: './reisen.html',
  styleUrl: './reisen.scss',
})
export class Reisen {
  private api = inject(ReisenApi);
  private destroy = inject(DestroyRef);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  protected readonly formatMoney = formatMoney;

  readonly tab = signal<'uebersicht' | 'reisen' | 'packliste' | 'aufgaben' | 'budget'>('uebersicht');
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

  readonly statusOptions: SelectOption[] = [
    { value: 'PLANNED', label: 'Geplant' },
    { value: 'ACTIVE', label: 'Unterwegs' },
    { value: 'DONE', label: 'Abgeschlossen' },
    { value: 'CANCELLED', label: 'Storniert' },
  ];
  readonly statusLabels: Record<Trip['status'], string> = {
    PLANNED: 'Geplant',
    ACTIVE: 'Unterwegs',
    DONE: 'Abgeschlossen',
    CANCELLED: 'Storniert',
  };
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
  readonly packingCategoryOrder: PackingCategory[] = ['DOKUMENTE', 'KLEIDUNG', 'TECHNIK', 'GESUNDHEIT', 'HYGIENE', 'SONSTIGES'];
  readonly packingCategoryLabels: Record<PackingCategory, string> = {
    DOKUMENTE: 'Dokumente',
    KLEIDUNG: 'Kleidung',
    TECHNIK: 'Technik',
    GESUNDHEIT: 'Gesundheit',
    HYGIENE: 'Hygiene',
    SONSTIGES: 'Sonstiges',
  };
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
  readonly budgetCategoryOrder: BudgetCategory[] = ['TRANSPORT', 'UNTERKUNFT', 'ESSEN', 'AKTIVITAETEN', 'SHOPPING', 'SONSTIGES', 'RESERVE'];
  readonly budgetCategoryLabels: Record<BudgetCategory, string> = {
    TRANSPORT: 'Transport',
    UNTERKUNFT: 'Unterkunft',
    ESSEN: 'Essen',
    AKTIVITAETEN: 'Aktivitäten',
    SHOPPING: 'Shopping',
    SONSTIGES: 'Sonstiges',
    RESERVE: 'Reserve',
  };
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
  /** „Wichtigste offene Aufgaben" für die Detailübersicht: die 3 nächsten Fälligkeiten zuerst, Aufgaben ohne
   * Fälligkeitsdatum zuletzt — mehr würde die kompakte Karte überladen (siehe MOBILE-Vorgabe). */
  readonly readinessTopOpenTasks = computed(() =>
    [...this.openTasks()]
      .sort((a, b) => (a.due_date ?? '9999-99-99').localeCompare(b.due_date ?? '9999-99-99'))
      .slice(0, 3),
  );
  readonly budgetTotal = computed(() => Number(this.selectedTrip()?.budget_amount || 0));
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
    note: ['', Validators.maxLength(240)],
  });

  readonly newExpenseTitle = signal('');
  readonly newExpenseAmount = signal('');
  readonly newExpenseDate = signal(localDay(new Date()));
  readonly expenseAdding = signal(false);
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
            this.selectedTripId.set(linked);
            this.tab.set('uebersicht');
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
          this.load();
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
        next: () => this.load(),
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
          this.load();
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

  private openSmartSetup(trip: Trip): void {
    const suggestions = buildTripSuggestions(trip);
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
        },
        error: () => {
          this.smartSetupSaving.set(false);
          this.smartSetupError.set('Einige Vorschläge konnten nicht übernommen werden. Bitte versuche es erneut.');
        },
      });
  }

  // ---------- Packliste ----------
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
        },
        error: () => {
          this.packingSaving.set(false);
          this.packingFormError.set('Löschen fehlgeschlagen. Bitte versuche es erneut.');
        },
      });
  }
  togglePacking(item: PackingItem): void {
    const packed = !item.is_packed;
    this.packing.update((items) => items.map((i) => (i.id === item.id ? { ...i, is_packed: packed } : i)));
    this.api
      .savePackingItem({ is_packed: packed }, item.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        error: () => {
          this.packing.update((items) => items.map((i) => (i.id === item.id ? { ...i, is_packed: !packed } : i)));
          this.actionError.set(`„${item.title}“ konnte nicht gespeichert werden.`);
        },
      });
  }

  // ---------- Aufgaben ----------
  openTaskEditor(item?: TripTask): void {
    this.taskForm.reset({
      title: item?.title ?? '',
      due_date: item?.due_date ?? '',
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
    this.taskSaving.set(true);
    this.taskFormError.set('');
    const id = this.editTaskId();
    this.api
      .saveTask({ trip: tripId, title: v.title.trim(), due_date: v.due_date || null, note: v.note.trim() }, id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (saved) => {
          this.taskSaving.set(false);
          this.taskEditor.set(false);
          this.tasks.update((items) => (id ? items.map((i) => (i.id === id ? saved : i)) : [...items, saved]));
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
        },
        error: () => {
          this.taskSaving.set(false);
          this.taskFormError.set('Löschen fehlgeschlagen. Bitte versuche es erneut.');
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
        error: () => {
          this.tasks.update((items) => items.map((i) => (i.id === item.id ? { ...i, status: item.status } : i)));
          this.actionError.set(`„${item.title}“ konnte nicht gespeichert werden.`);
        },
      });
  }

  // ---------- Budget ----------
  addExpense(): void {
    const title = this.newExpenseTitle().trim();
    const tripId = this.selectedTripId();
    const amount = Number(this.newExpenseAmount().replace(',', '.'));
    if (!title || !tripId || !Number.isFinite(amount) || amount < 0 || this.expenseAdding()) return;
    this.expenseAdding.set(true);
    this.actionError.set('');
    this.api
      .saveExpense({ trip: tripId, title, amount: amount.toFixed(2), date: this.newExpenseDate() })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (created) => {
          this.expenseAdding.set(false);
          this.expenses.update((items) => [...items, created]);
          this.newExpenseTitle.set('');
          this.newExpenseAmount.set('');
        },
        error: () => {
          this.expenseAdding.set(false);
          this.actionError.set(`„${title}“ konnte nicht hinzugefügt werden.`);
        },
      });
  }
  removeExpense(item: TripExpense): void {
    this.api
      .removeExpense(item.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => this.expenses.update((items) => items.filter((i) => i.id !== item.id)),
        error: () => this.actionError.set(`„${item.title}“ konnte nicht entfernt werden.`),
      });
  }

  /** Geplanter Betrag je Kategorie — leer/ungültig/0 heißt "nicht geplant" und entfernt die Zeile wieder, ein
   * gültiger Betrag legt sie an oder aktualisiert sie (Upsert), passend zur Unique-Constraint im Backend. */
  saveBudgetCategoryAmount(category: BudgetCategory, rawValue: string): void {
    const tripId = this.selectedTripId();
    if (!tripId) return;
    const existing = this.budgetCategories().find((r) => r.category === category);
    const amount = Number(rawValue.replace(',', '.'));
    if (!rawValue.trim() || !Number.isFinite(amount) || amount <= 0) {
      if (existing) this.removeBudgetCategoryRow(existing);
      return;
    }
    this.actionError.set('');
    this.api
      .saveBudgetCategory({ trip: tripId, category, planned_amount: amount.toFixed(2) }, existing?.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (saved) => {
          this.budgetCategories.update((rows) => (existing ? rows.map((r) => (r.id === existing.id ? saved : r)) : [...rows, saved]));
        },
        error: () => this.actionError.set(`„${this.budgetCategoryLabels[category]}“ konnte nicht gespeichert werden.`),
      });
  }
  private removeBudgetCategoryRow(row: TripBudgetCategory): void {
    this.api
      .removeBudgetCategory(row.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => this.budgetCategories.update((rows) => rows.filter((r) => r.id !== row.id)),
        error: () => this.actionError.set(`„${this.budgetCategoryLabels[row.category]}“ konnte nicht entfernt werden.`),
      });
  }

  tripDateRange(trip: Trip): string {
    const fmt = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${fmt(trip.start_date)} – ${fmt(trip.end_date)}`;
  }
  /** Kompakte Variante für den Detail-Header ("05.–09. November", ohne Jahr) — tripDateRange() bleibt für die
   * ausführlichere Listendarstellung ("5. November 2026 – 9. November 2026") unverändert. */
  tripDateRangeShort(trip: Trip): string {
    const start = new Date(`${trip.start_date}T12:00`);
    const end = new Date(`${trip.end_date}T12:00`);
    const day = (d: Date) => String(d.getDate()).padStart(2, '0');
    const month = (d: Date) => d.toLocaleDateString('de-DE', { month: 'long' });
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return `${day(start)}.–${day(end)}. ${month(start)}`;
    }
    const year = (d: Date) => (start.getFullYear() !== end.getFullYear() ? ` ${d.getFullYear()}` : '');
    return `${day(start)}. ${month(start)}${year(start)} – ${day(end)}. ${month(end)}${year(end)}`;
  }
  /** Kurzer Teilnehmer-Hinweis für den Detail-Header — "Nur du" bei einer Solo-Reise, sonst die Namen (bei
   * mehr als drei gekürzt), nie E-Mail/Rolle (die stehen schon in der Teilnehmer-Karte/dem Dialog). */
  participantsSummary(trip: Trip): string {
    const names = trip.participants.map((p) => p.display_name);
    if (names.length <= 1) return 'Nur du';
    if (names.length <= 3) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} weitere`;
  }
  daysUntil(trip: Trip): number {
    const diff = new Date(`${trip.start_date}T00:00`).getTime() - new Date(`${localDay(new Date())}T00:00`).getTime();
    return Math.round(diff / 86_400_000);
  }
  /** Text für die Tage-bis-Abreise-Pille, oder null wenn die Reise schon begonnen hat. Eigene Methode statt
   * `@if (daysUntil(next); as days)` im Template: bei days === 0 wäre die Zahl selbst falsy und die Pille
   * bliebe trotz passender @else-if-Bedingung unsichtbar. */
  tripDaysLabel(trip: Trip): string | null {
    const days = this.daysUntil(trip);
    if (days < 0) return null;
    return days === 0 ? "Heute geht's los" : `in ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
  }
}
