import { Component, ElementRef, computed, contentChild, effect, inject, input, signal } from '@angular/core';
import { NgControl } from '@angular/forms';

/**
 * Beschriftetes Formularfeld: Label, Eingabe, optional Hinweis und Fehler.
 * Das Eingabeelement (input, select, textarea) wird eingesetzt und liegt
 * IM Label — die Zuordnung für Screenreader entsteht ohne id/for.
 * Aussehen der Eingabe: form-controls.css (global).
 *
 *   <app-field label="Betrag" hint="Mit Komma oder Punkt">
 *     <input formControlName="amount" inputmode="decimal" />
 *   </app-field>
 */
let nextField = 0;

@Component({
  selector: 'app-field',
  standalone: true,
  host: { '(input)': 'refresh()', '(change)': 'refresh()' },
  template: `
    <label class="field__control">
      <span class="field__label">{{ optional() ? label() + ' ' : label() }}@if (optional()) {<span class="field__optional">(optional)</span>}</span>
      <ng-content />
    </label>
    @if (hint()) {
      <p class="field__hint">{{ hint() }}</p>
    }
    @if (displayError()) {
      <p class="field__error" [id]="errorId">{{ displayError() }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .field__control {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .field__label {
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
    }
    .field__optional {
      font-weight: 400;
      color: var(--text-muted);
    }
    .field__hint,
    .field__error {
      margin: 6px 0 0;
      font-size: 14px;
    }
    .field__hint {
      color: var(--text-muted);
    }
    .field__error {
      color: var(--danger);
      font-weight: 700;
    }
  `,
})
export class Field {
  readonly errorId = 'field-error-' + nextField++;
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly control = contentChild(NgControl, { descendants: true });
  private readonly submitted = signal(false);
  private readonly revision = signal(0);
  refresh() { this.revision.update(n => n + 1); }
  resetValidation() { this.submitted.set(false); this.refresh(); }
  validate() { this.submitted.set(true); this.control()?.control?.markAsTouched(); this.refresh(); }
  readonly displayError = computed(() => {
    this.revision();
    if (this.error()) return this.error();
    const control = this.control()?.control;
    if (!this.submitted() && !control?.touched) return '';
    if (control?.invalid) {
      if (control.errors?.['required']) return 'Bitte ' + this.label() + ' angeben.';
      if (control.errors?.['maxlength']) return 'Bitte kürze deine Eingabe.';
      return 'Bitte prüfe deine Angabe.';
    }
    const native = this.element.nativeElement.querySelector<HTMLInputElement>('input, textarea, select');
    if (native && !native.disabled && native.validity && !native.validity.valid) {
      return native.validity.valueMissing ? 'Bitte ' + this.label() + ' angeben.' : 'Bitte prüfe deine Angabe.';
    }
    return '';
  });
  constructor() {
    effect(onCleanup => {
      const subscription = this.control()?.control?.events.subscribe(() => this.refresh());
      onCleanup(() => subscription?.unsubscribe());
    });
    effect(() => {
      const message = this.displayError();
      queueMicrotask(() => {
        const target = this.element.nativeElement.querySelector<HTMLElement>('input, textarea, select, button');
        if (!target) return;
        const ids = (target.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== this.errorId);
        if (message) ids.push(this.errorId);
        if (ids.length) target.setAttribute('aria-describedby', ids.join(' '));
        else target.removeAttribute('aria-describedby');
        if (message) target.setAttribute('aria-invalid', 'true');
        else target.removeAttribute('aria-invalid');
      });
    });
  }

  readonly label = input.required<string>();
  readonly hint = input('');
  readonly error = input('');
  /** Hängt „(optional)“ an die Beschriftung an. */
  readonly optional = input(false);
}
