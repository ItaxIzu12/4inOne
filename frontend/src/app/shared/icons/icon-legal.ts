import { Component } from '@angular/core';

/** Markiert den "Rechtliches"-Abschnitt in den Einstellungen — dasselbe
 * Schild-Symbol wie das "DSGVO-konform"-Badge auf der Login-Markenseite. */
@Component({
  selector: 'icon-legal',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2 4 5v6c0 5 3.4 8.6 8 11 4.6-2.4 8-6 8-11V5l-8-3Z" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `svg { width: 100%; height: 100%; }`,
})
export class IconLegal {}
