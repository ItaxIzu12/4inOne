import { Component, input } from '@angular/core';

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
@Component({
  selector: 'app-field',
  standalone: true,
  template: `
    <label class="field__control">
      <span class="field__label">{{ label() }}@if (optional()) { <span class="field__optional">(optional)</span> }</span>
      <ng-content />
    </label>
    @if (hint()) {
      <p class="field__hint">{{ hint() }}</p>
    }
    @if (error()) {
      <p class="field__error" role="alert">{{ error() }}</p>
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
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
    }
    .field__optional {
      margin-left: 4px;
      font-weight: 400;
      color: var(--text-muted);
    }
    .field__hint,
    .field__error {
      margin: 6px 0 0;
      font-size: 13px;
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
  readonly label = input.required<string>();
  readonly hint = input('');
  readonly error = input('');
  /** Hängt „(optional)“ an die Beschriftung an. */
  readonly optional = input(false);
}
