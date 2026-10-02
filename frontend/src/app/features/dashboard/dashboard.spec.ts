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
  it('shows four compact destinations before Today without a static travel image or connection blocks', () => {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.domain').length).toBe(4);
    expect(el.querySelector('.domains')!.compareDocumentPosition(el.querySelector('.today')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(el.querySelector('img, .connected, .suggestion')).toBeNull();
  });
  it('uses the actual upcoming trip and skips completed or cancelled trips', () => {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(req => req.url.endsWith('/reisen/trips/')).flush([
      { title: 'Fertig', status: 'DONE', start_date: '2099-01-01', end_date: '2099-01-05' },
      { title: 'Abgesagt', status: 'CANCELLED', start_date: '2099-01-02', end_date: '2099-01-05' },
      { title: 'Wien entdecken', destination: 'Wien', status: 'PLANNED', start_date: '2099-02-01', end_date: '2099-02-03', packing_total: 4, packing_packed: 2, tasks_total: 2, tasks_open: 1 },
    ]);
    f.detectChanges();
    expect(f.componentInstance.nextTrip()?.title).toBe('Wien entdecken');
    expect(f.nativeElement.querySelector('.next-trip').textContent).toContain('50 %');
    expect(f.nativeElement.querySelector('.next-trip').textContent).toContain('2 von 4 gepackt');
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
      http.expectOne(req => req.url.endsWith('/reisen/trips/')).flush([]);
      f.detectChanges();
      expect(f.nativeElement.querySelector('.next-trip').textContent).toContain('Noch keine bevorstehende Reise');
      expect(f.nativeElement.textContent).not.toContain('Berlin Wochenende');
    });

    it('with two or more areas chosen during onboarding, those tiles move first and are visibly marked — not just reordered', () => {
      const f = TestBed.createComponent(Dashboard);
      f.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      http.expectOne((req) => req.url.includes('/onboarding/profile/')).flush({
        needs_onboarding: false,
        completed: true,
        usage: 'personal',
        domains: ['reisen', 'finanzen'],
      });
      f.detectChanges();

      // Reihenfolge folgt der Auswahlreihenfolge im Onboarding (['reisen', 'finanzen']), nicht der
      // Standardreihenfolge der Kacheln (Finanzen/Haushalt/Organisation/Reisen).
      const tiles = Array.from(f.nativeElement.querySelectorAll('.domain h2')) as HTMLElement[];
      expect(tiles.slice(0, 2).map((t) => t.textContent)).toEqual([
        expect.stringContaining('Reisen'),
        expect.stringContaining('Finanzen'),
      ]);
      expect(tiles[0].textContent).toContain('für dich ausgewählt');
      expect(tiles[1].textContent).toContain('für dich ausgewählt');
      expect(tiles[2].textContent).not.toContain('für dich ausgewählt');
      expect(f.nativeElement.querySelectorAll('.domain--highlighted').length).toBe(2);
    });

    it('with only one area ever chosen, the dashboard keeps the default order — onboarding already redirected there directly', () => {
      const f = TestBed.createComponent(Dashboard);
      f.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      http.expectOne((req) => req.url.includes('/onboarding/profile/')).flush({
        needs_onboarding: false,
        completed: true,
        usage: 'personal',
        domains: ['reisen'],
      });
      f.detectChanges();

      expect(f.nativeElement.querySelectorAll('.domain--highlighted').length).toBe(0);
      const tiles = Array.from(f.nativeElement.querySelectorAll('.domain h2')) as HTMLElement[];
      expect(tiles[0].textContent).toContain('Finanzen');
    });
  });
});
