import { TestBed } from '@angular/core/testing';
import { Copyright } from './copyright';

describe('Copyright', () => {
  it('renders the current year and "Lumiknot"', () => {
    const fixture = TestBed.createComponent(Copyright);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain(String(new Date().getFullYear()));
    expect(text).toContain('Lumiknot');
    expect(text).not.toContain('Kompass');
  });
});
