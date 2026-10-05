import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AppIcon } from '../../shared/icons/app-icon';
import { AppSelect, SelectOption } from '../../shared/form/select';
import { ReisenApi, ReminderArea, Trip, TripReminder } from './reisen-api.service';
import {
  AREA_LABELS,
  ReminderKind,
  ReminderRange,
  dayParts,
  filterReminders,
  groupReminders,
  householdConflicts,
  localDay,
  longDate,
  reminderIcon,
  reminderWhen,
} from './reisen-logic';
import { TripTarget } from './trip-list';
import { TripPlan, TripPlanTarget } from './trip-plan';
import { TripSwitcher } from './trip-switcher';

const INFO_KEY = 'reisen.erinnerungen.info-gelesen';

/** Reiter „Erinnerungen“: was rund um die Reise ansteht — aus Reisen, Haushalt und Organisation — als Zeitleiste,
 * rechts Vorschläge (z. B. eine Haushaltsaufgabe, die in die Reisezeit fällt) und Hinweise. */
@Component({
  selector: 'app-trip-reminders',
  imports: [AppIcon, AppSelect, TripPlan, TripSwitcher],
  templateUrl: './trip-reminders.html',
  styleUrls: ['./trip-common.scss', './trip-reminders.scss'],
})
export class TripReminders {
  private api = inject(ReisenApi);
  private auth = inject(AuthService);
  private router = inject(Router);
  private destroy = inject(DestroyRef);

  readonly trip = input.required<Trip>();
  readonly trips = input.required<Trip[]>();
  readonly packed = input(0);
  readonly packingTotal = input(0);
  /** Wird hochgezählt, wenn sich draußen etwas geändert hat (neue Erinnerung, abgehakt) — dann neu laden. */
  readonly version = input(0);
  readonly canEdit = input(true);
  readonly switchTrip = output<number>();
  readonly add = output<void>();
  readonly editTask = output<number>();
  readonly toggleTask = output<{ id: number; done: boolean }>();
  readonly openTab = output<TripTarget>();

  readonly areaLabels = AREA_LABELS;
  protected readonly icon = reminderIcon;
  protected readonly when = reminderWhen;
  protected readonly parts = dayParts;
  readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  readonly items = signal<TripReminder[]>([]);
  readonly range = signal<ReminderRange>('all');
  readonly area = signal<ReminderArea | ''>('');
  readonly kind = signal<ReminderKind>('');
  readonly filtersOpen = signal(false);
  readonly menuFor = signal<string | null>(null);
  readonly infoHidden = signal(readInfoHidden());
  readonly signedIn = computed(() => this.auth.isAuthenticated());
  readonly today = localDay(new Date());

  readonly areaOptions: SelectOption[] = [
    { value: '', label: 'Alle Bereiche' },
    { value: 'REISEN', label: 'Reisen' },
    { value: 'HAUSHALT', label: 'Haushalt' },
    { value: 'ORGANISATION', label: 'Organisation' },
  ];
  readonly kindOptions: SelectOption[] = [
    { value: '', label: 'Aufgaben und Termine' },
    { value: 'task', label: 'Nur Aufgaben' },
    { value: 'event', label: 'Nur Termine' },
  ];
  readonly shown = computed(() => filterReminders(this.items(), { range: this.range(), area: this.area(), kind: this.kind() }, this.today));
  readonly days = computed(() => groupReminders(this.shown()));
  readonly rangeTitle = computed(() => ({ all: 'Alle Erinnerungen', today: 'Heute', week: 'Diese Woche' })[this.range()]);
  readonly conflicts = computed(() => householdConflicts(this.items(), this.trip()));
  readonly missing = computed(() => this.packingTotal() - this.packed());

  constructor() {
    effect(() => {
      const id = this.trip().id;
      this.version();
      untracked(() => this.load(id));
    });
  }

  load(id = this.trip().id) {
    if (!this.items().length) this.status.set('loading');
    this.api
      .reminders(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          if (id !== this.trip().id) return;
          this.items.set(r?.items ?? []);
          this.status.set('ready');
        },
        error: () => this.status.set('error'),
      });
  }
  dayTitle(date: string | null): string {
    if (!date) return 'Ohne Datum';
    if (date === this.today) return 'Heute';
    return reminderWhen(date, null);
  }
  placeIcon(r: TripReminder) {
    return r.area === 'HAUSHALT' ? 'household' : 'map-pin';
  }
  toggleMenu(key: string) {
    this.menuFor.update((k) => (k === key ? null : key));
  }
  edit(r: TripReminder) {
    this.menuFor.set(null);
    if (r.id !== null) this.editTask.emit(r.id);
  }
  setDone(r: TripReminder) {
    this.menuFor.set(null);
    if (r.id === null) return;
    // sofort sichtbar, das Speichern übernimmt die Seite
    this.items.update((list) => list.map((i) => (i.key === r.key ? { ...i, done: !r.done } : i)));
    this.toggleTask.emit({ id: r.id, done: !r.done });
  }
  openArea(r: TripReminder) {
    this.menuFor.set(null);
    const base = this.router.url.startsWith('/demo') ? '/demo' : '';
    void this.router.navigateByUrl(`${base}/${r.area === 'HAUSHALT' ? 'haushalt' : 'organisation'}`);
  }
  conflictText(r: TripReminder): string {
    return `Am ${longDate(r.date!)} bist du auf „${this.trip().title}“. Im Haushalt kannst du sie verschieben oder jemand anderem zuweisen.`;
  }
  planTab(target: TripPlanTarget) {
    this.openTab.emit(target === 'budget' ? 'budget' : 'packlisten');
  }
  hideInfo() {
    this.infoHidden.set(true);
    try {
      localStorage.setItem(INFO_KEY, '1');
    } catch {
      // ohne Speicher bleibt der Hinweis nur für diesen Besuch ausgeblendet
    }
  }
}

function readInfoHidden(): boolean {
  try {
    return localStorage.getItem(INFO_KEY) === '1';
  } catch {
    return false;
  }
}
