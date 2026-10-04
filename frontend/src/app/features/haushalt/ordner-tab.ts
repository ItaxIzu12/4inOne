import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { AppDatePicker } from '../../shared/form/date-picker';
import { Field } from '../../shared/form/field';
import { AppSelect } from '../../shared/form/select';
import { ModalForm } from '../../shared/form/modal-form';
import { FolderEntryDto, FolderEntryInput, Id } from './haushalt-api.service';
import { HAUSHALT_DATA_PROVIDER } from './haushalt-data-provider';
import { RowMenu, RowMenuItem } from './row-menu';
import {
  CONTRACT_SORT_LABEL,
  CONTRACT_STATUS_OPTIONS,
  ContractFilter,
  ContractSort,
  contractState,
  contractStats,
  euro,
  filterContracts,
  formatDate,
  fromNow,
  monthly,
  noticeLabel,
  sortContracts,
} from './vertraege-logic';

type ContractTab = 'details' | 'notizen';
const CONTRACT_TABS: { key: ContractTab; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'notizen', label: 'Notizen' },
];
const CONTRACT_SORTS: ContractSort[] = ['frist', 'kosten', 'name'];

/**
 * Reiter „Verträge“ (interner Schlüssel weiter „ordner“): Kennzahlen (Anzahl,
 * Kosten pro Monat, Kündigung bald, ohne Frist), Liste mit Suche, Status und
 * Sortierung, daneben die Detailkarte des gewählten Vertrags — auf dem Handy
 * als Blatt von unten. Die Kündigungsfristen erscheinen automatisch unter
 * „Heute“; die monatlichen Kosten gehören dem Haushalt (ADR-001, keine
 * Verknüpfung zu den eingefrorenen Haushaltsfinanzen).
 *
 * Es werden ausschließlich Verträge gezeigt. Geräte bleiben im Datenmodell
 * (FolderEntry kind=geraet) unangetastet, haben aber keine Oberfläche mehr.
 *
 * Kind-Konten haben keinen Zugriff (Vertragskosten sind Finanzdaten), das
 * Backend antwortet mit 403 — hier als verständlicher Hinweis.
 */
@Component({
  selector: 'app-ordner-tab',
  standalone: true,
  imports: [ErrorNoticeDirective, DecimalPipe, AppIcon, AppSelect, Field, ModalForm, AppDatePicker, RowMenu],
  templateUrl: './ordner-tab.html',
  styleUrls: ['./haushalt-common.scss', './haushalt-stats.scss', './ordner-tab.scss'],
})
export class OrdnerTab {
  private readonly provider = inject(HAUSHALT_DATA_PROVIDER);
  readonly saved = output<string>();
  /** Steigt bei jedem „Neuer Vertrag“ im Seitenkopf; > 0 öffnet das Formular. */
  readonly newRequest = input(0);

  protected readonly entries = signal<FolderEntryDto[] | null>(null);
  protected readonly loadError = signal(false);
  protected readonly forbidden = signal(false);

  protected readonly contracts = computed(() => (this.entries() ?? []).filter((e) => e.kind === 'vertrag'));
  protected readonly stats = computed(() => contractStats(this.contracts()));

  // ---------- Liste ----------
  protected readonly query = signal('');
  protected readonly status = signal<ContractFilter>('');
  protected readonly sort = signal<ContractSort>('frist');
  protected readonly sortLabel = CONTRACT_SORT_LABEL;
  protected readonly statusOptions = CONTRACT_STATUS_OPTIONS;
  protected readonly visible = computed(() =>
    sortContracts(filterContracts(this.contracts(), this.query(), this.status()), this.sort()),
  );

  // ---------- Auswahl und Detail ----------
  protected readonly selectedId = signal<Id | null>(null);
  /** Handy: die Detailkarte ist ein Blatt, das erst nach Antippen erscheint. */
  protected readonly sheetOpen = signal(false);
  protected readonly selected = computed(() => {
    const list = this.visible();
    return list.find((c) => c.id === this.selectedId()) ?? list[0] ?? null;
  });
  protected readonly detailTab = signal<ContractTab>('details');
  protected readonly detailTabs = CONTRACT_TABS;

  // ---------- Darstellung ----------
  protected readonly contractState = contractState;
  protected readonly euro = euro;
  protected readonly monthly = monthly;
  protected readonly noticeLabel = noticeLabel;
  protected readonly formatDate = formatDate;
  protected readonly fromNow = fromNow;
  protected readonly rowMenu: RowMenuItem[] = [{ key: 'edit', label: 'Bearbeiten', icon: 'edit' }];

  // ---------- Formular ----------
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<Id | null>(null);
  protected readonly formName = signal('');
  protected readonly formProvider = signal('');
  protected readonly formNotes = signal('');
  protected readonly formCost = signal('');
  protected readonly formContractEnd = signal('');
  protected readonly formNotice = signal('');
  protected readonly formError = signal<string | null>(null);
  protected readonly formSaving = signal(false);

  constructor() {
    this.load();
    effect(() => {
      if (this.newRequest() > 0) untracked(() => this.openNew());
    });
  }

