import { Component } from '@angular/core';

/** Das EINE "Nach oben"-Icon — Desktop-Back-to-Top-Button UND der
 * mobile "Start"-Tab, der beim Scrollen zum Nach-oben-Button wird
 * (siehe dashboard.html). Bewusst ein Pfeil mit Schaft statt eines bloß
 * gedrehten Chevrons — eindeutiger als "zurück nach oben" erkennbar. */
@Component({
  selector: 'icon-back-to-top',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `svg { width: 100%; height: 100%; }`,
})
export class IconBackToTop {}
