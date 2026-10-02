import { AmountInput } from '../../shared/directives/amount-input';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { AppDatePicker } from '../../shared/form/date-picker';
import { Field } from '../../shared/form/field';
import { ModalForm } from '../../shared/form/modal-form';
import {
  DeadlineDto,
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
 * Wartung). Die Fristen erscheinen automatisch unter „Heute“; die
 * monatlichen Kosten eines Vertrags gehören dem Haushalt und stehen direkt
 * am Eintrag (ADR-001 — keine Verknüpfung zu den eingefrorenen
 * Haushaltsfinanzen).
 *
 * Kind-Konten haben keinen Zugriff (Vertragskosten sind Finanzdaten), das
 * Backend antwortet mit 403 — hier als verständlicher Hinweis statt als
 * Ladefehler.
 */
@Component({
  selector: 'app-ordner-tab',
  standalone: true,
  imports: [AmountInput, DecimalPipe, AppIcon, Field, ModalForm, AppDatePicker],
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
  protected readonly formCost = signal('');
  protected readonly formContractEnd = signal('');
  protected readonly formNotice = signal('');
  protected readonly formPurchase = signal('');
  protected readonly formWarranty = signal('');
  protected readonly formInterval = signal('');
  protected readonly formNextMaintenance = signal('');
  protected readonly formError = signal<string | null>(null);
  protected readonly formSaving = signal(false);

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
      monthly_cost: null,
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
    this.formCost.set(entry.monthly_cost ? entry.monthly_cost.replace('.', ',') : '');
    this.formContractEnd.set(entry.contract_end ?? '');
    this.formNotice.set(entry.notice_period_months?.toString() ?? '');
    this.formPurchase.set(entry.purchase_date ?? '');
    this.formWarranty.set(entry.warranty_until ?? '');
    this.formInterval.set(entry.maintenance_interval_months?.toString() ?? '');
    this.formNextMaintenance.set(entry.next_maintenance ?? '');
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
    const isContract = this.formKind() === 'vertrag';
    const cost = isContract ? this.parseCost(this.formCost()) : null;
    if (cost === undefined) {
      this.formError.set('Bitte die monatlichen Kosten als Betrag eingeben, z. B. 39,99.');
      return;
    }
    const input: FolderEntryInput = {
      kind: this.formKind(),
      name,
      provider: this.formProvider().trim(),
      notes: this.formNotes().trim(),
      monthly_cost: cost,
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
