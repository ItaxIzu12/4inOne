import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { lockScrollWhile } from '../../shared/scroll-lock/scroll-lock';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { AppDatePicker } from '../../shared/form/date-picker';
import { Field } from '../../shared/form/field';
import { AppSelect, SelectOption } from '../../shared/form/select';
import { ModalForm } from '../../shared/form/modal-form';
import { BillingCycle, FolderEntryDto, FolderEntryInput, FolderKind, Id } from './haushalt-api.service';
import {
  DEVICE_STATUS_OPTIONS,
  DeviceFilter,
  deadlineSoon,
  deviceIcon,
  deviceState,
  deviceStats,
  filterDevices,
  nextDeviceDeadline,
} from './geraete-logic';
import { HAUSHALT_DATA_PROVIDER } from './haushalt-data-provider';
import { RowMenu, RowMenuItem } from './row-menu';
import {
  BILLING_LABEL,
  CONTRACT_SORT_LABEL,
  CONTRACT_STATUS_OPTIONS,
  ContractFilter,
  ContractSort,
  UPCOMING_DAYS,
  cancellationDeadline,
  contractState,
  contractStats,
  costLabel,
  euro,
  filterContracts,
  formatDate,
  fromNow,
  monthly,
  noticeLabel,
  sortContracts,
} from './vertraege-logic';

type DetailTab = 'details' | 'notizen';
const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'notizen', label: 'Notizen' },
];
const CONTRACT_SORTS: ContractSort[] = ['frist', 'kosten', 'name'];

/** Bereich in „Zuhause“: Geräte oder Verträge. */
export type ZuhauseSection = 'geraete' | 'vertraege';

const BILLING_OPTIONS: SelectOption[] = (Object.keys(BILLING_LABEL) as BillingCycle[]).map((value) => ({
  value,
  label: BILLING_LABEL[value],
}));
const CONTRACT_STATUS_FORM: SelectOption[] = [
  { value: 'ACTIVE', label: 'Aktiv' },
  { value: 'CANCELLED', label: 'Gekündigt' },
  { value: 'ENDED', label: 'Beendet' },
];
const DEVICE_STATUS_FORM: SelectOption[] = [
  { value: 'ACTIVE', label: 'Aktiv' },
  { value: 'REPAIR', label: 'In Reparatur' },
  { value: 'RETIRED', label: 'Außer Betrieb' },
];

