import { AutoLinks } from '../../shared/connections/auto-links';
import { contractFinance, contractReminder, deviceMaintenance } from '../../shared/connections/auto-link-rules';
import { HouseholdPeople } from './household-people.service';
import { ScopeNote } from '../../shared/scope-note/scope-note';
import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { lockScrollWhile } from '../../shared/scroll-lock/scroll-lock';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { map, of, switchMap } from 'rxjs';
import { AttachmentField, AttachmentItem } from '../../shared/attachments/attachment-field';
import { ActivatedRoute, Router } from '@angular/router';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { ConnectionsSection } from '../../shared/connections/connections-section';
import { MONTH_ABBR } from '../../shared/form/date-utils';
import { NextDeadline, devicesByRoom, nextDeadlines } from './zuhause-logic';
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
import { addMonthsIso } from './haushalt-logic';
import { RowMenu, RowMenuItem } from './row-menu';
import { normalizeMoneyInput } from '../../shared/currency/money-input';
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
  leadLabel,
  moneyLabel,
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

const LEAD_OPTIONS: SelectOption[] = [
  { value: '14', label: '14 Tage vorher' },
  { value: '7', label: '7 Tage vorher' },
  { value: '30', label: '30 Tage vorher' },
  { value: '0', label: 'Nur am Fristtag' },
];

const NOTICE_UNIT_OPTIONS: SelectOption[] = [
  { value: 'MONTHS', label: 'Monate' },
  { value: 'DAYS', label: 'Tage' },
];

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
  imports: [ErrorNoticeDirective, DecimalPipe, AppIcon, AppSelect, Field, ModalForm, AppDatePicker, RowMenu, ConnectionsSection, AttachmentField, ScopeNote, AutoLinks],
  templateUrl: './ordner-tab.html',
  styleUrls: ['./haushalt-common.scss', './haushalt-stats.scss', './ordner-tab.scss', './zuhause-tab.scss'],
})
export class OrdnerTab {
  private readonly provider = inject(HAUSHALT_DATA_PROVIDER);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
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

