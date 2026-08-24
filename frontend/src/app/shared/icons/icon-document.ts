import { Component } from '@angular/core';

/** Steht für "ein rechtliches Dokument" — bewusst dieselbe Komponente für
 * Impressum/Datenschutz/Nutzungsbedingungen/Barrierefreiheit, statt vier
 * kaum unterscheidbarer Symbole zu erfinden (alle vier sind derselbe Typ
 * Inhalt: eine rechtliche Textseite). */
@Component({
  selector: 'icon-document',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `svg { width: 100%; height: 100%; }`,
})
export class IconDocument {}
