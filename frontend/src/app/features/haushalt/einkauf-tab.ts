import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { AmountInput } from '../../shared/directives/amount-input';
import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, Injector, afterNextRender, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HouseholdInviteModalService } from '../../core/household/household-invite-modal.service';
import { AppIcon } from '../../shared/icons/app-icon';
import { Field } from '../../shared/form/field';
import { AppSelect, SelectOption } from '../../shared/form/select';
import { Modal } from '../../shared/modal/modal';
import { ModalForm } from '../../shared/form/modal-form';
import {
  Id,
  ItemSuggestionDto,
  SectionKey,
  ShoppingItemDto,
  ShoppingListDto,
  ShoppingListIcon,
  ShoppingOverviewDto,
} from './haushalt-api.service';
import { HAUSHALT_DATA_PROVIDER } from './haushalt-data-provider';
import { SECTIONS, estimateAmount, sliderMax } from './haushalt-logic';
import { avatarTone, initials } from './aufgaben-logic';
import {
  LIST_ICONS,
  SECTION_ICONS,
  ago,
  editedLabel,
  groupItems,
  listIcon,
  splitQuantity,
} from './einkauf-logic';
import { RowMenu, RowMenuItem } from './row-menu';

const MODE_STORAGE_KEY = 'kompass.einkaufsmodus';

// So lange bleibt ein abgehakter Artikel im Einkaufsmodus durchgestrichen an
// seinem Platz, bevor er in den Wagen wandert. Sonst rückt die Liste sofort
// nach oben und ein schnelles zweites Tippen trifft den falschen Artikel.
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
 * Einkaufslisten nach Entwurf: links alle Listen des Haushalts (Wocheneinkauf,
 * Drogerie …) mit Fortschritt, in der Mitte die gewählte Liste nach
 * Ladenbereich gruppiert (abgehakte bleiben durchgestrichen stehen), rechts
 * Mitglieder und der Hinweis, dass ein Einkauf zur Ausgabe wird.
 *
 * Erhalten aus der bisherigen Einkaufsliste (GESAMTKONZEPT.md §5.1):
 * Einkaufsmodus (nur was fehlt, abgehakte wandern in den Wagen), Schnell
 * hinzufügen aus dem Gedächtnis und der Einkauf-zu-Ausgabe-Moment.
 * Abhaken ist optimistisch: die Zeile reagiert sofort, schlägt die
 * Speicherung fehl, springt sie zurück und es erscheint ein Hinweis.
 */
@Component({
  selector: 'app-einkauf-tab',
  standalone: true,
  imports: [ErrorNoticeDirective, AmountInput, DecimalPipe, AppIcon, Field, Modal, ModalForm, AppSelect, RowMenu],
  templateUrl: './einkauf-tab.html',
  styleUrls: ['./haushalt-common.scss', './einkauf-tab.scss'],
})
export class EinkaufTab {
  private readonly provider = inject(HAUSHALT_DATA_PROVIDER);
  private readonly invite = inject(HouseholdInviteModalService);
  /** In der öffentlichen Demo gibt es niemanden einzuladen. */
  protected readonly isDemo = inject(Router).url.startsWith('/demo');
  readonly saved = output<string>();
  /** Steigt bei jedem „Neue Liste“ im Seitenkopf; > 0 öffnet das Formular. */
  readonly newRequest = input(0);

  protected readonly lists = signal<ShoppingListDto[]>([]);
  protected readonly currentId = signal<Id | null>(null);
  protected readonly data = signal<ShoppingOverviewDto | null>(null);
  protected readonly loadError = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly shoppingMode = signal(readMode());

  protected readonly newName = signal('');
  protected readonly newSection = signal<SectionKey | ''>('');
  protected readonly adding = signal(false);

