import { Component } from '@angular/core';

/** Kategorie-Icon "Fixkosten" (Miete, Abos u. ä.) — referenziert über
 * Category.icon_key='fixkosten', siehe shared/icons/category-icon.map.ts. */
@Component({
  selector: 'icon-fixkosten',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `svg { width: 100%; height: 100%; }`,
})
export class IconFixkosten {}
