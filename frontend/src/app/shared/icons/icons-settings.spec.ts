import { TestBed } from '@angular/core/testing';
import { IconBackToTop } from './icon-back-to-top';
import { IconChevron } from './icon-chevron';
import { IconDocument } from './icon-document';
import { IconLegal } from './icon-legal';
import { IconLogout } from './icon-logout';
import { IconProfile } from './icon-profile';
import { IconSessions } from './icon-sessions';
import { IconSettings } from './icon-settings';
import { IconTwoFactor } from './icon-two-factor';

const ICONS = [
  IconBackToTop,
  IconChevron,
  IconDocument,
  IconLegal,
  IconLogout,
  IconProfile,
  IconSessions,
  IconSettings,
  IconTwoFactor,
];

describe('Settings/legal icons', () => {
  for (const IconType of ICONS) {
    it(`${IconType.name} renders an aria-hidden svg using currentColor`, () => {
      const fixture = TestBed.createComponent(IconType);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.getAttribute('aria-hidden')).toBe('true');
      expect(host.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor');
    });
  }
});
