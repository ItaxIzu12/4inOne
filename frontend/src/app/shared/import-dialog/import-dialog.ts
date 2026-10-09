import { Component, input, output } from '@angular/core';
import { AppIcon } from '../icons/app-icon';
import { ModalForm } from '../form/modal-form';

export interface ImportPreviewRow {
  key: number;
  /** Linke Spalte, z. B. „09.10.2026“ oder „Mo, 12.10. · 09:30“ */
  when: string;
  title: string;
  /** Zweite Zeile: Kategorie, „Schon vorhanden“, Fehlergrund … */
  hint: string;
  /** Rechte Spalte, z. B. ein Betrag (optional) */
  trail?: string;
  trailTone?: 'plus' | 'minus';
  /** Wird nicht übernommen (Dublette oder fehlerhaft) — durchgestrichen. */
  off: boolean;
}
export interface ImportPreview {
  /** Zusammenfassung, erster Teil fett: z. B. ['12 Termine neu', '3 schon vorhanden'] */
  summary: string[];
  rows: ImportPreviewRow[];
  more: number;
  note: string;
}

/**
 * Gemeinsame Oberfläche für Datei-Importe (Kontoauszug in Finanzen, Kalender in Organisation): Datei wählen →
 * Vorschau → übernehmen. Lesen und Prüfen machen die Bereiche selbst; hier nur Darstellung und Bedienung.
 * Die Bereichsfarbe kommt über `--accent` von der Seite.
 */
@Component({
  selector: 'app-import-dialog',
  imports: [AppIcon, ModalForm],
  template: `
    <app-modal-form
      icon="upload"
      [title]="title()"
      [closeLabel]="title() + ' schließen'"
      [open]="open()"
      [saving]="busy()"
      [error]="error()"
      [submitLabel]="submitLabel()"
      (submitted)="submitted.emit()"
      (closed)="closed.emit()"
    >
      @if (!preview()) {
        <p class="imp-intro">{{ intro() }} Du siehst zuerst eine Vorschau – gespeichert wird erst nach deiner Bestätigung.</p>
        <label class="imp-file" [for]="inputId()">
          <app-icon name="upload" aria-hidden="true" />
          <span><b>{{ fileName() || chooseLabel() }}</b><small>{{ fileHint() }}</small></span>
          <input [id]="inputId()" type="file" [accept]="accept()" (change)="pick($event)" />
        </label>
      } @else {
        @let p = preview()!;
        <p class="imp-summary" role="status">
          <b>{{ p.summary[0] }}</b>
          @for (part of p.summary.slice(1); track part) { · {{ part }} }
        </p>
        <ul class="imp-rows">
          @for (r of p.rows; track r.key) {
            <li [class.is-off]="r.off">
              <span class="imp-rows__date">{{ r.when }}</span>
              <span class="imp-rows__text"><b>{{ r.title }}</b><small>{{ r.hint }}</small></span>
              @if (r.trail) {
                <span class="imp-rows__amount" [class.is-income]="r.trailTone === 'plus'">{{ r.trail }}</span>
              }
            </li>
          }
        </ul>
        @if (p.more > 0) {
          <p class="imp-more">… und {{ p.more }} weitere</p>
        }
        @if (p.note) {
          <p class="imp-note">{{ p.note }}</p>
        }
        <button type="button" class="imp-again" (click)="reset.emit()">Andere Datei wählen</button>
      }
    </app-modal-form>
  `,
  styleUrl: './import-dialog.scss',
})
export class ImportDialog {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly intro = input.required<string>();
  readonly chooseLabel = input('Datei wählen');
  readonly fileHint = input('');
  readonly accept = input('');
  readonly inputId = input('import-file');
  readonly fileName = input('');
  readonly busy = input(false);
  readonly error = input('');
  readonly preview = input<ImportPreview | null>(null);
  readonly submitLabel = input('Vorschau');
  readonly filePicked = output<File | null>();
  readonly submitted = output<void>();
  readonly closed = output<void>();
  readonly reset = output<void>();

  pick(event: Event): void {
    this.filePicked.emit((event.target as HTMLInputElement).files?.[0] ?? null);
  }
}