  protected readonly sections = computed(() => this.data()?.sections ?? SECTIONS);
  protected readonly items = computed(() => this.data()?.items ?? []);
  private readonly settling = signal<ReadonlySet<ShoppingItemDto['id']>>(new Set());
  private readonly settleTimers = new Map<ShoppingItemDto['id'], ReturnType<typeof setTimeout>>();
  protected readonly collapsed = signal<ReadonlySet<SectionKey>>(new Set());
  protected readonly sectionOptions = computed<SelectOption[]>(() => this.sections().map((s) => ({ value: s.key, label: s.label })));
  protected readonly addSectionOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Automatisch einsortieren' },
    ...this.sectionOptions(),
  ]);
  protected readonly groups = computed(() => groupItems(this.items(), this.sections(), this.shoppingMode(), this.settling()));
  protected readonly openCount = computed(() => this.items().filter((i) => !i.is_checked).length);
  protected readonly checkedItems = computed(() => this.items().filter((i) => i.is_checked));
  protected readonly cartItems = computed(() => this.checkedItems().filter((i) => !this.settling().has(i.id)));
  protected readonly pricePerItem = computed(() => Number(this.data()?.price_per_item ?? 3.5));
  protected readonly estimate = computed(() => estimateAmount(this.pricePerItem(), this.checkedItems().length));
  protected readonly canBook = computed(() => this.data()?.can_book_expense ?? false);
  protected readonly members = computed(() => this.data()?.members ?? []);
  protected readonly progress = computed(() => {
    const total = this.items().length;
    return total ? Math.round((this.checkedItems().length / total) * 100) : 0;
  });
  /** Die Listen links, mit den Zählern der gerade offenen Liste aus den lokalen Einträgen. */
  protected readonly listCards = computed(() =>
    this.lists().map((list) =>
      list.id === this.data()?.list.id
        ? { ...list, item_count: this.items().length, checked_count: this.checkedItems().length }
        : list,
    ),
  );

  // ---------- Darstellung ----------
  protected readonly sectionIcons = SECTION_ICONS;
  protected readonly listIcon = listIcon;
  protected readonly listIconOptions = LIST_ICONS;
  protected readonly splitQuantity = splitQuantity;
  protected readonly ago = ago;
  protected readonly editedLabel = editedLabel;
  protected readonly initials = initials;
  protected readonly avatarTone = avatarTone;
  protected readonly itemMenu: RowMenuItem[] = [
    { key: 'edit', label: 'Bearbeiten', icon: 'edit' },
    { key: 'delete', label: 'Von der Liste entfernen', icon: 'trash', danger: true },
  ];
  protected readonly groupMenu: RowMenuItem[] = [
    { key: 'check', label: 'Alle abhaken', icon: 'check' },
    { key: 'uncheck', label: 'Alle zurücksetzen', icon: 'repeat' },
  ];
  protected readonly listMenu = computed<RowMenuItem[]>(() => [
    { key: 'mode', label: this.shoppingMode() ? 'Einkaufsmodus beenden' : 'Einkaufsmodus starten', icon: 'cart' },
    { key: 'edit', label: 'Liste bearbeiten', icon: 'edit' },
    { key: 'complete', label: 'Einkauf abschließen', icon: 'check-circle', disabled: this.checkedItems().length === 0 },
    { key: 'archive', label: 'Liste archivieren', icon: 'archive', disabled: this.lists().length <= 1 },
  ]);
  protected readonly listCardMenu = computed<RowMenuItem[]>(() => [
    { key: 'edit', label: 'Liste bearbeiten', icon: 'edit' },
    { key: 'archive', label: 'Liste archivieren', icon: 'archive', disabled: this.lists().length <= 1 },
  ]);

  // ---------- Archiv ----------
  /** Archivierte Listen bleiben erhalten, sind aber ausgeblendet — hier wiederherstellbar. */
  protected readonly archiveOpen = signal(false);
  protected readonly archived = signal<ShoppingListDto[] | null>(null);
  protected readonly archiving = signal(false);

  // ---------- Eintrag bearbeiten ----------
  protected readonly editing = signal<ShoppingItemDto | null>(null);
  protected readonly editName = signal('');
  protected readonly editQuantity = signal('');
  protected readonly editSection = signal<SectionKey>('sonstiges');
  protected readonly editError = signal<string | null>(null);
  protected readonly editSaving = signal(false);

  // ---------- Liste anlegen / bearbeiten ----------
  protected readonly listFormOpen = signal(false);
  protected readonly listEditingId = signal<Id | null>(null);
  protected readonly listName = signal('');
  protected readonly listDescription = signal('');
  protected readonly listIconValue = signal<ShoppingListIcon>('wagen');
  protected readonly listError = signal<string | null>(null);
  protected readonly listSaving = signal(false);

  // ---------- Einkauf abschließen ----------
  protected readonly completeOpen = signal(false);
  protected readonly completeAmount = signal(0);
  protected readonly completeSliderMax = signal(50);
  protected readonly completeSubmitting = signal(false);
  protected readonly completeError = signal<string | null>(null);

  constructor() {
    this.load();
    effect(() => {
      if (this.newRequest() > 0) untracked(() => this.openNewList());
    });
    // Schnellerfassung von der Startseite (?neu=artikel): Fokus ins Feld „Artikel hinzufügen“, sobald die Liste da ist.
    const route = inject(ActivatedRoute);
    const router = inject(Router);
    const injector = inject(Injector);
    if (route.snapshot.queryParamMap.get('neu') === 'artikel') {
      const focusOnce = effect(() => {
        if (!this.data()) return;
        focusOnce.destroy();
        untracked(() => {
          void router.navigate([], { relativeTo: route, queryParams: { neu: null }, queryParamsHandling: 'merge', replaceUrl: true });
          afterNextRender(() => document.getElementById('new-item-name')?.focus(), { injector });
        });
      });
    }
    // Die Listen teilen sich mehrere Personen: kommt man in den Tab zurück
    // (Handy aus der Tasche), zeigt er, was andere inzwischen eingetragen
    // oder abgehakt haben. Echtzeit-Sync folgt später (siehe Konzept).
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !this.completeOpen() && !this.editing() && !this.listFormOpen()) this.load();
    };
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisible);
      this.settleTimers.forEach((timer) => clearTimeout(timer));
    });
  }

  protected load(): void {
    if (this.archived() === null) this.loadArchived();
    this.provider.getShoppingLists().subscribe({
      next: (lists) => {
        this.lists.set(lists);
        const current = lists.find((l) => l.id === this.currentId()) ?? lists[0];
        this.loadList(current?.id ?? null);
      },
      error: () => this.loadError.set(true),
    });
  }

  private loadList(id: Id | null): void {
    this.provider.getShopping(id).subscribe({
      next: (data) => {
        this.currentId.set(data.list.id);
        this.data.set(data);
        this.loadError.set(false);
      },
      error: () => this.loadError.set(true),
    });
  }

  protected selectList(list: ShoppingListDto): void {
    if (list.id === this.currentId()) return;
    this.actionError.set(null);
    this.collapsed.set(new Set());
    this.currentId.set(list.id);
    this.loadList(list.id);
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

  protected toggleGroup(key: SectionKey): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  protected onListMenu(key: string): void {
    if (key === 'mode') this.toggleMode();
    else if (key === 'edit') this.openEditList();
    else if (key === 'complete') this.openComplete();
    else if (key === 'archive') {
      const list = this.lists().find((l) => l.id === this.currentId());
      if (list) this.archive(list, true);
    }
  }

  protected onListCardMenu(list: ShoppingListDto, key: string): void {
    if (key === 'archive') this.archive(list, true);
    else this.openEditList(list);
  }

  protected toggleArchive(): void {
    const next = !this.archiveOpen();
    this.archiveOpen.set(next);
    if (next) this.loadArchived();
  }

  private loadArchived(): void {
    this.provider.getShoppingLists(true).subscribe({
      next: (lists) => this.archived.set(lists),
      error: () => this.actionError.set('Das Archiv konnte nicht geladen werden.'),
    });
  }

  /** Archivieren oder wiederherstellen. Die letzte aktive Liste bleibt immer aktiv. */
  protected archive(list: ShoppingListDto, archived: boolean): void {
    if (this.archiving()) return;
    if (archived && this.lists().length <= 1) {
      this.actionError.set('Die letzte aktive Einkaufsliste kann nicht archiviert werden.');
      return;
    }
    this.archiving.set(true);
    this.actionError.set(null);
    this.provider.updateShoppingList(list.id, { archived }).subscribe({
      next: () => {
        this.archiving.set(false);
        if (archived && this.currentId() === list.id) this.currentId.set(null);
        if (!archived) this.currentId.set(list.id);
        this.load();
        if (this.archiveOpen() || archived) this.loadArchived();
        this.saved.emit(archived ? `Liste „${list.name}“ archiviert.` : `Liste „${list.name}“ wiederhergestellt.`);
      },
      error: () => {
        this.archiving.set(false);
        this.actionError.set(archived ? 'Archivieren hat nicht geklappt.' : 'Wiederherstellen hat nicht geklappt.');
      },
    });
  }

  protected onGroupMenu(key: string, items: ShoppingItemDto[]): void {
    const target = key === 'check';
    for (const item of items.filter((i) => i.is_checked !== target)) this.toggle(item);
  }

  protected onItemMenu(item: ShoppingItemDto, key: string): void {
    if (key === 'edit') this.openEdit(item);
    else if (key === 'delete') this.removeItem(item);
  }

  protected inviteMember(): void {
    this.invite.open();
  }

  // ---------- Einträge ----------

  /** Auch per Enter direkt im Feld: der Knopf ist bei leerem Feld gesperrt, und nach schnellem Einfügen kann er beim
   * Drücken von Enter noch gesperrt sein — dann würde der Browser das Formular nicht abschicken. */
  protected submitNew(event: Event): void {
    event.preventDefault();
    const input = (event.target as HTMLElement).closest('form')?.querySelector<HTMLInputElement>('#new-item-name');
    const name = (input?.value ?? this.newName()).trim();
    if (!name || this.adding()) return;
    this.add(name, '', this.newSection() || null, () => {
      this.newName.set('');
      // Ausdrücklich leeren: hat Angular den getippten Wert nie gerendert, wäre „leer → leer“ keine Änderung.
      if (input) input.value = '';
    });
  }

  protected addSuggestion(suggestion: ItemSuggestionDto): void {
    this.add(suggestion.name, '', suggestion.section);
  }

  private add(name: string, quantity: string, section: SectionKey | null, done?: () => void): void {
    this.adding.set(true);
    this.actionError.set(null);
    this.provider.addItem(name, quantity, section, this.currentId()).subscribe({
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
        this.touchCurrent();
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
    if (this.shoppingMode()) this.setSettling(item.id, checked);
    this.patchLocal(item.id, { is_checked: checked });
    this.actionError.set(null);
    this.provider.updateItem(item.id, { is_checked: checked }).subscribe({
      next: (updated) => {
        this.patchLocal(item.id, updated);
        this.touchCurrent();
      },
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

  /** „Zuletzt bearbeitet“ sofort vorrücken — das Backend tut dasselbe (services.touch_list). */
  private touchCurrent(): void {
    const now = new Date().toISOString();
    this.data.update((data) => (data ? { ...data, list: { ...data.list, updated_at: now } } : data));
  }

  protected itemLabel(item: ShoppingItemDto): string {
    return item.quantity ? `${item.name}, ${item.quantity}` : item.name;
  }

  private removeItem(item: ShoppingItemDto): void {
    this.actionError.set(null);
    this.provider.deleteItem(item.id).subscribe({
      next: () => {
        this.data.update((data) => (data ? { ...data, items: data.items.filter((i) => i.id !== item.id) } : data));
        this.touchCurrent();
        this.saved.emit(`„${item.name}“ entfernt.`);
      },
      error: () => this.actionError.set(`„${item.name}“ konnte nicht entfernt werden.`),
    });
  }

  // ---------- Eintrag bearbeiten ----------

  protected setEditSection(value: string): void {
    this.editSection.set(value as SectionKey);
  }

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
    this.editError.set(null);
    this.editSaving.set(true);
    this.provider
      .updateItem(item.id, { name, quantity: this.editQuantity().trim(), section: this.editSection() })
      .subscribe({
        next: (updated) => {
          this.editSaving.set(false);
          this.patchLocal(item.id, updated);
          this.touchCurrent();
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
        this.touchCurrent();
        this.closeEdit();
        this.saved.emit(`„${item.name}“ entfernt.`);
      },
      error: () => {
        this.editSaving.set(false);
        this.editError.set('Entfernen hat nicht geklappt. Bitte noch einmal versuchen.');
      },
    });
  }

  // ---------- Liste anlegen / bearbeiten ----------

  protected openNewList(): void {
    this.listEditingId.set(null);
    this.listName.set('');
    this.listDescription.set('');
    this.listIconValue.set('wagen');
    this.listError.set(null);
    this.listFormOpen.set(true);
  }

  protected openEditList(list: ShoppingListDto | null = this.data()?.list ?? null): void {
    if (!list) return;
    this.listEditingId.set(list.id);
    this.listName.set(list.name);
    this.listDescription.set(list.description);
    this.listIconValue.set(list.icon);
    this.listError.set(null);
    this.listFormOpen.set(true);
  }

  protected saveList(): void {
    if (this.listSaving()) return;
    const name = this.listName().trim();
    if (!name) {
      this.listError.set('Bitte einen Namen für die Liste eingeben.');
      return;
    }
    const input = { name, description: this.listDescription().trim(), icon: this.listIconValue() };
    const id = this.listEditingId();
    this.listSaving.set(true);
    this.listError.set(null);
    const request = id === null ? this.provider.createShoppingList(input) : this.provider.updateShoppingList(id, input);
    request.subscribe({
      next: (list) => {
        this.listSaving.set(false);
        this.listFormOpen.set(false);
        this.currentId.set(list.id);
        this.load();
        this.saved.emit(id === null ? `Liste „${name}“ angelegt.` : `Liste „${name}“ gespeichert.`);
      },
      error: () => {
        this.listSaving.set(false);
        this.listError.set('Speichern hat nicht geklappt. Bitte noch einmal versuchen.');
      },
    });
  }

  protected deleteList(): void {
    const id = this.listEditingId();
    if (id === null || this.listSaving()) return;
    if (this.lists().length <= 1) {
      this.listError.set('Die letzte Einkaufsliste kann nicht gelöscht werden.');
      return;
    }
    const name = this.listName();
    this.listSaving.set(true);
    this.provider.deleteShoppingList(id).subscribe({
      next: () => {
        this.listSaving.set(false);
        this.listFormOpen.set(false);
        this.currentId.set(null);
        this.load();
        this.saved.emit(`Liste „${name}“ gelöscht.`);
      },
      error: () => {
        this.listSaving.set(false);
        this.listError.set('Löschen hat nicht geklappt. Bitte noch einmal versuchen.');
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
    this.provider.completeShopping(amount, this.currentId()).subscribe({
      next: (result) => {
        this.completeSubmitting.set(false);
        this.completeOpen.set(false);
        this.load();
        if (result.amount !== null) {
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
