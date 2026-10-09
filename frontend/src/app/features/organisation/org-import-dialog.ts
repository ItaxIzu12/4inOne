import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ImportDialog, ImportPreview } from '../../shared/import-dialog/import-dialog';
import { EventImportRow, ICS_MAX_BYTES, IcsFormatError, parseIcs } from './org-import';
import { EventImportResult, OrganisationApi } from './organisation-api.service';

const PREVIEW_ROWS = 8;
const REPEAT: Record<string, string> = { daily: 'täglich', weekly: 'wöchentlich', monthly: 'monatlich', yearly: 'jährlich' };

/**
 * Kalender übernehmen: ICS-Datei (Google, Apple, Outlook) → Vorschau (neu, schon im Kalender, fehlerhaft — vom Server
 * geprüft) → „x importieren“. Die Datei verlässt den Browser nicht; nur die erkannten Termine gehen ans Backend.
 */
@Component({
  selector: 'app-org-import-dialog',
  imports: [ImportDialog],
  template: `
    <app-import-dialog
      title="Kalender importieren"
      intro="Exportiere deinen Kalender als ICS-Datei (in Google Kalender unter „Einstellungen → Import & Export“, in Apple Kalender über „Ablage → Exportieren“) und wähle sie hier aus."
      chooseLabel="ICS-Datei wählen"
      fileHint="höchstens 1.000 Termine, bis 5 MB"
      accept=".ics,text/calendar"
      inputId="import-ics"
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
export class OrgImportDialog {
  private api = inject(OrganisationApi);
  private destroy = inject(DestroyRef);
  readonly open = input.required<boolean>();
  readonly closed = output<void>();
  readonly imported = output<number>();

  readonly busy = signal(false);
  readonly error = signal('');
  readonly fileName = signal('');
  readonly preview = signal<{ rows: EventImportRow[]; simplified: number; skipped: number; result: EventImportResult } | null>(null);
  readonly submitLabel = computed(() => {
    const p = this.preview();
    if (!p) return 'Vorschau';
    return p.result.new ? `${p.result.new} importieren` : 'Schließen';
  });
  readonly view = computed<ImportPreview | null>(() => {
    const p = this.preview();
    if (!p) return null;
    const status = new Map(p.result.rows.map((r) => [r.row, r]));
    const notes = [
      p.simplified ? `${p.simplified} ${p.simplified === 1 ? 'Termin hat' : 'Termine haben'} eine Wiederholung, die 4inOne nicht abbildet (z. B. mit Enddatum) – sie kommen einmalig.` : '',
      p.skipped ? `${p.skipped} abgesagte Termine oder Einzeländerungen werden nicht übernommen.` : '',
    ].filter(Boolean);
    return {
      summary: [
        `${p.result.new} ${p.result.new === 1 ? 'Termin' : 'Termine'} neu`,
        ...(p.result.duplicates ? [`${p.result.duplicates} schon im Kalender`] : []),
        ...(p.result.invalid ? [`${p.result.invalid} fehlerhaft`] : []),
      ],
      rows: p.rows.slice(0, PREVIEW_ROWS).map((row, i) => {
        const info = status.get(i + 1);
        return {
          key: i,
          when: when(row),
          title: row.title,
          hint: info?.status === 'new' ? [row.location, row.recurrence ? REPEAT[row.recurrence] : ''].filter(Boolean).join(' · ') : (info?.message ?? ''),
          off: info?.status !== 'new',
        };
      }),
      more: Math.max(0, p.rows.length - PREVIEW_ROWS),
      note: notes.join(' '),
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
      this.error.set('Bitte wähle eine ICS-Datei aus.');
      return;
    }
    if (this.file.size > ICS_MAX_BYTES) {
      this.error.set('Die Datei ist größer als 5 MB. Exportiere bitte einen einzelnen Kalender oder einen kürzeren Zeitraum.');
      return;
    }
    this.busy.set(true);
    this.file
      .text()
      .then((text) => {
        const parsed = parseIcs(text);
        if (!parsed.rows.length) throw new IcsFormatError('In der Datei wurde kein Termin gefunden.');
        this.api
          .importEvents(parsed.rows, true)
          .pipe(takeUntilDestroyed(this.destroy))
          .subscribe({
            next: (result) => {
              this.busy.set(false);
              this.preview.set({ ...parsed, result });
            },
            error: () => {
              this.busy.set(false);
              this.error.set('Die Datei konnte nicht geprüft werden. Bitte versuche es erneut.');
            },
          });
      })
      .catch((err: unknown) => {
        this.busy.set(false);
        this.error.set(err instanceof IcsFormatError ? err.message : 'Die Datei konnte nicht gelesen werden. Ist es eine ICS-Datei?');
      });
  }
  private commit(rows: EventImportRow[]): void {
    if (!this.preview()!.result.new) return this.close();
    this.busy.set(true);
    this.api
      .importEvents(rows, false)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          this.busy.set(false);
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

/** „Mo, 12.10.2026 · 09:30“ bzw. „Mo, 12.10.2026“ für ganztägige Termine — in der Zeit der Person. */
function when(row: EventImportRow): string {
  const at = new Date(row.starts_at);
  const day = at.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  return row.all_day ? day : `${day} · ${at.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
}