  // ---------- Als Nächstes und Räume (31.10.2026) ----------
  /** Die nächsten Fristen dieses Bereichs (Wartung, Garantie, Kündigung) als Zeitleiste über der Liste. */
  protected readonly nextUp = computed(() => nextDeadlines(this.isContracts() ? this.contracts() : this.devices()));
  protected readonly dayNum = (iso: string) => String(Number(iso.slice(8, 10)));
  protected readonly monthAbbr = (iso: string) => MONTH_ABBR[Number(iso.slice(5, 7)) - 1];
  protected readonly nextIcon = (n: NextDeadline): IconName => (n.entry.kind === 'vertrag' ? 'finance' : deviceIcon(n.entry));
  /** Geräte nach Raum gruppiert, sobald sie in mindestens zwei Räumen stehen; Verträge bleiben eine Liste. */
  protected readonly listGroups = computed(() => {
    const rows = this.visible();
    if (!rows.length) return [];
    if (this.isContracts()) return [{ key: 'all', label: '', icon: undefined as IconName | undefined, items: rows }];
    const groups = devicesByRoom(rows);
    return groups.length > 1 ? groups : [{ key: 'all', label: '', icon: undefined as IconName | undefined, items: rows }];
  });

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
  protected readonly leadLabel = leadLabel;
  protected readonly moneyLabel = moneyLabel;
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
  /** Betrag eines fremden Vertrags: im Formular nicht zeigen und nicht mitsenden (das Backend ignoriert ihn ohnehin). */
  protected readonly formCostHidden = signal(false);
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
  /** Einheit der Kündigungsfrist: Monate kalendarisch („1 Monat zum Vertragsende“) oder Tage. */
  protected readonly formNoticeUnit = signal<'DAYS' | 'MONTHS'>('MONTHS');
  protected readonly noticeUnitOptions = NOTICE_UNIT_OPTIONS;
  protected readonly formAutoRenewal = signal(false);
  protected readonly formContractNumber = signal('');
  protected readonly formModel = signal('');
  protected readonly formPurchase = signal('');
  protected readonly formWarranty = signal('');
  protected readonly formMaintenance = signal('');
  protected readonly formInterval = signal('');
  /** Letzte Wartung: mit Intervall ergibt sie „Nächste Wartung“ (wie „Wartung erledigt“). */
  protected readonly formLastMaintenance = signal('');
  protected readonly formSerial = signal('');
  /** Kündigungshinweis vorab (Tage; '0' = nur am Fristtag). */
  protected readonly formLead = signal('14');
  protected readonly leadOptions = LEAD_OPTIONS;
  /** Angekündigte Preisänderung: neuer Preis ab Datum. */
  protected readonly formNextCost = signal('');
  protected readonly formNextFrom = signal('');
  protected readonly formError = signal<string | null>(null);
  protected readonly formSaving = signal(false);
  protected readonly formStatusOptions = computed(() => (this.formKind() === 'vertrag' ? CONTRACT_STATUS_FORM : DEVICE_STATUS_FORM));
  /** Vorschau des letzten Kündigungstags im Formular. */
  protected readonly formDeadline = computed(() =>
    cancellationDeadline(this.formEnd() || null, ...this.noticeFields()),
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
    // Vertrags- bzw. Seriennummer nur für den gewählten Eintrag nachladen (nie in der Liste).
    effect(() => {
      const entry = this.selected();
      if (!entry) return;
      const id = entry.id;
      untracked(() => {
        if (this.contractNumber()?.id === id) return;
        this.provider.getFolderEntry(id).subscribe({
          next: (detail) => this.contractNumber.set({ id, value: detail.contract_number ?? detail.serial_number ?? '' }),
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
        this.openEntryFromQuery(entries);
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 403) this.forbidden.set(true);
        else this.loadError.set(true);
      },
    });
  }

  /** Deep-Link (?entry=<id>) aus „Verknüpft mit“: wählt Gerät bzw. Vertrag aus und zeigt das Detail. */
  private openEntryFromQuery(entries: FolderEntryDto[]): void {
    const id = Number(this.route.snapshot.queryParamMap.get('entry'));
    if (!id) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { entry: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    const found = entries.find((e) => e.id === id);
    if (!found) return;
    this.selectSection(found.kind === 'vertrag' ? 'vertraege' : 'geraete');
    this.select(found);
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

  /** Wer den Eintrag sieht (Kind-Konten nicht), bei Verträgen: Beträge bleiben privat. */
  private readonly people = inject(HouseholdPeople, { optional: true });
  protected readonly folderAudience = computed(() => {
    const base = this.people?.audience(true) || 'Alle Erwachsenen im Haushalt sehen diesen Eintrag.';
    return this.formKind() === 'vertrag' && !this.formCostHidden() ? `${base} Den Betrag siehst nur du.` : base;
  });

  // Connection Engine V2 (01.11.2026): Vorschau aus den aktuellen Formularwerten — zeigt vor dem Speichern, was wo erscheint
  private readonly autoLinkBox = viewChild(AutoLinks);
  protected readonly autoPreviews = computed(() => {
    if (this.formKind() === 'geraet') {
      return { DEVICE_MAINTENANCE: deviceMaintenance(this.formName().trim(), this.formMaintenance() || null, this.formStatus()) };
    }
    const facts = {
      name: this.formName().trim(),
      cost: this.formCostHidden() ? null : normalizeMoneyInput(this.formCost()) || null,
      billing_cycle: this.formBilling(),
      start_date: this.formStart() || null,
      end_date: this.formEnd() || null,
      ...this.noticeInput(),
      status: this.formStatus(),
      cost_visible: !this.formCostHidden(),
      next_cost: normalizeMoneyInput(this.formNextCost()) || null,
      next_cost_from: this.formNextFrom() || null,
      reminder_lead_days: Number(this.formLead()),
    };
    return { CONTRACT_FINANCE: contractFinance(facts), CONTRACT_REMINDER: contractReminder(facts) };
  });

  // Fotos & PDF (31.10.2026): beim Anlegen und Bearbeiten; wirkt beim Speichern
  protected readonly formAttachments = signal<AttachmentItem[]>([]);
  private readonly attachmentBox = viewChild(AttachmentField);
  protected readonly loadFile = (fileId: number) => this.provider.folderFileBlob(this.editingId()!, fileId);

  protected openNew(): void {
    this.editingId.set(null);
    this.formAttachments.set([]);
    this.attachmentBox()?.reset();
    this.autoLinkBox()?.reset();
    this.formCostHidden.set(false);
    this.fillForm({ kind: this.kind(), name: '', ...EMPTY_ENTRY });
  }

  protected openEdit(entry: FolderEntryDto): void {
    this.editingId.set(entry.id);
    this.formAttachments.set(entry.attachments ?? []);
    this.attachmentBox()?.reset();
    this.autoLinkBox()?.reset();
    this.formCostHidden.set(entry.cost_visible === false);
    const number = this.contractNumber()?.id === entry.id ? this.contractNumber()!.value : '';
    this.fillForm(entry.kind === 'vertrag' ? { ...entry, contract_number: number } : { ...entry, contract_number: '', serial_number: number });
    if (entry.kind === 'vertrag' && this.contractNumber()?.id !== entry.id) {
      // Vertragsnummer aus der Detailantwort nachtragen.
      this.provider.getFolderEntry(entry.id).subscribe({
        next: (detail) => this.formContractNumber.set(detail.contract_number ?? ''),
        error: () => undefined,
      });
    }
    if (entry.kind === 'geraet' && this.contractNumber()?.id !== entry.id) {
      // Seriennummer steht wie die Vertragsnummer nur in der Detailantwort.
      this.provider.getFolderEntry(entry.id).subscribe({
        next: (detail) => this.formSerial.set(detail.serial_number ?? ''),
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
    this.formNotice.set((entry.notice_period_months ?? entry.notice_period_days)?.toString() ?? '');
    this.formNoticeUnit.set(entry.notice_period_months || !entry.notice_period_days ? 'MONTHS' : 'DAYS');
    this.formAutoRenewal.set(!!entry.auto_renewal);
    this.formContractNumber.set(entry.contract_number ?? '');
    this.formModel.set(entry.model ?? '');
    this.formPurchase.set(entry.purchase_date ?? '');
    this.formWarranty.set(entry.warranty_end_date ?? '');
    this.formMaintenance.set(entry.maintenance_due_date ?? '');
    this.formInterval.set(entry.maintenance_interval_months?.toString() ?? '');
    this.formLastMaintenance.set(entry.last_maintenance ?? '');
    this.formSerial.set(entry.serial_number ?? '');
    this.formLead.set(String(entry.reminder_lead_days ?? 14));
    this.formNextCost.set(entry.next_cost ? entry.next_cost.replace('.', ',') : '');
    this.formNextFrom.set(entry.next_cost_from ?? '');
    this.formError.set(null);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
  }

  /** "39,99" oder "39.99" → "39.99"; leer → null; ungültig oder 0 → undefined. */
  private parseCost(value: string): string | null | undefined {
    if (!value.trim()) return null;
    const normalized = normalizeMoneyInput(value) ?? 'x';
    if (!/^\d{1,5}(\.\d{1,2})?$/.test(normalized) || Number(normalized) <= 0) return undefined;
    return Number(normalized).toFixed(2);
  }

  /** [Tage, Monate] aus Zahl und Einheit — gesetzt ist höchstens eins von beiden. */
  private noticeFields(): [number | null, number | null] {
    const value = this.optionalInt(this.formNotice(), this.formNoticeUnit() === 'DAYS');
    return this.formNoticeUnit() === 'MONTHS' ? [null, value] : [value, null];
  }

  private noticeInput(): { notice_period_days: number | null; notice_period_months: number | null } {
    const [days, months] = this.noticeFields();
    return { notice_period_days: days, notice_period_months: months };
  }

  /** Letzte Wartung oder Intervall geändert → nächste Wartung = letzte + Intervall (bleibt danach von Hand änderbar). */
  protected setMaintenanceBasis(last: string, interval: string): void {
    this.formLastMaintenance.set(last);
    this.formInterval.set(interval);
    const months = this.optionalInt(interval);
    if (last && months && months <= 120) this.formMaintenance.set(addMonthsIso(last, months));
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
    const cost = isContract && !this.formCostHidden() ? this.parseCost(this.formCost()) : null;
    if (cost === undefined) {
      this.formError.set('Bitte die Kosten als Betrag größer als 0 eingeben, z. B. 39,99.');
      return;
    }
    const notice = this.formNotice().trim();
    if (isContract && notice && this.formNoticeUnit() === 'DAYS' && !(/^\d+$/.test(notice) && Number(notice) <= 1095)) {
      this.formError.set('Die Kündigungsfrist bitte in ganzen Tagen angeben (0 bis 1095).');
      return;
    }
    if (isContract && notice && this.formNoticeUnit() === 'MONTHS' && !(this.optionalInt(notice) && Number(notice) <= 36)) {
      this.formError.set('Die Kündigungsfrist bitte in ganzen Monaten angeben (1 bis 36).');
      return;
    }
    const nextCost = isContract && !this.formCostHidden() ? this.parseCost(this.formNextCost()) : null;
    if (nextCost === undefined) {
      this.formError.set('Bitte den neuen Preis als Betrag größer als 0 eingeben, z. B. 34,99.');
      return;
    }
    if (isContract && !this.formCostHidden() && !nextCost !== !this.formNextFrom()) {
      this.formError.set('Für eine Preisänderung bitte neuen Preis und „gilt ab“ zusammen angeben.');
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
      ...(isContract && notice ? this.noticeInput() : { notice_period_days: null, notice_period_months: null }),
      auto_renewal: isContract && this.formAutoRenewal(),
      contract_number: isContract ? this.formContractNumber().trim() : '',
      reminder_lead_days: Number(this.formLead()),
      next_cost: isContract ? nextCost : null,
      next_cost_from: isContract && nextCost ? this.formNextFrom() : null,
      serial_number: isContract ? '' : this.formSerial().trim(),
      purchase_date: isContract ? null : this.formPurchase() || null,
      warranty_end_date: isContract ? null : this.formWarranty() || null,
      maintenance_interval_months: isContract ? null : this.optionalInt(interval),
      maintenance_due_date: isContract ? null : this.formMaintenance() || null,
      last_maintenance: isContract ? null : this.formLastMaintenance() || null,
      model: isContract ? '' : this.formModel().trim(),
      room: '',
    };
    if (this.formCostHidden()) {
      delete input.cost;
      delete input.next_cost;
      delete input.next_cost_from;
    }
    const id = this.editingId();
    if (id !== null) {
      // Beim Bearbeiten den Raum nicht überschreiben.
      const current = (this.entries() ?? []).find((e) => e.id === id);
      input.room = current?.room ?? '';
    }
    this.formSaving.set(true);
    this.formError.set(null);
    const request = id === null ? this.provider.createFolderEntry(input) : this.provider.updateFolderEntry(id, input);
    let saved: FolderEntryDto | null = null;
    request
      .pipe(
        // Dateien erst nach dem Eintrag: ein neues Gerät braucht zuerst seine ID
        switchMap((stored) => {
          saved = stored;
          this.editingId.set(stored.id); // erneuter Versuch ändert denselben Eintrag statt einen zweiten anzulegen
          const box = this.attachmentBox();
          const links = this.autoLinkBox();
          return (box
            ? box.commit((file) => this.provider.uploadFolderFile(stored.id, file), (fileId) => this.provider.removeFolderFile(stored.id, fileId))
            : of(undefined)
          ).pipe(
            switchMap(() => (links ? links.commit(stored.id) : of(undefined))),
            map(() => stored),
          );
        }),
      )
      .subscribe({
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
        if (saved) {
          // Eintrag gespeichert, eine Datei nicht: Dialog bleibt offen, Kacheln zeigen den echten Stand
          const stored: FolderEntryDto = saved;
          const reason = this.firstApiError(error) ?? (error instanceof Error ? error.message : '');
          this.formError.set(`Gespeichert, aber eine Datei konnte nicht hochgeladen werden.${reason ? ' ' + reason : ''} Du kannst es noch einmal versuchen.`);
          this.provider.getFolderEntry(stored.id).subscribe({ next: (fresh) => this.formAttachments.set(fresh.attachments ?? []), error: () => undefined });
          this.load();
          return;
        }
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
  notice_period_months: null,
  auto_renewal: false,
  reminder_lead_days: 14,
  next_cost: null,
  next_cost_from: null,
  serial_number: '',
  contract_number: '',
  purchase_date: null,
  warranty_end_date: null,
  maintenance_interval_months: null,
  maintenance_due_date: null,
  last_maintenance: null,
  model: '',
  room: '',
};
