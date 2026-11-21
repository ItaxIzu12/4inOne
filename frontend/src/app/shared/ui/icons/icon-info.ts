import { Component } from '@angular/core';

/** Info-Kreis für kurze, nicht-dismissible Hinweiszeilen (z. B. Dashboard-"Warum"-Zeile). */
@Component({
  selector: 'icon-info',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `svg { width: 100%; height: 100%; }`,
})
export class IconInfo {}