/**
 * Reiter „Zuhause“ (interner Komponentenname weiter „ordner“): Geräte und
 * Verträge des Haushalts — beide sind FolderEntry (kind geraet/vertrag) mit
 * derselben Liste, Detailkarte (Handy: Blatt von unten) und demselben
 * Formular. Fristen (Wartung, Garantieende, Kündigungstag) erscheinen unter
 * „Heute → Demnächst“ (30 Tage). Vertragskosten gehören dem Haushalt und
 * werden nicht in Finanzen übertragen; die Vertragsnummer ist sensibel und
 * wird nur für die Detailkarte nachgeladen.
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
  /** Steigt bei jedem „Gerät/Vertrag hinzufügen“ im Seitenkopf; > 0 öffnet das Formular. */
  readonly newRequest = input(0);
  /** Geräte oder Verträge — vom Seitenkopf gesteuert (Hauptaktion passt sich an). */
  readonly section = model<ZuhauseSection>('geraete');

  protected readonly entries = signal<FolderEntryDto[] | null>(null);
  protected readonly loadError = signal(false);
  protected readonly forbidden = signal(false);

  protected readonly isContracts = computed(() => this.section() === 'vertraege');
  protected readonly kind = computed<FolderKind>(() => (this.isContracts() ? 'vertrag' : 'geraet'));
  protected readonly contracts = computed(() => (this.entries() ?? []).filter((e) => e.kind === 'vertrag'));
  protected readonly devices = computed(() => (this.entries() ?? []).filter((e) => e.kind === 'geraet'));
  protected readonly stats = computed(() => contractStats(this.contracts()));
  protected readonly dStats = computed(() => deviceStats(this.devices()));

  // ---------- Liste ----------
  protected readonly query = signal('');
  protected readonly status = signal<string>('');
  protected readonly sort = signal<ContractSort>('frist');
  protected readonly sortLabel = CONTRACT_SORT_LABEL;
  protected readonly statusOptions = computed(() => (this.isContracts() ? CONTRACT_STATUS_OPTIONS : DEVICE_STATUS_OPTIONS));
  protected readonly visible = computed(() =>
    this.isContracts()
      ? sortContracts(filterContracts(this.contracts(), this.query(), this.status() as ContractFilter), this.sort())
      : filterDevices(this.devices(), this.query(), this.status() as DeviceFilter),
  );

  // ---------- Auswahl und Detail ----------
  protected readonly selectedId = signal<Id | null>(null);
  /** Handy: die Detailkarte ist ein Blatt, das erst nach Antippen erscheint. */
  protected readonly sheetOpen = signal(false);
  /** Am Handy liegt das Blatt über der Seite: so lange scrollt nur das Blatt. */
  private readonly sheetScrollLock = lockScrollWhile(() => this.sheetOpen(), true);
  protected readonly selected = computed(() => {
    const list = this.visible();
    return list.find((c) => c.id === this.selectedId()) ?? list[0] ?? null;
  });
  /** Vertragsnummer kommt nur aus der Detailantwort. */
  protected readonly contractNumber = signal<{ id: Id; value: string } | null>(null);
  protected readonly detailTab = signal<DetailTab>('details');
  protected readonly detailTabs = DETAIL_TABS;
  protected readonly busy = signal(false);

  // ---------- Darstellung ----------
  protected readonly contractState = contractState;
  protected readonly deviceState = deviceState;
  protected readonly deviceIcon = deviceIcon;
  protected readonly nextDeviceDeadline = nextDeviceDeadline;
  protected readonly deadlineSoon = deadlineSoon;
  protected readonly costLabel = costLabel;
  protected readonly billingLabel = BILLING_LABEL;
  protected readonly euro = euro;
  protected readonly monthly = monthly;
  protected readonly noticeLabel = noticeLabel;
  protected readonly formatDate = formatDate;
  protected readonly fromNow = fromNow;
  protected readonly rowMenu: RowMenuItem[] = [{ key: 'edit', label: 'Bearbeiten', icon: 'edit' }];
  protected readonly billingOptions = BILLING_OPTIONS;
  protected readonly upcomingDays = UPCOMING_DAYS;

  // ---------- Formular ----------
  protected readonly formOpen = signal(false);
  protected readonly formKind = signal<FolderKind>('geraet');
  protected readonly editingId = signal<Id | null>(null);
  protected readonly formName = signal('');
  protected readonly formProvider = signal('');
  protected readonly formCategory = signal('');
  protected readonly formStatus = signal<FolderEntryDto['status']>('ACTIVE');
  protected readonly formNotes = signal('');
  protected readonly formCost = signal('');
  protected readonly formBilling = signal<BillingCycle>('MONTHLY');
  protected readonly formStart = signal('');
  protected readonly formEnd = signal('');
  protected readonly formNotice = signal('');
  protected readonly formAutoRenewal = signal(false);
  protected readonly formContractNumber = signal('');
  protected readonly formModel = signal('');
  protected readonly formPurchase = signal('');
  protected readonly formWarranty = signal('');
  protected readonly formMaintenance = signal('');
  protected readonly formInterval = signal('');
  protected readonly formError = signal<string | null>(null);
  protected readonly formSaving = signal(false);
  protected readonly formStatusOptions = computed(() => (this.formKind() === 'vertrag' ? CONTRACT_STATUS_FORM : DEVICE_STATUS_FORM));
  /** Vorschau des letzten Kündigungstags im Formular. */
  protected readonly formDeadline = computed(() =>
    cancellationDeadline(this.formEnd() || null, this.optionalInt(this.formNotice(), true)),
  );
  private lastRequest = 0;

  constructor() {
    this.load();
    effect(() => {
      const request = this.newRequest();
      if (request > this.lastRequest) {
        this.lastRequest = request;
        untracked(() => this.openNew());
      }
    });
    // Vertragsnummer nur für den gewählten Vertrag nachladen (nie in der Liste).
    effect(() => {
      const entry = this.selected();
      if (!entry || entry.kind !== 'vertrag') return;
      const id = entry.id;
      untracked(() => {
        if (this.contractNumber()?.id === id) return;
        this.provider.getFolderEntry(id).subscribe({
          next: (detail) => this.contractNumber.set({ id, value: detail.contract_number ?? '' }),
          error: () => this.contractNumber.set({ id, value: '' }),
        });
      });
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

  // ---------- Bereich und Liste ----------

  protected selectSection(section: ZuhauseSection): void {
    if (section === this.section()) return;
    this.section.set(section);
    this.query.set('');
    this.status.set('');
    this.selectedId.set(null);
    this.sheetOpen.set(false);
    this.detailTab.set('details');
  }

  protected showStatus(status: string): void {
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

  // ---------- Schnellaktionen ----------

  /** Status setzen: gekündigt, in Reparatur, außer Betrieb, wieder aktiv. */
  protected setStatus(entry: FolderEntryDto, status: FolderEntryDto['status'], message: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.provider.updateFolderStatus(entry.id, status).subscribe({
      next: (stored) => {
        this.busy.set(false);
        this.entries.update((rows) => (rows ?? []).map((row) => (row.id === stored.id ? stored : row)));
        this.saved.emit(message);
      },
      error: () => {
        this.busy.set(false);
        this.saved.emit(`„${entry.name}“ konnte nicht geändert werden. Bitte noch einmal versuchen.`);
      },
    });
  }

  protected maintenanceDone(entry: FolderEntryDto): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.provider.completeMaintenance(entry.id).subscribe({
      next: (stored) => {
        this.busy.set(false);
        this.entries.update((rows) => (rows ?? []).map((row) => (row.id === stored.id ? stored : row)));
        this.saved.emit(
          stored.maintenance_due_date
            ? `Wartung erledigt · nächste am ${formatDate(stored.maintenance_due_date)}.`
            : 'Wartung erledigt.',
        );
      },
      error: () => {
        this.busy.set(false);
        this.saved.emit('Die Wartung konnte nicht gespeichert werden. Bitte noch einmal versuchen.');
      },
    });
  }

  // ---------- Formular ----------

  protected openNew(): void {
    this.editingId.set(null);
    this.fillForm({ kind: this.kind(), name: '', ...EMPTY_ENTRY });
  }

  protected openEdit(entry: FolderEntryDto): void {
    this.editingId.set(entry.id);
    const number = this.contractNumber()?.id === entry.id ? this.contractNumber()!.value : '';
    this.fillForm({ ...entry, contract_number: number });
    if (entry.kind === 'vertrag' && this.contractNumber()?.id !== entry.id) {
      // Vertragsnummer aus der Detailantwort nachtragen.
      this.provider.getFolderEntry(entry.id).subscribe({
        next: (detail) => this.formContractNumber.set(detail.contract_number ?? ''),
        error: () => undefined,
      });
    }
  }

  private fillForm(entry: FolderEntryInput): void {
    this.formKind.set(entry.kind);
    this.formName.set(entry.name);
    this.formProvider.set(entry.provider);
    this.formCategory.set(entry.category ?? '');
    this.formStatus.set(entry.status ?? 'ACTIVE');
    this.formNotes.set(entry.notes);
    this.formCost.set(entry.cost ? entry.cost.replace('.', ',') : '');
    this.formBilling.set(entry.billing_cycle ?? 'MONTHLY');
    this.formStart.set(entry.start_date ?? '');
    this.formEnd.set(entry.end_date ?? '');
    this.formNotice.set(entry.notice_period_days?.toString() ?? '');
    this.formAutoRenewal.set(!!entry.auto_renewal);
    this.formContractNumber.set(entry.contract_number ?? '');
    this.formModel.set(entry.model ?? '');
    this.formPurchase.set(entry.purchase_date ?? '');
    this.formWarranty.set(entry.warranty_end_date ?? '');
    this.formMaintenance.set(entry.maintenance_due_date ?? '');
    this.formInterval.set(entry.maintenance_interval_months?.toString() ?? '');
    this.formError.set(null);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
  }

  /** "39,99" oder "39.99" → "39.99"; leer → null; ungültig oder 0 → undefined. */
  private parseCost(value: string): string | null | undefined {
    const trimmed = value.trim().replace(/\s|€/g, '');
    if (!trimmed) return null;
    const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
    if (!/^\d{1,5}(\.\d{1,2})?$/.test(normalized) || Number(normalized) <= 0) return undefined;
    return Number(normalized).toFixed(2);
  }

  /** Ganze Zahl ≥ 1 (oder ≥ 0 mit allowZero); leer oder ungültig → null. */
  private optionalInt(value: string, allowZero = false): number | null {
    if (!/^\d+$/.test(value.trim())) return null;
    const parsed = Number(value.trim());
    return parsed > 0 || (allowZero && parsed === 0) ? parsed : null;
  }

  protected submit(): void {
    if (this.formSaving()) return;
    const name = this.formName().trim();
    const kind = this.formKind();
    const isContract = kind === 'vertrag';
    if (!name) {
      this.formError.set('Bitte einen Namen eingeben.');
      return;
    }
    const cost = isContract ? this.parseCost(this.formCost()) : null;
    if (cost === undefined) {
      this.formError.set('Bitte die Kosten als Betrag größer als 0 eingeben, z. B. 39,99.');
      return;
    }
    const notice = this.formNotice().trim();
    if (isContract && notice && !/^\d+$/.test(notice)) {
      this.formError.set('Die Kündigungsfrist bitte in ganzen Tagen angeben (0 oder mehr).');
      return;
    }
    if (isContract && this.formStart() && this.formEnd() && this.formEnd() < this.formStart()) {
      this.formError.set('Das Vertragsende darf nicht vor dem Beginn liegen.');
      return;
    }
    const interval = this.formInterval().trim();
    if (!isContract && interval && !(this.optionalInt(interval) && Number(interval) <= 120)) {
      this.formError.set('Das Wartungsintervall bitte in Monaten angeben (1 bis 120).');
      return;
    }
    const input: FolderEntryInput = {
      kind,
      name,
      provider: this.formProvider().trim(),
      category: this.formCategory().trim(),
      status: this.formStatus(),
      notes: this.formNotes().trim(),
      cost,
      billing_cycle: this.formBilling(),
      start_date: isContract ? this.formStart() || null : null,
      end_date: isContract ? this.formEnd() || null : null,
      notice_period_days: isContract && notice ? Number(notice) : null,
      auto_renewal: isContract && this.formAutoRenewal(),
      contract_number: isContract ? this.formContractNumber().trim() : '',
      purchase_date: isContract ? null : this.formPurchase() || null,
      warranty_end_date: isContract ? null : this.formWarranty() || null,
      maintenance_interval_months: isContract ? null : this.optionalInt(interval),
      maintenance_due_date: isContract ? null : this.formMaintenance() || null,
      last_maintenance: null,
      model: isContract ? '' : this.formModel().trim(),
      room: '',
    };
    const id = this.editingId();
    if (id !== null) {
      // Beim Bearbeiten Raum und letzte Wartung nicht überschreiben.
      const current = (this.entries() ?? []).find((e) => e.id === id);
      input.room = current?.room ?? '';
      input.last_maintenance = current?.last_maintenance ?? null;
    }
    this.formSaving.set(true);
    this.formError.set(null);
    const request = id === null ? this.provider.createFolderEntry(input) : this.provider.updateFolderEntry(id, input);
    request.subscribe({
      next: (stored) => {
        this.formSaving.set(false);
        this.formOpen.set(false);
        this.selectedId.set(stored.id);
        if (stored.kind === 'vertrag') this.contractNumber.set({ id: stored.id, value: stored.contract_number ?? '' });
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
    const isContract = this.formKind() === 'vertrag';
    this.formSaving.set(true);
    this.provider.deleteFolderEntry(id).subscribe({
      next: () => {
        this.formSaving.set(false);
        this.formOpen.set(false);
        this.entries.update((entries) => (entries ?? []).filter((e) => e.id !== id));
        this.sheetOpen.set(false);
        this.saved.emit(isContract ? 'Vertrag gelöscht.' : 'Gerät gelöscht.');
      },
      error: () => {
        this.formSaving.set(false);
        this.formError.set('Löschen hat nicht geklappt. Bitte noch einmal versuchen.');
      },
    });
  }
}

const EMPTY_ENTRY: Omit<FolderEntryInput, 'kind' | 'name'> = {
  provider: '',
  category: '',
  status: 'ACTIVE',
  notes: '',
  cost: null,
  billing_cycle: 'MONTHLY',
  start_date: null,
  end_date: null,
  notice_period_days: null,
  auto_renewal: false,
  contract_number: '',
  purchase_date: null,
  warranty_end_date: null,
  maintenance_interval_months: null,
  maintenance_due_date: null,
  last_maintenance: null,
  model: '',
  room: '',
};
