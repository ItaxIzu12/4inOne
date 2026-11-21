import { Component } from '@angular/core';

/** Schließen-Icon (X) — u. a. Gegenstück zu icon-menu im geöffneten Zustand. */
@Component({
  selector: 'icon-close',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `svg { width: 100%; height: 100%; }`,
})
export class IconClose {}
