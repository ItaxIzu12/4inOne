import { Component } from '@angular/core';

/** Kategorie-Icon "Transport" — referenziert über
 * Category.icon_key='transport', siehe shared/icons/category-icon.map.ts. */
@Component({
  selector: 'icon-transport',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 13h18l-2-6H5l-2 6Z" />
      <path d="M3 13v4h18v-4" />
      <circle cx="7" cy="17.5" r="1.5" />
      <circle cx="17" cy="17.5" r="1.5" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `svg { width: 100%; height: 100%; }`,
})
export class IconTransport {}
