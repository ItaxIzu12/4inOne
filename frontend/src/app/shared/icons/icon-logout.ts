import { Component } from '@angular/core';

/** "Abmelden". */
@Component({
  selector: 'icon-logout',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4" />
      <path d="M10 17l5-5-5-5M15 12H3" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `svg { width: 100%; height: 100%; }`,
})
export class IconLogout {}