  protected load(): void {
    this.provider.getFolder().subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loadError.set(false);
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 403) this.forbidden.set(true);
        else this.loadError.set(true);
      },
    });
  }

  // ---------- Liste ----------

  protected showStatus(status: ContractFilter): void {
    this.query.set('');
    this.status.set(status);
  }

  protected toggleSort(): void {
    this.sort.set(CONTRACT_SORTS[(CONTRACT_SORTS.indexOf(this.sort()) + 1) % CONTRACT_SORTS.length]);
  }

  protected select(entry: FolderEntryDto): void {
    this.selectedId.set(entry.id);
    this.sheetOpen.set(true);
    // Handy: das Blatt erscheint unten — der Fokus folgt, sobald es gerendert ist.
    if (typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches) {
      setTimeout(() => document.querySelector<HTMLElement>('app-ordner-tab .detail.is-open .sheet-close')?.focus());
    }
  }

  protected onDetailKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const next = this.detailTab() === 'details' ? 'notizen' : 'details';
    this.detailTab.set(next);
    queueMicrotask(() => document.getElementById(`ct-${next}`)?.focus());
  }

  // ---------- Formular ----------

  protected openNew(): void {
    this.editingId.set(null);
    this.fillForm({
      kind: 'vertrag',
      name: '',
      provider: '',
      model: '',
      room: '',
      notes: '',
      monthly_cost: null,
      contract_end: null,
      notice_period_months: null,
      purchase_date: null,
      warranty_until: null,
      maintenance_interval_months: null,
      next_maintenance: null,
      last_maintenance: null,
    });
  }

  protected openEdit(entry: FolderEntryDto): void {
    this.editingId.set(entry.id);
    this.fillForm(entry);
  }

  private fillForm(entry: FolderEntryInput): void {
    this.formName.set(entry.name);
    this.formProvider.set(entry.provider);
    this.formNotes.set(entry.notes);
    this.formCost.set(entry.monthly_cost ? entry.monthly_cost.replace('.', ',') : '');
    this.formContractEnd.set(entry.contract_end ?? '');
    this.formNotice.set(entry.notice_period_months?.toString() ?? '');
    this.formError.set(null);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
  }

  /** "39,99" oder "39.99" → "39.99"; leer → null; ungültig → undefined. */
  private parseCost(value: string): string | null | undefined {
    const trimmed = value.trim().replace(/\s|€/g, '');
    if (!trimmed) return null;
    const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
    if (!/^\d{1,5}(\.\d{1,2})?$/.test(normalized)) return undefined;
    return Number(normalized).toFixed(2);
  }

  private optionalInt(value: string): number | null {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  protected submit(): void {
    if (this.formSaving()) return;
    const name = this.formName().trim();
    if (!name) {
      this.formError.set('Bitte einen Namen eingeben.');
      return;
    }
    const cost = this.parseCost(this.formCost());
    if (cost === undefined) {
      this.formError.set('Bitte die monatlichen Kosten als Betrag eingeben, z. B. 39,99.');
      return;
    }
    const input: FolderEntryInput = {
      kind: 'vertrag',
      name,
      provider: this.formProvider().trim(),
      model: '',
      room: '',
      notes: this.formNotes().trim(),
      monthly_cost: cost,
      contract_end: this.formContractEnd() || null,
      notice_period_months: this.optionalInt(this.formNotice()),
      purchase_date: null,
      warranty_until: null,
      maintenance_interval_months: null,
      next_maintenance: null,
      last_maintenance: null,
    };
    const id = this.editingId();
    this.formSaving.set(true);
    this.formError.set(null);
    const request = id === null ? this.provider.createFolderEntry(input) : this.provider.updateFolderEntry(id, input);
    request.subscribe({
      next: (stored) => {
        this.formSaving.set(false);
        this.formOpen.set(false);
        this.selectedId.set(stored.id);
        this.load();
        this.saved.emit(id === null ? `„${name}“ angelegt.` : `„${name}“ gespeichert.`);
      },
      error: (error: unknown) => {
        this.formSaving.set(false);
        this.formError.set(this.firstApiError(error) ?? 'Speichern hat nicht geklappt. Bitte Eingaben prüfen.');
      },
    });
  }

  /** Erste verständliche Fehlermeldung aus einer 400-Antwort (DRF liefert
   * sie pro Feld). */
  private firstApiError(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse) || error.status !== 400 || !error.error) return null;
    const body = error.error as Record<string, unknown>;
    for (const value of Object.values(body)) {
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
      if (typeof value === 'string') return value;
    }
    return null;
  }

  protected deleteEditing(): void {
    const id = this.editingId();
    if (id === null || this.formSaving()) return;
    this.formSaving.set(true);
    this.provider.deleteFolderEntry(id).subscribe({
      next: () => {
        this.formSaving.set(false);
        this.formOpen.set(false);
        this.entries.update((entries) => (entries ?? []).filter((e) => e.id !== id));
        this.sheetOpen.set(false);
        this.saved.emit('Vertrag gelöscht.');
      },
      error: () => {
        this.formSaving.set(false);
        this.formError.set('Löschen hat nicht geklappt. Bitte noch einmal versuchen.');
      },
    });
  }
}
