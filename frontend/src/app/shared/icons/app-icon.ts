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
  | 'edit'
  // Haushalt (Übersicht nach Entwurf): Reiter, Kennzahlen, Gerätearten, Routinen
  | 'check-circle'
  | 'clipboard'
  | 'repeat'
  | 'cart'
  | 'list'
  | 'help'
  | 'washer'
  | 'fridge'
  | 'dishwasher'
  | 'bed'
  // Aufgaben-Reiter: Räume, Dauer, Priorität, Person, Filter
  | 'utensils'
  | 'bath'
  | 'sofa'
  | 'door'
  | 'tree'
  | 'desk'
  | 'blocks'
  | 'clock'
  | 'flag'
  | 'user'
  | 'filter'
  | 'chevron-down'
  | 'close'
  // Organisation: Orte, Dateien, Kategorien
  | 'map-pin'
  | 'file-text'
  | 'folder'
  | 'upload'
  | 'download'
  | 'star'
  | 'external'
  | 'image'
  | 'video'
  | 'dumbbell'
  | 'heart'
  // Finanzen: Trend, Ausgaben, Sparen
  | 'trend-up'
  | 'arrow-down'
  | 'piggy'
  // Routinen, Geräte, Einkaufslisten
  | 'sun'
  | 'flame'
  | 'sort'
  | 'spray'
  | 'plant'
  | 'wrench'
  | 'shield'
  | 'tag'
  | 'vacuum'
  | 'oven'
  | 'coffee'
  | 'heater'
  | 'chevron-left'
  | 'chevron-up'
  | 'calendar-check'
  | 'bottle'
  | 'toolbox'
  | 'gift'
  | 'apple'
  | 'bread'
  | 'milk'
  | 'snowflake'
  | 'package'
  | 'shirt'
  | 'user-plus'
  | 'meat'
  | 'umbrella'
  | 'archive'
  | 'lock'
  | 'mountain'
  | 'car'
  | 'train'
  | 'ticket'
  | 'luggage'
  | 'printer'
  | 'share'
  | 'eye-off'
  | 'coins'
  | 'pie'
  | 'info'
  | 'smartphone'
  | 'backpack'
  | 'pill'
  | 'arrow-left';
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
    'check-circle': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-4 9 3 3 5-6',
    clipboard: 'M9 3h6v3H9V3Zm0 1.5H6.5A1.5 1.5 0 0 0 5 6v13.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H15M9 13.5l2 2 4-4.5',
    repeat: 'M19.5 10A8 8 0 0 0 5.6 6.4L4 8m0-4.5V8h4.5M4.5 14a8 8 0 0 0 13.9 3.6L20 16m0 4.5V16h-4.5',
    cart: 'M3 4h2.2l2.3 11h10.3L20 8H6.3M9.5 19.5h.01M17 19.5h.01',
    list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
    help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4m0 3h.01',
    washer: 'M5.5 3h13A1.5 1.5 0 0 1 20 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3ZM4 7.5h16M7.5 5.3h.01M10.5 5.3h.01M12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2 4.5c1.3-.8 2.7.8 4 0',
    fridge: 'M6.5 2h11A1.5 1.5 0 0 1 19 3.5v17a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20.5v-17A1.5 1.5 0 0 1 6.5 2ZM5 9.5h14M8.5 5v2M8.5 12.5v3.5',
    dishwasher: 'M5.5 3h13A1.5 1.5 0 0 1 20 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3ZM4 8h16M7.5 5.5h.01M11 5.5h5.5M8 12.5h8M8 16.5h8',
    bed: 'M3 19V6m0 9h18v4m0-4v-2.5A3.5 3.5 0 0 0 17.5 9H11v6M7 13.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z',
    utensils: 'M6 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M8 3v18M17 21V3c-2 1.5-3 4-3 7 0 1.7 1.3 3 3 3',
    bath: 'M4 12h17v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3Zm2 0V5.5A2.5 2.5 0 0 1 8.5 3c1.2 0 2.2.8 2.4 2M7 20l-1 1.5M17 20l1 1.5',
    sofa: 'M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4Zm3 5v2m12-2v2',
    door: 'M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M14.5 12h.01',
    tree: 'M12 3 6 11h3l-4 6h14l-4-6h3l-6-8Zm0 14v4',
    desk: 'M3 9h18M5 9v11m14-11v11M5 14h6v6M8 5h3v4',
    blocks: 'M4 13h7v7H4v-7Zm9 0h7v7h-7v-7ZM8.5 4h7v7h-7V4Z',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4.5V12l3 2',
    flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
    user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM5 21a7 7 0 0 1 14 0',
    filter: 'M4 6h16M7 12h10M10 18h4',
    'chevron-down': 'm6 9 6 6 6-6',
    close: 'M6 6l12 12M18 6 6 18',
    'map-pin': 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    'file-text': 'M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5L14 3Zm0 0v4.5h4.5M9 12h6M9 15.5h6',
    'folder': 'M3.5 6.5A1.5 1.5 0 0 1 5 5h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v9.3A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V6.5Z',
    'upload': 'M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15',
    'download': 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15',
    'star': 'm12 3.5 2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9L12 3.5Z',
    'external': 'M14 4h6v6m0-6-8.5 8.5M18 13.5v5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h5',
    'image': 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm-1 12 4.5-4.5 4 4 2.5-2.5L20 17M15.5 8.5h.01',
    'video': 'M4.5 6.5h9A1.5 1.5 0 0 1 15 8v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 16V8a1.5 1.5 0 0 1 1.5-1.5Zm10.5 4 6-3.5v10l-6-3.5',
    'dumbbell': 'M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11',
    'heart': 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z',
    'trend-up': 'M3 17 9.5 10.5l4 4L21 7M15 7h6v6',
    'arrow-down': 'M12 4v16m-6-6 6 6 6-6',
    'piggy': 'M5 11a7 6 0 0 1 12.4-3.5L20 7v4l1.5.5v3L20 15c-.6 1.3-1.6 2.3-3 3v2h-3v-1.2a8.5 8.5 0 0 1-3 0V20H8v-2.3A6.3 6.3 0 0 1 5 13H3v-2h2Zm10-.5h.01M9 6.5c1-.4 2.4-.5 3.5-.2',
    'sun': 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4',
    'flame': 'M12 21c-3.9 0-7-2.7-7-6.5 0-3.4 2.5-5.4 3.6-8.5.4 1.7 1.3 2.9 2.4 3.5C11.6 6.5 13 4.4 15 3c-.3 3 1.2 4.6 2.4 6.2C18.4 10.6 19 12.3 19 14.5 19 18.3 15.9 21 12 21Zm0 0c-1.7 0-3-1.2-3-2.8 0-1.6 1.4-2.4 2-4 .9.9 1.4 1.4 2.3 1.4.9 1.1 1.7 1.7 1.7 2.6 0 1.6-1.3 2.8-3 2.8Z',
    'sort': 'M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3',
    'spray': 'M9 9h5v12H9V9Zm1-6h3v3h-3V3Zm0 3v3m3-3v3m3-2h2m-2-2 1.5-1.5M16 7l1.5 1.5',
    'plant': 'M12 21v-9m0 0c0-3.5-2.5-6-6-6 0 3.5 2.5 6 6 6Zm0 0c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6ZM7 21h10',
    'wrench': 'M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8a2.8 2.8 0 0 1-4-4l8-8-1.3-1.3a4 4 0 0 0-5-5l2.6 2.6-1.4 2.8-2.8 1.4L6.5 6.9',
    'shield': 'M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z',
    'tag': 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Zm4.5-4.5h.01',
    'vacuum': 'M15 3h-2.5a1 1 0 0 0-1 1.2L14 17M14 17H6.5a2.5 2.5 0 0 0 0 5H15a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2h-1Zm-6 2.5h.01',
    'oven': 'M5.5 3h13A1.5 1.5 0 0 1 20 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3ZM4 8h16M7.5 5.5h.01M11 5.5h.01M14.5 5.5h.01M7 11h10v7H7v-7Z',
    'coffee': 'M5 9h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Zm11 1h1.5a2.5 2.5 0 0 1 0 5H16M8 3c-.6.8-.6 1.7 0 2.5M11 3c-.6.8-.6 1.7 0 2.5M14 3c-.6.8-.6 1.7 0 2.5',
    'heater': 'M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 0v14m4-14v14m4-14v14M4 21h2m12 0h2',
    'chevron-left': 'm15 6-6 6 6 6',
    'chevron-up': 'm6 15 6-6 6 6',
    'calendar-check': 'M7 3v3m10-3v3M4.5 6h15A.5.5 0 0 1 20 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a.5.5 0 0 1 .5-.5ZM4 10h16m-11 4.5 2 2 4-4',
    'bottle': 'M10 3h4v3l1.5 2.2c.3.5.5 1 .5 1.6V20a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9.8c0-.6.2-1.1.5-1.6L10 6V3Zm-2 9h8m-8 5h8',
    'toolbox': 'M3 9h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Zm0 0 2-4h14l2 4M9 5V3.5h6V5M3 13h18m-11-1v2m4-2v2',
    'gift': 'M4 10h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V10Zm-1-3h18v3H3V7Zm9 0v14M12 7c-1-2.5-2.5-4-4-4a2 2 0 0 0 0 4h4Zm0 0c1-2.5 2.5-4 4-4a2 2 0 0 1 0 4h-4Z',
    'apple': 'M12 7c-1.5-1.2-4-1.5-5.6 0C4.6 8.7 4.6 12.4 6 15.5c1.2 2.7 3 5 4.5 4.5.6-.2 1-.5 1.5-.5s.9.3 1.5.5c1.5.5 3.3-1.8 4.5-4.5 1.4-3.1 1.4-6.8-.4-8.5C16 5.5 13.5 5.8 12 7Zm0 0c0-2 .8-3.3 2.5-4',
    'bread': 'M5 11a4 4 0 0 1 2-7.5h10A4 4 0 0 1 19 11v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8Zm4 1v5m3-5v5m3-5v5',
    'milk': 'M8 3h8v3l2 3v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9l2-3V3Zm-2 6h12M10 13h4',
    'snowflake': 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5',
    'package': 'M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 18v-10m8-4-8 4-8-4m4-2 8 4',
    'shirt': 'M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3Z',
    'user-plus': 'M10 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM3 21a7 7 0 0 1 12.5-4.3M19 14v6m-3-3h6',
    'meat': 'M15.5 3.5c3 1.5 5 5 4 8.5-1.2 4-5.5 6-9.5 5.5l-3.5 3.5a2 2 0 0 1-3-3l3.5-3.5C6.5 10.5 8.5 6 12.5 4c1-.5 2-.7 3-.5Zm-3 6.5a2 2 0 1 0 0 .01',
    'umbrella': 'M12 3a9 9 0 0 0-9 9h18a9 9 0 0 0-9-9Zm0 0v1m0 8v6.5a2.5 2.5 0 0 0 5 0',
    'lock': 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
    'archive': 'M3 4h18v4H3zM5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4',
    'mountain': 'M3 20 10 7l4 7 2-3 5 9H3Zm7-13 2.2 4L10 12.5 8 11',
    'car': 'M5 16V11l2-5h10l2 5v5M5 16h14M5 16v2.5h3V16m8 0v2.5h3V16M4 11h16M7.5 13.5h.01m9 0h.01',
    'train': 'M7 3h10a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Zm-2 7h14M8.5 13.5h.01m7 0h.01M8 17l-2 4m10-4 2 4',
    'ticket': 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Zm10 0v2m0 2.5v1m0 2.5v2',
    'luggage': 'M7 7h10a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Zm3 0V4h4v3m-4 4v5m4-5v5M8 20v1m8-1v1',
    'printer': 'M7 9V3h10v6M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v7H7v-7Z',
    'share': 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
    'eye-off': 'M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.5 9.5 6-.5.8-1.6 2.3-3.2 3.6M6.4 7.6C4.6 8.9 3.2 10.7 2.5 12c1 1.5 4.5 6 9.5 6 1.5 0 2.9-.4 4.1-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
    'coins': 'M4 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3Zm0 0v5c0 1.7 3.1 3 7 3m-7-3v5c0 1.7 3.1 3 7 3m3-6.5c0-1.4 2.2-2.5 5-2.5M18 7v3',
    'pie': 'M12 3a9 9 0 1 0 9 9h-9V3Zm3 0a6 6 0 0 1 6 6h-6V3Z',
    'info': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9h.01',
    'smartphone': 'M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5Zm3 16h2',
    'backpack': 'M8 6V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1m-8 0h8a3 3 0 0 1 3 3v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V9a3 3 0 0 1 3-3Zm0 9h8v6H8v-6Zm4 0v2',
    'pill': 'M9.5 4.5a4.95 4.95 0 0 1 7 7l-5 5a4.95 4.95 0 0 1-7-7l5-5ZM7 9.5l7 7',
    'arrow-left': 'M20 12H4m6-6-6 6 6 6',
  };
}
