import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, output, signal } from '@angular/core';
import { Modal } from '../../shared/modal/modal';
import {
  DeadlineDto,
  DeductionOptionDto,
  FolderEntryDto,
  FolderEntryInput,
  FolderKind,
  Id,
} from './haushalt-api.service';
import { HAUSHALT_DATA_PROVIDER } from './haushalt-data-provider';
import { daysUntil, relativeDay } from './haushalt-logic';

// Fristen, die in diesem Zeitraum liegen, stehen oben unter "Demnächst".
const UPCOMING_DAYS = 90;

interface UpcomingDeadline extends DeadlineDto {
  entry: FolderEntryDto;
  days: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

/**
 * Haushaltsordner: Verträge (mit Kündigungsfrist) und Geräte (Garantie,
 * Wartung). Alle Fristen landen automatisch als ganztägige Termine im
 * gemeinsamen Kalender; die Kosten eines Vertrags kommen aus dem
 * verknüpften festen Abzug in Finanzen — eine Zahl, eine Quelle.
 *
 * Kind-Konten haben keinen Zugriff (Vertragskosten sind Finanzdaten), das
 * Backend antwortet mit 403 — hier als verständlicher Hinweis statt als
 * Ladefehler.
 */
@Component({
  selector: 'app-ordner-tab',
  standalone: true,
  imports: [DecimalPipe, Modal],
  templateUrl: './ordner-tab.html',
  styleUrls: ['./haushalt-common.scss', './ordner-tab.scss'],
})
export class OrdnerTab {
  private readonly provider = inject(HAUSHALT_DATA_PROVIDER);
  readonly saved = output<string>();

  protected readonly entries = signal<FolderEntryDto[] | null>(null);
  protected readonly loadError = signal(false);
  protected readonly forbidden = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly relativeDay = relativeDay;
  protected readonly formatDate = formatDate;

  protected readonly contracts = computed(() => (this.entries() ?? []).filter((e) => e.kind === 'vertrag'));
  protected readonly devices = computed(() => (this.entries() ?? []).filter((e) => e.kind === 'geraet'));
  protected readonly contractsMonthly = computed(() =>
    this.contracts().reduce((sum, e) => sum + (e.monthly_cost ? Number(e.monthly_cost) : 0), 0),
  );
  protected readonly upcoming = computed<UpcomingDeadline[]>(() =>
    (this.entries() ?? [])
      .flatMap((entry) => entry.deadlines.map((d) => ({ ...d, entry, days: daysUntil(d.datum) })))
      .filter((d) => d.days <= UPCOMING_DAYS)
      .sort((a, b) => a.days - b.days),
  );

  // ---------- Formular ----------
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<Id | null>(null);
  protected readonly formKind = signal<FolderKind>('vertrag');
  protected readonly formName = signal('');
  protected readonly formProvider = signal('');
  protected readonly formNotes = signal('');
  protected readonly formDeduction = signal<Id | null>(null);
  protected readonly formContractEnd = signal('');
  protected readonly formNotice = signal('');
  protected readonly formPurchase = signal('');
  protected readonly formWarranty = signal('');
  protected readonly formInterval = signal('');
  protected readonly formNextMaintenance = signal('');
  protected readonly formError = signal<string | null>(null);
  protected readonly formSaving = signal(false);
  protected readonly deductionOptions = signal<DeductionOptionDto[]>([]);

