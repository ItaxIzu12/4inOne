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
  | 'device';
let nextIconId = 0;
@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <defs>
      <linearGradient [id]="gradientId" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="white" stop-opacity=".38" />
        <stop offset=".45" stop-color="currentColor" />
        <stop offset="1" stop-color="currentColor" stop-opacity=".8" />
      </linearGradient>
    </defs>
    @switch (name()) {
      @case ('finance') {
        <path d="M4 7V5Q4 3 7 3L19 2v5" fill="currentColor" />
        <rect x="3" y="6" width="19" height="15" rx="3" [attr.fill]="paint" stroke-width=".6" />
        <path d="M17 11h5v6h-5a3 3 0 0 1 0-6" fill="#d7f7cf" stroke-width=".8" />
        <circle cx="18" cy="14" r="1" fill="currentColor" stroke="none" />
        <path d="M6 8h12" stroke="white" stroke-opacity=".6" stroke-width="1" />
      }
      @case ('household') {
        <path
          d="M2 10 12 2l10 8-2 3-2-2v10h-5v-7h-3v7H5V11l-2 2Z"
          [attr.fill]="paint"
          stroke-width=".5"
        />
      }
      @case ('home') {
        <path
          d="M2 10 12 2l10 8-2 3-2-2v10h-5v-7h-3v7H5V11l-2 2Z"
          [attr.fill]="paint"
          stroke-width=".5"
        />
      }
      @case ('calendar') {
        <rect x="3" y="5" width="18" height="17" rx="3" [attr.fill]="paint" stroke-width=".6" />
        <path d="M6 10h12v9H6Z" fill="#f6efff" stroke="none" />
        <path d="M8 2v5m8-5v5" stroke-width="2.4" />
        <path d="M8 13h2m4 0h2m-8 3h2m4 0h2" stroke-width="1.8" />
      }
      @case ('travel') {
        <path
          d="m3 3 10 4 5-5q3-2 4 0t-1 4l-5 5 4 10-2 1-6-8-5 4v4l-2 1-1-5-4-2 2-2 4 1 4-5-9-5Z"
          [attr.fill]="paint"
          stroke-width=".4"
        />
      }
      @case ('people') {
        <circle cx="9" cy="7" r="4" [attr.fill]="paint" stroke="none" />
        <circle cx="18" cy="9" r="3" fill="currentColor" opacity=".7" stroke="none" />
        <path
          d="M1 21v-3a8 8 0 0 1 16 0v3ZM18 14q5 0 5 6v1h-4v-3Z"
          [attr.fill]="paint"
          stroke="none"
        />
      }
      @case ('bars') {
        <path d="M5 15v6m7-17v17m7-11v11" stroke-width="4" />
      }
      @case ('bulb') {
        <path d="M8 16a8 8 0 1 1 8 0l-1 3H9Z" [attr.fill]="paint" stroke-width=".5" />
        <path d="M9 20h6m-5 2h4" stroke-width="2" />
      }
      @default {
        <path [attr.d]="paths[name()]" />
      }
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
  readonly gradientId = `icon-depth-${nextIconId++}`;
  readonly paint = `url(#${this.gradientId})`;
  readonly name = input<IconName>('home');
  readonly paths: Record<IconName, string> = {
    bars: 'M5 14v7m7-18v18m7-12v12',
    trash: 'M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5',
    basket: 'M3 9h18l-2 11H5L3 9Zm4 0 3-5m7 5-3-5M9 13v3m6-3v3',
    device: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm-1 5h14M9 5.5h.01M12 15a3 3 0 1 0 0 .01',
    home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
    household: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
    finance: 'M20 7H5a2 2 0 0 1 0-4h13v4M3 5v14a2 2 0 0 0 2 2h15V7m0 5h-6v5h6m-3-2.5h.01',
    calendar: 'M4 5h16v16H4ZM8 3v4m8-4v4M4 10h16M8 14h2m4 0h2m-8 3h2',
    travel: 'm21 3-6 18-4-8-8-4 18-6ZM11 13l10-10',
    people:
      'M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6-5a3 3 0 0 1 0 6M3 21v-3a6 6 0 0 1 12 0v3Zm14-7a5 5 0 0 1 4 5v2',
    settings:
      'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
    bell: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 3h4M12 2v2',
    search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',
    link: 'm10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1',
    bulb: 'M9 18h6m-6 3h6M8 15a7 7 0 1 1 8 0l-1 3H9l-1-3Z',
    check: 'm5 12 4 4L19 6',
    plus: 'M12 4v16M4 12h16',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    arrow: 'm9 5 7 7-7 7',
    leaf: 'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM12 9l-4 5 4 3 4-3-4-5Zm-4 5-4 5q8 4 16 0l-4-5M12 9v8',
  };
}
