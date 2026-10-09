import { Component, input } from '@angular/core';
import { AppIcon } from '../icons/app-icon';

/**
 * Eine Zeile, die sagt, wer etwas sieht: „Gemeinsam – alle im Haushalt …“ (Personen-Symbol)
 * oder „Nur für dich sichtbar“ (Schloss). Steht über Listen und in Formularen, wo dieselbe Art
 * Eintrag in zwei Bereichen vorkommt (Aufgaben in Haushalt und Organisation) — über der Liste
 * mit einem Link in den jeweils anderen Bereich.
 */
@Component({
  selector: 'app-scope-note',
  standalone: true,
  imports: [AppIcon],
  template: `<app-icon [name]="scope() === 'shared' ? 'people' : 'lock'" aria-hidden="true" /><span><ng-content /></span>`,
  styles: `
    :host {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0 0 12px;
      color: var(--text-muted);
      font-size: 14px;
      line-height: 1.4;
    }
    /* Verweis auf den anderen Bereich (vom Aufrufer eingesetzt) */
    :host ::ng-deep a {
      color: var(--accent-hover, var(--accent));
      font-weight: 600;
      text-decoration: underline;
      text-underline-offset: 2px;
      white-space: nowrap;
    }
    app-icon {
      flex: 0 0 16px;
      width: 16px;
      height: 16px;
      margin-top: 2px;
      color: var(--accent);
    }
  `,
})
export class ScopeNote {
  readonly scope = input.required<'shared' | 'private'>();
}
