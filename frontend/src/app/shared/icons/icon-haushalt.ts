import { Component } from '@angular/core';

/**
 * Das EINE Haushalt-Icon der App — überall verwenden, wo die Sektion
 * "Haushalt" auftaucht (Sidebar, Bottom-Nav, Modul-Karte, Seitentitel).
 * Keine abweichenden Varianten pflegen, siehe Aufgabenstellung.
 */
@Component({
  selector: 'icon-haushalt',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 8h12l1 12H5L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `
    :host { display: inline-flex; width: 1em; height: 1em; }
    svg { width: 100%; height: 100%; }
  `,
})
export class IconHaushalt {}
