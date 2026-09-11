import { Component } from '@angular/core';

/** Kategorie-Icon "Sonstiges" (Auffang-Kategorie) — referenziert über
 * Category.icon_key='sonstiges', siehe shared/icons/category-icon.map.ts. */
@Component({
  selector: 'icon-sonstiges',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.6 12.1a2.1 2.1 0 0 0-.6-1.5l-8-8a2 2 0 0 0-1.4-.6H5a2 2 0 0 0-2 2v5.6c0 .5.2 1 .6 1.4l8 8a2 2 0 0 0 2.8 0l5.6-5.6c.4-.4.6-.9.6-1.5Z" />
      <circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `svg { width: 100%; height: 100%; }`,
})
export class IconSonstiges {}
