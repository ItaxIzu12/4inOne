import { Component } from '@angular/core';

/** Kategorie-Icon "Geschenke" — referenziert über
 * Category.icon_key='geschenke', siehe shared/icons/category-icon.map.ts. */
@Component({
  selector: 'icon-geschenke',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="8" width="18" height="13" rx="1" />
      <path d="M3 12h18" />
      <path d="M12 8v13" />
      <path d="M12 8C10.5 8 9 7 9 5.5S10.5 3 12 4c1.5-1 3 0 3 1.5S13.5 8 12 8Z" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `svg { width: 100%; height: 100%; }`,
})
export class IconGeschenke {}
