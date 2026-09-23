import { TestBed } from '@angular/core/testing';
import { LogoKompass } from './logo-kompass';

describe('LogoKompass', () => {
  it('renders an aria-hidden, flat single-color svg (no gradient, DESIGN_SYSTEM.md Version 3)', () => {
    const fixture = TestBed.createComponent(LogoKompass);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.getAttribute('aria-hidden')).toBe('true');
    // Kein Verlauf mehr — flache Einfarbigkeit über currentColor/--color-pine.
    expect(host.querySelector('linearGradient')).toBeNull();
    expect(host.querySelector('circle')).toBeTruthy();
    expect(host.querySelector('path')?.getAttribute('fill')).toBe('currentColor');
  });
});
