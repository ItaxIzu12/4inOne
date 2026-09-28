import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppShell } from '../../layout/app-shell';
import { AppIcon } from '../../shared/icons/app-icon';
import { AppDatePicker } from '../../shared/form/date-picker';
import { Field } from '../../shared/form/field';
import { AppSelect, SelectOption } from '../../shared/form/select';
import { ModalForm } from '../../shared/form/modal-form';
import { PackingItem, ReisenApi, Trip, TripExpense, TripTask } from './reisen-api.service';

export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-reisen',
  standalone: true,
  imports: [AppShell, AppIcon, Field, ModalForm, ReactiveFormsModule, AppSelect, AppDatePicker, DecimalPipe, DatePipe],
  templateUrl: './reisen.html',
  styleUrl: './reisen.scss',
})
export class Reisen {
  private api = inject(ReisenApi);
  private destroy = inject(DestroyRef);
  private fb = inject(FormBuilder);

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
      .filter((t) => t.status !== 'CANCELLED' && (!t.start_date || t.start_date >= today))
      .sort((a, b) => (a.start_date || '9999').localeCompare(b.start_date || '9999'));
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

  // ---------- Reise anlegen/bearbeiten ----------
  readonly tripEditor = signal(false);
  readonly editTripId = signal<number | undefined>(undefined);
  readonly tripSaving = signal(false);
  readonly tripFormError = signal('');
  readonly tripForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    destination: ['', Validators.maxLength(160)],
    start_date: [''],
    end_date: [''],
    status: ['PLANNED'],
    budget_amount: [''],
    notes: ['', Validators.maxLength(5000)],
  });

  // ---------- Reisedetails der ausgewählten Reise ----------
  readonly packing = signal<PackingItem[]>([]);
  readonly tasks = signal<TripTask[]>([]);
  readonly expenses = signal<TripExpense[]>([]);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');

  readonly packingProgress = computed(() => {
    const items = this.packing();
    return items.length ? Math.round((items.filter((i) => i.is_packed).length / items.length) * 100) : 0;
  });
  readonly openTasks = computed(() => this.tasks().filter((t) => t.status === 'OPEN'));
  readonly budgetTotal = computed(() => Number(this.selectedTrip()?.budget_amount || 0));
  readonly budgetSpent = computed(() => this.expenses().reduce((sum, e) => sum + Number(e.amount), 0));
  readonly budgetProgress = computed(() => {
    const total = this.budgetTotal();
    return total > 0 ? Math.min(100, (this.budgetSpent() / total) * 100) : this.budgetSpent() > 0 ? 100 : 0;
  });

  readonly newPackingTitle = signal('');
  readonly newPackingQuantity = signal('1');
  readonly packingAdding = signal(false);
  readonly newTaskTitle = signal('');
  readonly newTaskDue = signal('');
  readonly taskAdding = signal(false);
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

  private loadTripDetail(tripId: number): void {
    this.detailLoading.set(true);
    this.detailError.set('');
    forkJoin({
      packing: this.api.packingItems(tripId),
      tasks: this.api.tasks(tripId),
      expenses: this.api.expenses(tripId),
    })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.packing.set(r.packing);
          this.tasks.set(r.tasks);
          this.expenses.set(r.expenses);
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
  openTripEditor(trip?: Trip): void {
    this.tripForm.reset({
      title: trip?.title ?? '',
      destination: trip?.destination ?? '',
      start_date: trip?.start_date ?? '',
      end_date: trip?.end_date ?? '',
      status: trip?.status ?? 'PLANNED',
      budget_amount: trip?.budget_amount ?? '',
      notes: trip?.notes ?? '',
    });
    this.editTripId.set(trip?.id);
    this.tripFormError.set('');
    this.tripEditor.set(true);
  }
  closeTripEditor(): void {
    if (!this.tripSaving()) this.tripEditor.set(false);
  }
  saveTrip(): void {
    if (this.tripSaving()) return;
    this.tripForm.markAllAsTouched();
    const v = this.tripForm.getRawValue();
    if (this.tripForm.invalid || !v.title.trim()) {
      this.tripFormError.set('Bitte gib einen Titel ein (maximal 120 Zeichen).');
      return;
    }
    if (v.start_date && v.end_date && v.end_date < v.start_date) {
      this.tripFormError.set('Das Ende darf nicht vor dem Beginn liegen.');
      return;
    }
    if (v.budget_amount && Number(v.budget_amount) < 0) {
      this.tripFormError.set('Das Budget darf nicht negativ sein.');
      return;
    }
    this.tripSaving.set(true);
    this.tripFormError.set('');
    this.api
      .saveTrip(
        {
          title: v.title.trim(),
          destination: v.destination.trim(),
          start_date: v.start_date || null,
          end_date: v.end_date || null,
          status: v.status as Trip['status'],
          budget_amount: v.budget_amount ? v.budget_amount : null,
          notes: v.notes,
        },
        this.editTripId(),
      )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.tripSaving.set(false);
          this.tripEditor.set(false);
          this.load();
        },
        error: () => {
          this.tripSaving.set(false);
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

  // ---------- Packliste ----------
  addPacking(): void {
    const title = this.newPackingTitle().trim();
    const tripId = this.selectedTripId();
    if (!title || !tripId || this.packingAdding()) return;
    this.packingAdding.set(true);
    this.actionError.set('');
    const quantity = Math.max(1, Number(this.newPackingQuantity()) || 1);
    this.api
      .savePackingItem({ trip: tripId, title, quantity, is_packed: false })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (created) => {
          this.packingAdding.set(false);
          this.packing.update((items) => [...items, created]);
          this.newPackingTitle.set('');
          this.newPackingQuantity.set('1');
        },
        error: () => {
          this.packingAdding.set(false);
          this.actionError.set(`„${title}“ konnte nicht hinzugefügt werden.`);
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
  removePacking(item: PackingItem): void {
    this.api
      .removePackingItem(item.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => this.packing.update((items) => items.filter((i) => i.id !== item.id)),
        error: () => this.actionError.set(`„${item.title}“ konnte nicht entfernt werden.`),
      });
  }

  // ---------- Aufgaben ----------
  addTask(): void {
    const title = this.newTaskTitle().trim();
    const tripId = this.selectedTripId();
    if (!title || !tripId || this.taskAdding()) return;
    this.taskAdding.set(true);
    this.actionError.set('');
    this.api
      .saveTask({ trip: tripId, title, due_date: this.newTaskDue() || null, status: 'OPEN' })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (created) => {
          this.taskAdding.set(false);
          this.tasks.update((items) => [...items, created]);
          this.newTaskTitle.set('');
          this.newTaskDue.set('');
        },
        error: () => {
          this.taskAdding.set(false);
          this.actionError.set(`„${title}“ konnte nicht hinzugefügt werden.`);
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
  removeTask(item: TripTask): void {
    this.api
      .removeTask(item.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => this.tasks.update((items) => items.filter((i) => i.id !== item.id)),
        error: () => this.actionError.set(`„${item.title}“ konnte nicht entfernt werden.`),
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

  tripDateRange(trip: Trip): string {
    if (!trip.start_date && !trip.end_date) return 'Kein Zeitraum festgelegt';
    const fmt = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
    if (trip.start_date && trip.end_date) return `${fmt(trip.start_date)} – ${fmt(trip.end_date)}`;
    return fmt(trip.start_date || trip.end_date!);
  }
  daysUntil(trip: Trip): number | null {
    if (!trip.start_date) return null;
    const diff = new Date(`${trip.start_date}T00:00`).getTime() - new Date(`${localDay(new Date())}T00:00`).getTime();
    return Math.round(diff / 86_400_000);
  }
}
