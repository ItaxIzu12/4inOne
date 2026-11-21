import { Component } from '@angular/core';

/** Zurück-Pfeil, z. B. für den "Zurück zum Start"-Link auf der Anmeldeseite. */
@Component({
  selector: 'icon-arrow-left',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `svg { width: 100%; height: 100%; }`,
})
export class IconArrowLeft {}
