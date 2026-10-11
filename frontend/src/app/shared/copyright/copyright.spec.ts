import { TestBed } from '@angular/core/testing';
import { Copyright } from './copyright';

describe('Copyright', () => {
  it('renders the current year and "4inOne"', () => {
    const fixture = TestBed.createComponent(Copyright);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain(String(new Date().getFullYear()));
    expect(text).toContain('4inOne');
    expect(text).not.toContain('Kompass');
  });
});
