import { Component } from '@angular/core';

/** Rechts-Chevron für Zeilen-Disclosure — überall dieselbe Komponente
 * (Einstellungs-Zeilen, "Alle"-Links in den Modul-Karten). */
@Component({
  selector: 'icon-chevron',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `svg { width: 100%; height: 100%; }`,
})
export class IconChevron {}
