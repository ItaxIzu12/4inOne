import { ErrorNoticeService } from '../error-notice/error-notice';
import { afterNextRender, Injector, Component, DestroyRef, ElementRef, effect, inject, input, output, signal } from '@angular/core';
import { AppIcon, IconName } from '../icons/app-icon';
import { Modal } from '../modal/modal';

let nextId = 0;

/**
 * Dialog mit Formular: Modal, Überschrift, Felder, Fehlerzeile und die
 * Standard-Buttons (Abbrechen, Speichern, optional Löschen mit Rückfrage) —
 * damit jedes Formular nur noch seine Felder beschreiben muss.
 *
 * Mit Reactive Forms direkt am Element: `<app-modal-form [formGroup]="form" …>`.
 *
 *   <app-modal-form title="Sparziel erstellen" [open]="open()" [saving]="saving()"
 *     [error]="error()" (submitted)="save()" (closed)="close()">
 *     <app-field label="Titel"><input formControlName="title" /></app-field>
 *   </app-modal-form>
 *
 * Löschen: `deleteLabel` setzen (z. B. „Eintrag löschen“); `deleted` kommt
 * erst nach der Rückfrage.
 */
@Component({
  selector: 'app-modal-form',
  standalone: true,
  imports: [AppIcon, Modal],
  templateUrl: './modal-form.html',
  styleUrl: './modal-form.css',
})
export class ModalForm {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly submitLabel = input('Speichern');
  readonly cancelLabel = input('Abbrechen');
  readonly saving = input(false);
  readonly error = input('');
  /** Text des Löschen-Buttons; leer = kein Löschen möglich. */
  readonly deleteLabel = input('');
  readonly closeLabel = input('Schließen');
  /** Kleines Symbol in der Bereichsfarbe neben dem Titel. */
  readonly icon = input<IconName | null>(null);

  readonly submitted = output<void>();
  readonly closed = output<void>();
  readonly deleted = output<void>();

  protected readonly titleId = `modal-form-title-${nextId++}`;
  protected readonly confirmingDelete = signal(false);

  private readonly notices = inject(ErrorNoticeService);
  private readonly injector = inject(Injector);
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);


  constructor() {
    inject(DestroyRef).onDestroy(() => this.notices.clear(this));
    effect(() => {
      const message = this.error();
      if (this.open() && message) this.notices.show(message, this);
      else this.notices.clear(this);
    });
    // Die Rückfrage gilt nur für den aktuellen Dialog, nie für den nächsten.
    effect(() => {
      if (!this.open()) this.confirmingDelete.set(false);
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.saving()) {
      this.submitted.emit();
      // Wait for parent validation and input bindings before repeating an error.
      afterNextRender(() => {
        if (!this.open()) return;
        if (this.error()) this.notices.show(this.error(), this);
        else this.notices.clear(this);
        const invalid = this.element.nativeElement.querySelector<HTMLElement>(
          'input.ng-invalid, select.ng-invalid, textarea.ng-invalid, input:invalid, select:invalid, textarea:invalid, [aria-invalid="true"]',
        );
        invalid?.focus({ preventScroll: true });
        invalid?.scrollIntoView?.({ block: 'center', behavior: 'instant' });
      }, { injector: this.injector });
    }
  }

  protected confirmDelete(): void {
    this.confirmingDelete.set(false);
    this.deleted.emit();
  }
}
