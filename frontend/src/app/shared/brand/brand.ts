import { Component } from '@angular/core';
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
      color: #101d40;
    }
    .mark {
      display: grid;
      grid-template-columns: repeat(2, 17px);
      gap: 3px;
    }
    .mark i {
      height: 17px;
      border-radius: 9px 9px 3px 9px;
      background: #76cda4;
    }
    .mark i:nth-child(2) {
      background: #99c5ff;
      transform: rotate(90deg);
    }
    .mark i:nth-child(3) {
      background: #ffd175;
      transform: rotate(-90deg);
    }
    .mark i:nth-child(4) {
      background: #efa1c2;
      transform: rotate(180deg);
    }
  `,
})
export class Brand {}
