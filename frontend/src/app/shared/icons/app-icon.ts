import { DOMAIN_ICON_PATHS } from './domain-icon-paths';
import { Component, input } from '@angular/core';
export type IconName =
  | 'home'
  | 'finance'
  | 'household'
  | 'calendar'
  | 'travel'
  | 'people'
  | 'settings'
  | 'bell'
  | 'search'
  | 'link'
  | 'bulb'
  | 'check'
  | 'plus'
  | 'more'
  | 'arrow'
  | 'leaf'
  | 'bars'
  | 'trash'
  | 'basket'
  | 'device'
  | 'edit';
@Component({
  selector: 'app-icon',
  standalone: true,
  // Flache, einfarbige Strichzeichnung (currentColor, keine Verlauf-/Glanz-Füllung) — dieselbe Sprache wie die
  // einzelnen icon-*.ts-Komponenten (z. B. icon-finanzen.ts). Vorher hatten einige Namen hier eine abweichende,
  // "glänzende" Gradient-Darstellung (eigenes @case je Name mit linearGradient-Füllung) — das war der einzige Ort
  // im Produkt mit diesem Stil und wirkte dadurch wie ein KI-generiertes Mockup statt ruhig/einheitlich.
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    @if (name() === 'bars') {
      <path d="M5 15v6m7-17v17m7-11v11" stroke-width="1.8" />
    } @else {
      <path [attr.d]="paths[name()]" />
    }
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class AppIcon {
  readonly name = input<IconName>('home');
  readonly paths: Record<IconName, string> = {
    bars: 'M5 14v7m7-18v18m7-12v12',
    trash: 'M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5',
    basket: 'M3 9h18l-2 11H5L3 9Zm4 0 3-5m7 5-3-5M9 13v3m6-3v3',
    device:
      'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm-1 5h14M9 5.5h.01M12 15a3 3 0 1 0 0 .01',
    home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
    household: DOMAIN_ICON_PATHS.household,
    finance: DOMAIN_ICON_PATHS.finance,
    calendar: DOMAIN_ICON_PATHS.calendar,
    travel: DOMAIN_ICON_PATHS.travel,
    people:
      'M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6-5a3 3 0 0 1 0 6M3 21v-3a6 6 0 0 1 12 0v3Zm14-7a5 5 0 0 1 4 5v2',
    settings: DOMAIN_ICON_PATHS.settings,
    bell: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 3h4M12 2v2',
    search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',
    link: 'm10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1',
    bulb: 'M9 18h6m-6 3h6M8 15a7 7 0 1 1 8 0l-1 3H9l-1-3Z',
    check: 'm5 12 4 4L19 6',
    plus: 'M12 4v16M4 12h16',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    arrow: 'm9 5 7 7-7 7',
    leaf: 'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM12 9l-4 5 4 3 4-3-4-5Zm-4 5-4 5q8 4 16 0l-4-5M12 9v8',
    edit: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z',
  };
}
