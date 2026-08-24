import { TestBed } from '@angular/core/testing';
import { IconFinanzen } from './icon-finanzen';
import { IconHaushalt } from './icon-haushalt';
import { IconOrganisation } from './icon-organisation';

describe('Section icons', () => {
  it('IconFinanzen renders an aria-hidden svg using currentColor', () => {
    const fixture = TestBed.createComponent(IconFinanzen);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor');
  });

  it('IconHaushalt renders an aria-hidden svg using currentColor', () => {
    const fixture = TestBed.createComponent(IconHaushalt);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor');
  });

  it('IconOrganisation renders an aria-hidden svg using currentColor', () => {
    const fixture = TestBed.createComponent(IconOrganisation);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor');
  });
});
