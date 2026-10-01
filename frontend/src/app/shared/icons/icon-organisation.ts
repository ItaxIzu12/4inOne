import { DOMAIN_ICON_PATHS } from './domain-icon-paths';
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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path [attr.d]="path" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `
    :host {
      display: inline-flex;
      width: 1em;
      height: 1em;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class IconOrganisation {
  readonly path = DOMAIN_ICON_PATHS.calendar;
}
