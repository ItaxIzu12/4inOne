import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { Dashboard } from './dashboard';
import { HAUSHALT_DATA_PROVIDER, HaushaltDataProvider } from '../haushalt/haushalt-data-provider';
import { HaushaltOverviewDto } from '../haushalt/haushalt-api.service';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService, AuthUser } from '../../core/auth/auth.service';

class FakeAuthService {
  readonly isAuthenticated = signal(true);
  readonly currentUser = signal<AuthUser | null>({ name: 'Mira', email: 'mira@example.com' });
}

// Wie in app.routes.ts (Demo-Route): eine eigene Datenquelle statt echter HTTP-Aufrufe für Haushalt — die
// Finanzen-/Organisation-Aufrufe unten laufen bewusst über den echten HttpClient (HttpClientTesting fängt sie ab),
// weil es für PrivateFinanceApi/OrganisationApi keinen zweiten, hier praktikablen Demo-Weg ohne Routen-Kontext gibt.
const HAUSHALT_STUB: Pick<HaushaltDataProvider, 'getOverview'> = {
  getOverview: () => of({ open_tasks: 3 } as HaushaltOverviewDto),
};

describe('Dashboard', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: HAUSHALT_DATA_PROVIDER, useValue: HAUSHALT_STUB },
      ],
    }),
  );
  it('labels seed data and exposes one heading and a skip link', () => {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    const el = f.nativeElement;
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('.skip-link')).toBeTruthy();
    expect(el.querySelector('.preview-note').textContent).toContain('Beispieldaten');
  });
  it('fetches finance data for the preview too, so the tile matches the actual demo/live numbers', () => {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    const request = TestBed.inject(HttpTestingController).expectOne((req) => req.url.includes('/finanzen/private/summary/'));
    request.flush({ available: '250.00', budget: '3000.00', has_data: true });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('250,00 € verfügbar');
    // Haushalt kommt über HAUSHALT_DATA_PROVIDER (der Stub oben), nicht über HttpClient — dieselbe Weiche wie in
    // app.routes.ts zwischen Demo- und echter Datenquelle.
    expect(f.nativeElement.textContent).toContain('3 offene Aufgaben');
  });
  it('offers four domain destinations and a working local packing preview', () => {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('.domain').length).toBe(4);
    f.nativeElement.querySelector('.suggestion button').click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="dialog"]').textContent).toContain('Packliste');
    const checkbox = f.nativeElement.querySelector('.packing-row input');
    checkbox.click();
    f.detectChanges();
    expect(f.componentInstance.packing()[0]).toBe(true);
  });
  it('has no search bar any more', () => {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.search')).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('Suche in 4inOne');
  });

  describe('real account', () => {
    beforeEach(() =>
      TestBed.configureTestingModule({
        imports: [Dashboard],
        providers: [
          provideRouter([]),
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: HAUSHALT_DATA_PROVIDER, useValue: HAUSHALT_STUB },
          { provide: AuthService, useValue: new FakeAuthService() },
        ],
      }),
    );

    it('never claims that Haushalt/Reisen still contain example data — that was true only before both were wired to real data', () => {
      const f = TestBed.createComponent(Dashboard);
      f.detectChanges();
      const note = f.nativeElement.querySelector('.preview-note').textContent;
      expect(note).toContain('eigenen, privaten Daten');
      expect(note).not.toContain('Beispieldaten');
    });

    it('an empty "Heute" list offers a CTA to add something, instead of a dead end', () => {
      const f = TestBed.createComponent(Dashboard);
      f.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      http.expectOne((req) => req.url.includes('/finanzen/private/summary/')).flush({ available: null, budget: '0', has_data: false });
      http.expectOne((req) => req.url.includes('/organisation') && req.url.includes('/today/')).flush({ items: [], event_count: 0 });
      f.detectChanges();

      expect(f.nativeElement.textContent).toContain('Heute ist noch nichts geplant.');
      const cta = (Array.from(f.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[]).find((a) =>
        a.textContent?.includes('Termin oder Aufgabe hinzufügen'),
      );
      expect(cta).toBeTruthy();
      expect(cta?.getAttribute('href')).toBe('/organisation');
    });
  });
});