  constructor() {
    this.load();
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

  protected deadlineIcon(art: DeadlineDto['art']): string {
    return art === 'kuendigung' ? 'Kündigung' : art === 'garantie' ? 'Garantie' : 'Wartung';
  }

  protected maintenanceDone(entry: FolderEntryDto): void {
    this.actionError.set(null);
    this.provider.completeMaintenance(entry.id).subscribe({
      next: (updated) => {
        this.entries.update((entries) => (entries ?? []).map((e) => (e.id === updated.id ? updated : e)));
        this.saved.emit(
          updated.next_maintenance
            ? `Wartung erledigt · nächste ${relativeDay(updated.next_maintenance)}.`
            : 'Wartung erledigt.',
        );
      },
      error: () => this.actionError.set('Das hat nicht geklappt. Bitte noch einmal versuchen.'),
    });
  }

  // ---------- Formular ----------

  protected openNew(kind: FolderKind): void {
    this.editingId.set(null);
    this.fillForm({
      kind,
      name: '',
      provider: '',
      notes: '',
      recurring_deduction_id: null,
      contract_end: null,
      notice_period_months: null,
      purchase_date: null,
      warranty_until: null,
      maintenance_interval_months: null,
      next_maintenance: null,
    });
  }

  protected openEdit(entry: FolderEntryDto): void {
    this.editingId.set(entry.id);
    this.fillForm(entry);
  }

  private fillForm(entry: FolderEntryInput): void {
    this.formKind.set(entry.kind);
    this.formName.set(entry.name);
    this.formProvider.set(entry.provider);
    this.formNotes.set(entry.notes);
    this.formDeduction.set(entry.recurring_deduction_id);
    this.formContractEnd.set(entry.contract_end ?? '');
    this.formNotice.set(entry.notice_period_months?.toString() ?? '');
    this.formPurchase.set(entry.purchase_date ?? '');
    this.formWarranty.set(entry.warranty_until ?? '');
    this.formInterval.set(entry.maintenance_interval_months?.toString() ?? '');
    this.formNextMaintenance.set(entry.next_maintenance ?? '');
    this.formError.set(null);
    this.formOpen.set(true);
    this.loadDeductionOptions(entry.recurring_deduction_id);
  }

  /** Noch nicht verknüpfte feste Abzüge — plus der aktuell verknüpfte,
   * damit er beim Bearbeiten auswählbar bleibt. */
  private loadDeductionOptions(current: Id | null): void {
    this.provider.getUnlinkedDeductions().subscribe({
      next: (options) => {
        const linked = this.entries()
          ?.find((e) => e.recurring_deduction_id === current && current !== null);
        const withCurrent =
          current !== null && linked && !options.some((o) => o.id === current)
            ? [
                {
                  id: current,
                  name: linked.name,
                  amount: linked.monthly_cost ?? '0',
                  active: linked.deduction_active !== false,
                },
                ...options,
              ]
            : options;
        this.deductionOptions.set(withCurrent);
      },
      error: () => this.deductionOptions.set([]),
    });
  }

  protected closeForm(): void {
    this.formOpen.set(false);
  }

  protected setDeduction(value: string): void {
    const option = this.deductionOptions().find((o) => String(o.id) === value) ?? null;
    this.formDeduction.set(option ? option.id : null);
    if (option && !this.formName().trim()) this.formName.set(option.name);
  }

  protected selectedDeduction(): DeductionOptionDto | null {
    const id = this.formDeduction();
    return this.deductionOptions().find((o) => o.id === id) ?? null;
  }

  private optionalInt(value: string): number | null {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.formSaving()) return;
    const name = this.formName().trim();
    if (!name) {
      this.formError.set('Bitte einen Namen eingeben.');
      return;
    }
    const isContract = this.formKind() === 'vertrag';
    const input: FolderEntryInput = {
      kind: this.formKind(),
      name,
      provider: this.formProvider().trim(),
      notes: this.formNotes().trim(),
      recurring_deduction_id: isContract ? this.formDeduction() : null,
      contract_end: isContract ? this.formContractEnd() || null : null,
      notice_period_months: isContract ? this.optionalInt(this.formNotice()) : null,
      purchase_date: isContract ? null : this.formPurchase() || null,
      warranty_until: isContract ? null : this.formWarranty() || null,
      maintenance_interval_months: isContract ? null : this.optionalInt(this.formInterval()),
      next_maintenance: isContract ? null : this.formNextMaintenance() || null,
    };
    const id = this.editingId();
    this.formSaving.set(true);
    this.formError.set(null);
    const request = id === null ? this.provider.createFolderEntry(input) : this.provider.updateFolderEntry(id, input);
    request.subscribe({
      next: () => {
        this.formSaving.set(false);
        this.formOpen.set(false);
        this.load();
        this.saved.emit(id === null ? `„${name}“ im Ordner abgelegt.` : `„${name}“ gespeichert.`);
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
        this.saved.emit('Eintrag gelöscht.');
      },
      error: () => {
        this.formSaving.set(false);
        this.formError.set('Löschen hat nicht geklappt. Bitte noch einmal versuchen.');
      },
    });
  }
}
