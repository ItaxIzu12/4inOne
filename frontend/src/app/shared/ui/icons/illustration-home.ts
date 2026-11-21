import { Component } from '@angular/core';
@Component({
  selector: 'illustration-home',
  standalone: true,
  template: `<svg viewBox="0 0 180 165" fill="none" aria-hidden="true">
    <circle cx="101" cy="33" r="23" fill="#DDEEDC" />
    <rect x="25" y="77" width="71" height="71" rx="16" fill="#E9E5F6" />
    <rect x="91" y="92" width="67" height="56" rx="16" fill="#DDEEDC" />
    <path
      d="M17 82 60 43l43 39M83 95l42-32 40 32"
      stroke="#29374E"
      stroke-width="5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <rect x="51" y="110" width="21" height="38" rx="10" fill="white" />
    <circle cx="117" cy="117" r="3" fill="#29374E" />
    <circle cx="138" cy="117" r="3" fill="#29374E" />
    <path d="M120 129q8 7 16 0" stroke="#29374E" stroke-width="2.5" stroke-linecap="round" />
  </svg>`,
  styles: `
    :host {
      display: block;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
    }
  `,
})
export class IllustrationHome {}
