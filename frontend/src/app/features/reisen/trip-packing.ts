import { Component, computed, input, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { AppSelect, SelectOption } from '../../shared/form/select';
import { PackingCategory, PackingItem } from './reisen-api.service';
import { PACKING_META, PACKING_ORDER, PackingView, packingGroups, percent } from './reisen-logic';

/** Reise › Packliste: Artikel eintippen und Enter (Kategorie optional), nach Kategorie gruppiert abhaken, Fortschritt
 * „12 von 24 gepackt“. Seit 31.10.2026 oben Kategorie-Kacheln mit Ring (antippen springt zur Gruppe) und ein ruhiger
 * Fertig-Moment, wenn alles gepackt ist. Kein Inventarsystem. */
@Component({
  selector: 'app-trip-packing',
  imports: [AppIcon, AppSelect],
  templateUrl: './trip-packing.html',
  styleUrls: ['./trip-common.scss', './trip-packing.scss'],
})
export class TripPacking {
  readonly items = input.required<PackingItem[]>();
  readonly canEdit = input(true);
  readonly busy = input(false);
  readonly quickAdd = output<{ title: string; category: PackingCategory }>();
  readonly toggle = output<PackingItem>();
  readonly edit = output<PackingItem>();
  readonly add = output<void>();
  readonly suggest = output<void>();
  readonly reset = output<void>();

  readonly view = signal<PackingView>('all');
  readonly collapsed = signal<ReadonlySet<PackingCategory>>(new Set());
  readonly confirmReset = signal(false);
  readonly draft = signal('');
  readonly category = signal<PackingCategory | ''>('');
  readonly categoryOptions: SelectOption[] = [
    { value: '', label: 'Ohne Kategorie' },
    ...PACKING_ORDER.filter((c) => c !== 'SONSTIGES').map((c) => ({ value: c, label: PACKING_META[c].label })),
  ];

  readonly packed = computed(() => this.items().filter((i) => i.is_packed).length);
  readonly pct = computed(() => percent(this.packed(), this.items().length));
  readonly groups = computed(() => packingGroups(this.items(), this.view()));
  /** Kacheln oben: jede Kategorie mit Ring „2/4“ — immer über die ganze Kategorie, unabhängig von der Ansicht. */
  readonly tiles = computed(() =>
    packingGroups(this.items(), 'all').map((g) => ({ ...g, short: g.label.replace(/^Wichtige /, ''), pct: percent(g.packed, g.total) })),
  );
  readonly allPacked = computed(() => this.items().length > 0 && this.packed() === this.items().length);

  /** Kachel antippen: Gruppe aufklappen (bei Bedarf „Alle“ zeigen) und dorthin springen. */
  jump(category: PackingCategory): void {
    if (!this.groups().some((g) => g.category === category)) this.view.set('all');
    this.collapsed.update((set) => {
      const next = new Set(set);
      next.delete(category);
      return next;
    });
    setTimeout(() => {
      const target = document.getElementById('pk-sec-' + category);
      if (!target) return;
      const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
      target.querySelector<HTMLButtonElement>('.group__head')?.focus({ preventScroll: true });
    });
  }

  toggleGroup(category: PackingCategory) {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }
  /** Auch per Enter im Feld (siehe einkauf-tab submitNew): nicht vom Zustand des gesperrten Knopfs abhängig. */
  submit(event: Event): void {
    event.preventDefault();
    const input = (event.target as HTMLElement).closest('form')?.querySelector<HTMLInputElement>('#packing-quick');
    const title = (input?.value ?? this.draft()).trim();
    if (!title || this.busy()) return;
    // Ausdrücklich leeren (siehe einkauf-tab submitNew).
    if (input) input.value = '';
    this.quickAdd.emit({ title, category: this.category() || 'SONSTIGES' });
    this.draft.set('');
    if (this.view() === 'done') this.view.set('all');
  }
  doReset() {
    this.confirmReset.set(false);
    this.reset.emit();
  }
}
