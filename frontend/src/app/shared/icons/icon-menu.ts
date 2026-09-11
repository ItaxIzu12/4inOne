import { Component } from '@angular/core';

/** Hamburger-Icon für den mobilen Navigations-Umschalter im Header. */
@Component({
  selector: 'icon-menu',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `svg { width: 100%; height: 100%; }`,
})
export class IconMenu {}
