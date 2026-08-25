import { TestBed } from '@angular/core/testing';
import { LogoKompass } from './logo-kompass';

describe('LogoKompass', () => {
  it('renders an aria-hidden svg and gives each instance a unique gradient id', () => {
    const a = TestBed.createComponent(LogoKompass);
    const b = TestBed.createComponent(LogoKompass);
    a.detectChanges();
    b.detectChanges();

    const hostA = a.nativeElement as HTMLElement;
    expect(hostA.getAttribute('aria-hidden')).toBe('true');

    const gradientIdA = hostA.querySelector('linearGradient')?.getAttribute('id');
    const gradientIdB = (b.nativeElement as HTMLElement).querySelector('linearGradient')?.getAttribute('id');
    expect(gradientIdA).toBeTruthy();
    expect(gradientIdA).not.toBe(gradientIdB);
    expect(hostA.querySelector('rect')?.getAttribute('fill')).toBe(`url(#${gradientIdA})`);
  });
});
