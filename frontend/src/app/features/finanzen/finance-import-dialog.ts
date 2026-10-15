import { SubmissionKey } from '../../shared/idempotency';
import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ImportDialog, ImportPreview } from '../../shared/import-dialog/import-dialog';
import { CsvFormatError, IMPORT_MAX_BYTES, ImportRow, decodeCsv, parseCsv } from './finance-import';
import { ImportResult, PrivateFinanceApi } from './private-finance-api.service';

const PREVIEW_ROWS = 8;

/**
 * Kontoauszug übernehmen: CSV wählen → Vorschau (neu, schon vorhanden, fehlerhaft — vom Server geprüft, nichts ist
 * gespeichert) → „x importieren“. Die Datei verlässt den Browser nicht; nur die erkannten Zeilen gehen ans Backend.
 */
@Component({
  selector: 'app-finance-import-dialog',
  imports: [ImportDialog],
  template: `
    <app-import-dialog
      title="Kontoauszug importieren"
      intro="Exportiere die Umsätze im Online-Banking als CSV (z. B. Sparkasse, ING, DKB, Volksbank) und wähle die Datei hier aus."
      chooseLabel="CSV-Datei wählen"
      fileHint="höchstens 1.000 Transaktionen, bis 2 MB"
      accept=".csv,text/csv"
      [open]="open()"
      [fileName]="fileName()"
      [busy]="busy()"
      [error]="error()"
      [preview]="view()"
      [submitLabel]="submitLabel()"
      (filePicked)="pick($event)"
      (submitted)="submit()"
      (closed)="close()"
      (reset)="reset()"
    />
  `,
})
export class FinanceImportDialog {
  private api = inject(PrivateFinanceApi);
  private destroy = inject(DestroyRef);
  readonly open = input.required<boolean>();
  readonly closed = output<void>();
  readonly imported = output<number>();

  readonly busy = signal(false);
  readonly error = signal('');
  readonly fileName = signal('');
  readonly preview = signal<{ rows: ImportRow[]; skipped: number; result: ImportResult } | null>(null);
  // Kurz, damit der Knopf am Handy einzeilig bleibt; die Zahl steht ausführlich in der Zusammenfassung.
  readonly submitLabel = computed(() => {
    const p = this.preview();
    if (!p) return 'Vorschau';
    return p.result.new ? `${p.result.new} importieren` : 'Schließen';
  });
  readonly view = computed<ImportPreview | null>(() => {
    const p = this.preview();
    if (!p) return null;
    const status = new Map(p.result.rows.map((r) => [r.row, r]));
    const unreadable = p.result.invalid + p.skipped;
    return {
      summary: [
        `${p.result.new} ${p.result.new === 1 ? 'Transaktion' : 'Transaktionen'} neu`,
        ...(p.result.duplicates ? [`${p.result.duplicates} schon vorhanden (werden übersprungen)`] : []),
        ...(unreadable ? [`${unreadable} nicht lesbar`] : []),
      ],
      rows: p.rows.slice(0, PREVIEW_ROWS).map((row, i) => {
        const info = status.get(i + 1);
        const [y, m, d] = row.date.split('-');
        const amount = Number(row.amount).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return {
          key: i,
          when: `${d}.${m}.${y}`,
          title: row.note || 'ohne Text',
          hint: info?.status === 'new' ? (info.category ?? '') : (info?.message ?? 'nicht lesbar'),
          trail: `${row.type === 'INCOME' ? '+' : '−'}${amount} €`,
          trailTone: row.type === 'INCOME' ? 'plus' : 'minus',
          off: info?.status !== 'new',
        };
      }),
      more: Math.max(0, p.rows.length - PREVIEW_ROWS),
      note: 'Unbekannte Kategorien landen in „Sonstiges“ – du kannst sie danach ändern.',
    };
  });
  private file: File | null = null;

  pick(file: File | null): void {
    this.file = file;
    this.fileName.set(file?.name ?? '');
    this.error.set('');
    if (file) this.submit();
  }
  submit(): void {
    if (this.busy()) return;
    const p = this.preview();
    if (p) return this.commit(p.rows);
    if (!this.file) {
      this.error.set('Bitte wähle eine CSV-Datei aus.');
      return;
    }
    if (this.file.size > IMPORT_MAX_BYTES) {
      this.error.set('Die Datei ist größer als 2 MB. Exportiere bitte einen kürzeren Zeitraum.');
      return;
    }
    this.busy.set(true);
    this.file
      .arrayBuffer()
      .then((bytes) => {
        const parsed = parseCsv(decodeCsv(bytes));
        if (!parsed.rows.length) throw new CsvFormatError('In der Datei wurde keine Transaktion gefunden.');
        this.api
          .importTransactions(parsed.rows, true)
          .pipe(takeUntilDestroyed(this.destroy))
          .subscribe({
            next: (result) => {
              this.busy.set(false);
              this.preview.set({ rows: parsed.rows, skipped: parsed.skipped.length, result });
            },
            error: () => {
              this.busy.set(false);
              this.error.set('Die Datei konnte nicht geprüft werden. Bitte versuche es erneut.');
            },
          });
      })
      .catch((err: unknown) => {
        this.busy.set(false);
        this.error.set(err instanceof CsvFormatError ? err.message : 'Die Datei konnte nicht gelesen werden. Ist es eine CSV-Datei?');
      });
  }
  /** Erneut „Importieren“ nach Verbindungsfehler übernimmt dieselben Zeilen nicht doppelt. */
  private readonly submission = new SubmissionKey();

  private commit(rows: ImportRow[]): void {
    if (!this.preview()!.result.new) return this.close();
    this.busy.set(true);
    this.api
      .importTransactions(rows, false, this.submission.for(rows))
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          this.busy.set(false);
          this.submission.reset();
          this.imported.emit(result.created);
          this.close();
        },
        error: () => {
          this.busy.set(false);
          this.error.set('Der Import ist fehlgeschlagen. Es wurde nichts gespeichert – bitte versuche es erneut.');
        },
      });
  }
  reset(): void {
    this.preview.set(null);
    this.file = null;
    this.fileName.set('');
    this.error.set('');
  }
  close(): void {
    if (this.busy()) return;
    this.reset();
    this.closed.emit();
  }
}
