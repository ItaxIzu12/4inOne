import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Einstellungen } from './einstellungen';

describe('Einstellungen', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Einstellungen],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('has a skip-link, exactly one h1 and renders all account/legal rows plus Abmelden', () => {
    const fixture = TestBed.createComponent(Einstellungen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.skip-link')).toBeTruthy();
    expect(compiled.querySelectorAll('h1').length).toBe(1);

    const rows = compiled.querySelectorAll('.settings-row');
    // 3 Konto-Zeilen + 4 Rechtliches-Zeilen + 1 Abmelden-Button
    expect(rows.length).toBe(8);
    expect(compiled.textContent).toContain('Abmelden');
    expect(compiled.textContent).toContain('Barrierefreiheitserklärung');
  });

  it('renders the copyright line at the bottom', () => {
    const fixture = TestBed.createComponent(Einstellungen);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-copyright')).toBeTruthy();
  });
});
