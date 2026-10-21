import { Component } from '@angular/core';

/**
 * Das 4inOne-Logo: vier weiche Felder (je ein Bereich, die enge Ecke zeigt zur Mitte) und der Name.
 * Farben = Bereichsfarben (shared/styles/_editorial.scss): Finanzen oben links, Reisen oben rechts,
 * Organisation unten links, Haushalt unten rechts. Favicon (public/favicon.svg) und App-Icons zeigen dasselbe Zeichen.
 */
@Component({
  selector: 'app-brand',
  standalone: true,
  template: `<span class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span
    ><span>4inOne</span>`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      font-size: 27px;
      font-weight: 750;
      letter-spacing: -1px;
      color: #121826;
    }
    .mark {
      display: grid;
      grid-template-columns: repeat(2, 17px);
      gap: 3px;
    }
    .mark i {
      height: 17px;
      border-radius: 9px 9px 3px 9px;
      background: #0f9d6b;
    }
    .mark i:nth-child(2) {
      background: #3b6fe0;
      transform: rotate(90deg);
    }
    .mark i:nth-child(3) {
      background: #e3961a;
      transform: rotate(-90deg);
    }
    .mark i:nth-child(4) {
      background: #e04f78;
      transform: rotate(180deg);
    }
  `,
})
export class Brand {}
