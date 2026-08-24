import { Component } from '@angular/core';

/**
 * Das EINE Organisation-Icon der App — überall verwenden, wo die Sektion
 * "Organisation"/"Kalender" auftaucht (Sidebar, Bottom-Nav, Modul-Karte,
 * Seitentitel). Keine abweichenden Varianten pflegen, siehe Aufgabenstellung.
 */
@Component({
  selector: 'icon-organisation',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="5" width="16" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `
    :host { display: inline-flex; width: 1em; height: 1em; }
    svg { width: 100%; height: 100%; }
  `,
})
export class IconOrganisation {}
