import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Dashboard } from './dashboard';
import { DemoFinanzenDataProvider } from '../finanzen/demo-finanzen-data-provider';
import { FINANZEN_DATA_PROVIDER } from '../finanzen/finanzen-data-provider';
import { FinanzenStateService } from '../finanzen/finanzen-state.service';

describe('Dashboard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      // FinanzenStateService ist bewusst NICHT providedIn:'root' (siehe
      // finanzen-state.service.ts) — in echten Routen kommt es aus den
      // route-level providers (app.routes.ts), im Test explizit hier.
      // DemoFinanzenDataProvider statt HttpClient-Mocking: liefert synchron
      // (of()) feste Beispieldaten, macht keine echten HTTP-Aufrufe.
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: FINANZEN_DATA_PROVIDER, useClass: DemoFinanzenDataProvider },
        FinanzenStateService,
      ],
    }).compileComponents();
  });

  it('creates and renders exactly one h1 (Begrüßung) with the skip-link as first focusable element', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.skip-link')).toBeTruthy();
    expect(compiled.querySelectorAll('h1').length).toBe(1);
  });

  it('shows the shared available balance with cents and links to expense entry', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#balance-heading')?.textContent?.trim()).toBe('145,00 €');
    expect(el.querySelector('.topbar a')?.getAttribute('href')).toBe('/finanzen?action=add');
    expect(el.querySelector('.mobile-expense')?.getAttribute('href')).toBe('/finanzen?action=add');
  });
  it('offers the four sections through one responsive navigation', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const labels = Array.from(el.querySelectorAll('.sidebar-nav__list a')).map((a) =>
      a.textContent?.trim(),
    );
    expect(labels).toEqual(['Heute', 'Finanzen', 'Haushalt', 'Kalender']);
    expect(el.querySelectorAll('.quick-links a').length).toBe(2);
  });
  it('does not present placeholder appointments as user data', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Zahnarzttermin');
    expect(fixture.nativeElement.querySelector('.week-section a').getAttribute('href')).toBe(
      '/app/organisation',
    );
  });
});
