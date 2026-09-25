import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { Field } from '../../shared/form/field';
import { Modal } from '../../shared/modal/modal';
import { ModalForm } from '../../shared/form/modal-form';
import { FinanzenStateService } from '../finanzen/finanzen-state.service';
import { ItemSuggestionDto, SectionKey, ShoppingItemDto, ShoppingOverviewDto } from './haushalt-api.service';
import { HAUSHALT_DATA_PROVIDER } from './haushalt-data-provider';
import { SECTIONS, estimateAmount, groupOpenItems, sliderMax } from './haushalt-logic';

const MODE_STORAGE_KEY = 'kompass.einkaufsmodus';

// So lange bleibt ein abgehakter Artikel durchgestrichen an seinem Platz,
// bevor er in den Wagen wandert. Sonst rückt die Liste sofort nach oben und
// ein schnelles zweites Tippen trifft den falschen Artikel.
const SETTLE_MS = 900;

function readMode(): boolean {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

/**
 * Einkaufsliste mit Einkaufsmodus und dem Einkauf-zu-Ausgabe-Moment
 * (GESAMTKONZEPT.md §5.1).
 *
 * Einkaufsmodus: zeigt nur, was noch fehlt, gruppiert nach Ladenbereich in
 * Supermarkt-Reihenfolge — die Lücke, die FamilyWall-Nutzer bemängeln
 * ("die GESAMTE Liste durchscrollen", GESAMTKONZEPT.md §12). Abgehakte
 * Artikel verschwinden in den "Wagen" und lassen sich dort zurückholen.
 *
 * Abhaken ist optimistisch: die Zeile reagiert sofort, schlägt die
 * Speicherung fehl, springt sie zurück und es erscheint ein Hinweis.
 */
@Component({
  selector: 'app-einkauf-tab',
  standalone: true,
  imports: [DecimalPipe, Field, Modal, ModalForm],
  templateUrl: './einkauf-tab.html',
  styleUrls: ['./haushalt-common.scss', './einkauf-tab.scss'],
})
export class EinkaufTab {
  private readonly provider = inject(HAUSHALT_DATA_PROVIDER);
  private readonly financeState = inject(FinanzenStateService);
  readonly saved = output<string>();

  protected readonly data = signal<ShoppingOverviewDto | null>(null);
  protected readonly loadError = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly shoppingMode = signal(readMode());

  protected readonly newName = signal('');
  protected readonly newQuantity = signal('');
  protected readonly adding = signal(false);

  protected readonly sections = computed(() => this.data()?.sections ?? SECTIONS);
  private readonly settling = signal<ReadonlySet<ShoppingItemDto['id']>>(new Set());
  private readonly settleTimers = new Map<ShoppingItemDto['id'], ReturnType<typeof setTimeout>>();
  protected readonly openGroups = computed(() =>
    groupOpenItems(this.data()?.items ?? [], this.sections(), this.settling()),
  );
  protected readonly openCount = computed(() => (this.data()?.items ?? []).filter((i) => !i.is_checked).length);
  protected readonly checkedItems = computed(() => (this.data()?.items ?? []).filter((i) => i.is_checked));
  protected readonly cartItems = computed(() => this.checkedItems().filter((i) => !this.settling().has(i.id)));
  protected readonly pricePerItem = computed(() => Number(this.data()?.price_per_item ?? 3.5));
  protected readonly estimate = computed(() => estimateAmount(this.pricePerItem(), this.checkedItems().length));
  protected readonly canBook = computed(() => this.data()?.can_book_expense ?? false);

  // ---------- Bearbeiten ----------
  protected readonly editing = signal<ShoppingItemDto | null>(null);
  protected readonly editName = signal('');
  protected readonly editQuantity = signal('');
  protected readonly editSection = signal<SectionKey>('sonstiges');
  protected readonly editError = signal<string | null>(null);
  protected readonly editSaving = signal(false);

  // ---------- Einkauf abschließen ----------
  protected readonly completeOpen = signal(false);
  protected readonly completeAmount = signal(0);
  protected readonly completeSliderMax = signal(50);
  protected readonly completeSubmitting = signal(false);
  protected readonly completeError = signal<string | null>(null);

  constructor() {
    this.load();
    // Die Liste teilen sich mehrere Personen: kommt man in den Tab zurück
    // (Handy aus der Tasche), zeigt er, was andere inzwischen eingetragen
    // oder abgehakt haben. Echtzeit-Sync folgt später (siehe Konzept).
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !this.completeOpen() && !this.editing()) this.load();
    };
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisible);
      this.settleTimers.forEach((timer) => clearTimeout(timer));
    });
  }

  protected load(): void {
    this.provider.getShopping().subscribe({
      next: (data) => {
        this.data.set(data);
        this.loadError.set(false);
      },
      error: () => this.loadError.set(true),
    });
  }

  protected toggleMode(): void {
    const next = !this.shoppingMode();
    this.shoppingMode.set(next);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next ? '1' : '0');
    } catch {
      // Ohne Speicher gilt die Auswahl nur bis zum Neuladen — kein Problem.
    }
  }

  protected submitNew(event: Event): void {
    event.preventDefault();
    const name = this.newName().trim();
    if (!name || this.adding()) return;
    this.add(name, this.newQuantity().trim(), null, () => {
      this.newName.set('');
      this.newQuantity.set('');
    });
  }

  protected addSuggestion(suggestion: ItemSuggestionDto): void {
    this.add(suggestion.name, '', suggestion.section);
  }

  private add(name: string, quantity: string, section: SectionKey | null, done?: () => void): void {
    this.adding.set(true);
    this.actionError.set(null);
    this.provider.addItem(name, quantity, section).subscribe({
      next: (created) => {
        this.adding.set(false);
        this.data.update((data) => {
          if (!data) return data;
          const exists = data.items.some((i) => i.id === created.id);
          return {
            ...data,
            items: exists ? data.items.map((i) => (i.id === created.id ? created : i)) : [...data.items, created],
            suggestions: data.suggestions.filter((s) => s.name.toLowerCase() !== created.name.toLowerCase()),
          };
        });
        done?.();
      },
      error: () => {
        this.adding.set(false);
        this.actionError.set(`„${name}“ konnte nicht hinzugefügt werden. Bitte noch einmal versuchen.`);
      },
    });
  }

  protected toggle(item: ShoppingItemDto): void {
    const checked = !item.is_checked;
    this.setSettling(item.id, checked);
    this.patchLocal(item.id, { is_checked: checked });
    this.actionError.set(null);
    this.provider.updateItem(item.id, { is_checked: checked }).subscribe({
      next: (updated) => this.patchLocal(item.id, updated),
      error: () => {
        this.setSettling(item.id, false);
        this.patchLocal(item.id, { is_checked: item.is_checked });
        this.actionError.set(`„${item.name}“ konnte nicht gespeichert werden. Bitte noch einmal versuchen.`);
      },
    });
  }

  private setSettling(id: ShoppingItemDto['id'], on: boolean): void {
    clearTimeout(this.settleTimers.get(id));
    this.settleTimers.delete(id);
    const next = new Set(this.settling());
    if (on) {
      next.add(id);
      this.settleTimers.set(
        id,
        setTimeout(() => this.setSettling(id, false), SETTLE_MS),
      );
    } else {
      next.delete(id);
    }
    this.settling.set(next);
  }

  private patchLocal(id: ShoppingItemDto['id'], patch: Partial<ShoppingItemDto>): void {
    this.data.update((data) =>
      data ? { ...data, items: data.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } : data,
    );
  }

  protected itemLabel(item: ShoppingItemDto): string {
    return item.quantity ? `${item.name}, ${item.quantity}` : item.name;
  }

  // ---------- Bearbeiten ----------

  protected openEdit(item: ShoppingItemDto): void {
    this.editing.set(item);
    this.editName.set(item.name);
    this.editQuantity.set(item.quantity);
    this.editSection.set(item.section);
    this.editError.set(null);
  }

  protected closeEdit(): void {
    this.editing.set(null);
  }

  protected saveEdit(): void {
    const item = this.editing();
    if (!item || this.editSaving()) return;
    const name = this.editName().trim();
    if (!name) {
      this.editError.set('Bitte einen Namen eingeben.');
      return;
    }
    this.editSaving.set(true);
    this.provider
      .updateItem(item.id, { name, quantity: this.editQuantity().trim(), section: this.editSection() })
      .subscribe({
        next: (updated) => {
          this.editSaving.set(false);
          this.patchLocal(item.id, updated);
          this.closeEdit();
        },
        error: () => {
          this.editSaving.set(false);
          this.editError.set('Speichern hat nicht geklappt. Bitte noch einmal versuchen.');
        },
      });
  }

  protected deleteEditing(): void {
    const item = this.editing();
    if (!item || this.editSaving()) return;
    this.editSaving.set(true);
    this.provider.deleteItem(item.id).subscribe({
      next: () => {
        this.editSaving.set(false);
        this.data.update((data) => (data ? { ...data, items: data.items.filter((i) => i.id !== item.id) } : data));
        this.closeEdit();
        this.saved.emit(`„${item.name}“ entfernt.`);
      },
      error: () => {
        this.editSaving.set(false);
        this.editError.set('Entfernen hat nicht geklappt. Bitte noch einmal versuchen.');
      },
    });
  }

  // ---------- Einkauf abschließen ----------

  protected openComplete(): void {
    const estimate = this.estimate();
    this.completeAmount.set(estimate);
    this.completeSliderMax.set(sliderMax(estimate));
    this.completeError.set(null);
    this.completeOpen.set(true);
  }

  protected closeComplete(): void {
    this.completeOpen.set(false);
  }

  protected setAmountFromSlider(value: string): void {
    this.completeAmount.set(Number(value));
  }

  /** Betrag fürs Textfeld, deutsch formatiert ohne Tausenderpunkt. */
  protected exactValue(): string {
    return this.completeAmount().toFixed(2).replace('.', ',');
  }

  protected setAmountFromInput(value: string): void {
    // Deutsche Schreibweise: "1.234,50" → 1234.5
    const amount = Number(value.trim().replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(amount)) {
      this.completeAmount.set(amount);
      if (amount > this.completeSliderMax()) this.completeSliderMax.set(sliderMax(amount));
    }
  }

  protected nudge(delta: number): void {
    this.completeAmount.update((amount) => Math.max(0, Math.round((amount + delta) * 2) / 2));
    if (this.completeAmount() > this.completeSliderMax()) this.completeSliderMax.set(sliderMax(this.completeAmount()));
  }

  protected formatEuro(value: number): string {
    return formatEuro(value);
  }

  protected complete(withExpense: boolean): void {
    if (this.completeSubmitting()) return;
    const amount = withExpense ? Math.round(this.completeAmount() * 100) / 100 : null;
    if (amount !== null && (amount <= 0 || amount >= 1_000_000)) {
      this.completeError.set('Bitte einen Betrag größer als 0 € wählen.');
      return;
    }
    this.completeSubmitting.set(true);
    this.completeError.set(null);
    this.provider.completeShopping(amount).subscribe({
      next: (result) => {
        this.completeSubmitting.set(false);
        this.completeOpen.set(false);
        this.load();
        if (result.amount !== null) {
          // Budget, Kategorien und "Verfügbares Einkommen" sofort neu laden —
          // Sidebar/Dashboard zeigen den Einkauf damit ohne Umweg.
          this.financeState.invalidieren();
          this.saved.emit(`Einkauf abgeschlossen · ${formatEuro(Number(result.amount))} in Finanzen gebucht.`);
        } else {
          this.saved.emit(`Einkauf abgeschlossen · ${result.item_count} Artikel.`);
        }
      },
      error: () => {
        this.completeSubmitting.set(false);
        this.completeError.set('Der Einkauf konnte nicht abgeschlossen werden. Bitte noch einmal versuchen.');
      },
    });
  }
}
