import { DOMAIN_ICON_PATHS } from './domain-icon-paths';
import { Component } from '@angular/core';

/** Zahnrad — Einstiegspunkt zu den Einstellungen (mobile App-Topbar). */
@Component({
  selector: 'icon-settings',
  standalone: true,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path [attr.d]="path" />
    </svg>
  `,
  host: { class: 'kompass-icon', 'aria-hidden': 'true' },
  styles: `
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class IconSettings {
  readonly path = DOMAIN_ICON_PATHS.settings;
}
