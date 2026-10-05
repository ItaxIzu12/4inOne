import { Component, computed, input, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { PackingCategory, PackingItem, Trip } from './reisen-api.service';
import {
  PackingView,
  STATUS_LABELS,
  STATUS_TONE,
  countdown,
  dateRange,
  localDay,
  notPackedHint,
  packingGroups,
  packingTips,
  percent,
} from './reisen-logic';
import { TripSwitcher } from './trip-switcher';
import { TripTarget } from './trip-list';

/** Reiter „Packlisten“: Fortschritt, Kategorien zum Abhaken, rechts Reiseübersicht, Schnellaktionen und Tipps. */
@Component({
  selector: 'app-trip-packing',
  imports: [AppIcon, TripSwitcher],
  templateUrl: './trip-packing.html',
  styleUrls: ['./trip-common.scss', './trip-packing.scss'],
})
export class TripPacking {
  readonly trip = input.required<Trip>();
  readonly trips = input.required<Trip[]>();
  readonly items = input.required<PackingItem[]>();
  readonly tasksOpen = input(0);
  readonly budgetSpent = input(0);
  readonly budgetTotal = input(0);
  readonly canEdit = input(true);
  readonly switchTrip = output<number>();
  readonly back = output<void>();
  readonly toggle = output<PackingItem>();
  readonly edit = output<PackingItem>();
  readonly add = output<PackingCategory | null>();
  readonly share = output<void>();
  readonly suggest = output<void>();
  readonly reset = output<void>();
  readonly openTab = output<TripTarget>();

  readonly labels = STATUS_LABELS;
  readonly tone = STATUS_TONE;
  protected readonly range = dateRange;
  readonly view = signal<PackingView>('all');
  readonly hideDone = signal(false);
  readonly collapsed = signal<ReadonlySet<PackingCategory>>(new Set());
  readonly confirmReset = signal(false);

  readonly packed = computed(() => this.items().filter((i) => i.is_packed).length);
  readonly pct = computed(() => percent(this.packed(), this.items().length));
  readonly effectiveView = computed<PackingView>(() => (this.hideDone() && this.view() === 'all' ? 'open' : this.view()));
  readonly groups = computed(() => packingGroups(this.items(), this.effectiveView()));
  readonly hint = computed(() => notPackedHint(this.items()));
  readonly tips = computed(() => packingTips(this.trip(), this.items()));
  readonly when = computed(() => countdown(this.trip(), localDay(new Date())));
  readonly budgetPct = computed(() => percent(this.budgetSpent(), this.budgetTotal()));

  toggleGroup(category: PackingCategory) {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }
  packedOn(item: PackingItem): string {
    if (!item.packed_at) return '';
    return new Date(item.packed_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  }
  money(value: number): string {
    const text = value.toLocaleString('de-DE', { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 });
    return this.trip().currency === 'EUR' ? `${text} €` : `${text} ${this.trip().currency}`;
  }
  print() {
    window.print();
  }
  askReset() {
    this.confirmReset.set(true);
  }
  doReset() {
    this.confirmReset.set(false);
    this.reset.emit();
  }
}
