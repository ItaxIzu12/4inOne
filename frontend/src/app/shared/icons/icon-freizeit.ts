import { Component } from '@angular/core';

/** Kategorie-Icon "Freizeit" — referenziert über Category.icon_key='freizeit',
 * siehe shared/icons/category-icon.map.ts. */
@Component({
  selector: 'icon-freizeit',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a6 6 0 0 1 6 6c0 4-3 6-3 8a3 3 0 0 1-6 0c0-2-3-4-3-8a6 6 0 0 1 6-6Z" />
      <path d="M12 18v2" />
      <path d="M10 22h4" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `svg { width: 100%; height: 100%; }`,
})
export class IconFreizeit {}
