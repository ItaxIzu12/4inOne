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

  it('has a skip-link, exactly one h1 and renders the account rows plus Abmelden', () => {
    const fixture = TestBed.createComponent(Einstellungen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.skip-link')).toBeTruthy();
    expect(compiled.querySelectorAll('h1').length).toBe(1);

    const rows = compiled.querySelectorAll('.settings-row');
    // 3 Konto-Zeilen + 1 Abmelden-Button — Rechtliches lebt im Footer, nicht hier.
    expect(rows.length).toBe(4);
    expect(compiled.textContent).toContain('Abmelden');
  });

  it('does not duplicate the legal links as settings rows (they live in the global footer, see app.spec.ts)', () => {
    const fixture = TestBed.createComponent(Einstellungen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).not.toContain('Rechtliches');
    expect(compiled.querySelector('app-footer')).toBeNull();
  });
});
