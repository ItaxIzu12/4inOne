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
import { TodayOverview } from './today-api.service';

class FakeAuthService {
  readonly isAuthenticated = signal(true);
  readonly currentUser = signal<AuthUser | null>({ name: 'Mira', email: 'mira@example.com' });
}

// Wie in app.routes.ts (Demo-Route): eine eigene Datenquelle statt echter HTTP-Aufrufe für Haushalt — die
// Finanzen-/Organisation-Aufrufe unten laufen bewusst über den echten HttpClient (HttpClientTesting fängt sie ab),
// weil es für PrivateFinanceApi/OrganisationApi keinen zweiten, hier praktikablen Demo-Weg ohne Routen-Kontext gibt.
const HAUSHALT_STUB: Pick<HaushaltDataProvider, 'getOverview'> = {
  getOverview: () => of({ open_tasks: 10, overdue_tasks: 1, summary: { due_today: 3 }, deadlines: [] } as unknown as HaushaltOverviewDto),
};

const overview = (over: Partial<TodayOverview> = {}): TodayOverview => ({
  date: '2026-10-02',
  timezone: 'Europe/Berlin',
  organisation: { date: '2026-10-02', timezone: 'Europe/Berlin', items: [], event_count: 0, open_task_count: 0, overdue_count: 0 },
  haushalt: null,
  reisen: { current: null, upcoming: null, events: [] },
  finanzen: { month: '2026-10', budget: null, expenses: '0.00', available: null, spent_today: '0.00' },
  suggestions: [],
  ...over,
});

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
  it('fetches finance data for the preview too, so the budget shows the actual demo/live number', () => {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    const request = TestBed.inject(HttpTestingController).expectOne((req) => req.url.includes('/finanzen/private/summary/'));
    request.flush({ available: '250.00', total: '3000.00', budget: '3000.00', expenses: '2750.00', has_data: true });
    f.detectChanges();
    const budget = f.nativeElement.querySelector('.budget').textContent;
    expect(budget).toContain('250,00 € übrig');
    expect(budget).toContain('von 3.000,00 €');
  });
  it('Kommandozentrale: overview band (budget, Demnächst) above today, no old area menu, no static image', () => {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.domain, .domains').length).toBe(0);
    // Seit 22.10.2026: das Überblick-Band (Heute · Budget · Reise · Haushalt) steht über dem Tagesplan
    expect(el.querySelectorAll('.kpis .kpi').length).toBeGreaterThanOrEqual(2);
    expect(el.querySelector('.budget')!.compareDocumentPosition(el.querySelector('.soon')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(el.querySelector('.soon')!.compareDocumentPosition(el.querySelector('.today')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(el.querySelector('img, .connected, .suggestion')).toBeNull();
  });
  it('lists the latest real bookings with category, date and signed amount', () => {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    TestBed.inject(HttpTestingController).expectOne((req) => req.url.includes('/finanzen/private/summary/')).flush({
      available: '250.00', total: '3000.00', budget: '3000.00', expenses: '2750.00', has_data: true,
      categories: [{ id: 7, name: 'Lebensmittel', color: '#17694f', amount: '28.30' }],
      recent: [
        { id: 1, amount: '28.30', type: 'EXPENSE', category: 7, date: '2026-10-21', note: 'REWE', currency: 'EUR' },
        { id: 2, amount: '3420.00', type: 'INCOME', category: 99, date: '2026-10-01', note: '', currency: 'EUR' },
      ],
    });
    f.detectChanges();
    const rows = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.ledger__row')).map((r) => r.textContent!.replace(/\s+/g, ' ').trim());
    expect(rows[0]).toContain('REWE');
    expect(rows[0]).toContain('Lebensmittel · 21.10.');
    expect(rows[0]).toContain('− 28,30 €');
    expect(rows[1]).toContain('Einnahme');
    expect(rows[1]).toContain('+ 3.420,00 €');
  });
  it('uses the actual upcoming trip and skips completed or cancelled trips', () => {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(req => req.url.endsWith('/reisen/trips/')).flush([
      { title: 'Fertig', status: 'DONE', start_date: '2099-01-01', end_date: '2099-01-05' },
      { title: 'Abgesagt', status: 'CANCELLED', start_date: '2099-01-02', end_date: '2099-01-05' },
      { title: 'Wien entdecken', destination: 'Wien', status: 'PLANNED', start_date: '2099-02-01', end_date: '2099-02-03', budget_amount: null, packing_total: 4, packing_packed: 2, tasks_total: 2, tasks_open: 1 },
    ]);
    f.detectChanges();
    expect(f.componentInstance.nextTrip()?.title).toBe('Wien entdecken');
    // „Demnächst“ zeigt die nächste Reise mit Stand der Vorbereitung; Details stehen in Reisen.
    const travel = f.nativeElement.querySelector('.soon .travel').textContent;
    expect(travel).toContain('Wien');
    expect(travel).toMatch(/in \d+ Tagen/);
    expect(travel).toContain('1 Aufgabe offen');
    expect(travel).toContain('2 / 4 gepackt');
  });
  it('keeps the header search switched off for now (searchEnabled = false)', () => {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.dashboard-search')).toBeNull();
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
      http.expectOne((req) => req.url.endsWith('/api/v1/today/')).flush(overview());
      f.detectChanges();

      expect(f.nativeElement.textContent).toContain('Heute ist nichts Dringendes offen');
      const cta = (Array.from(f.nativeElement.querySelectorAll('.today button')) as HTMLButtonElement[]).find((b) => b.textContent?.includes('Hinzufügen'));
      expect(cta).toBeTruthy();
      cta!.click();
      f.detectChanges();
      expect(f.nativeElement.querySelector('.quick__list')).toBeTruthy();
      http.expectOne(req => req.url.includes('/reisen/trips/')).flush([]);
      f.detectChanges();
      expect(f.nativeElement.querySelector('.soon').textContent).toContain('keine Reise und keine Frist');
      expect(f.nativeElement.querySelector('.for-you')).toBeNull();
      expect(f.nativeElement.textContent).not.toContain('Berlin Wochenende');
    });

    it('evening: overdue stays on top, the stage shows the remaining untimed task, past appointments move to the end as „vorbei“', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 2, 18, 0));
      const f = TestBed.createComponent(Dashboard);
      f.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      http.expectOne((req) => req.url.endsWith('/api/v1/today/')).flush(
        overview({
          organisation: {
            date: '2026-10-02', timezone: 'Europe/Berlin', event_count: 1, open_task_count: 0, overdue_count: 0,
            items: [{ kind: 'event', id: 1, title: 'Zahnarzt', at: '2026-10-02T14:00:00+02:00', overdue: false, location: 'Praxis' }],
          },
          haushalt: {
            task_count: 2, shopping_open: 3,
            tasks: [
              { id: 7, title: 'Müll rausbringen', due_date: '2026-09-30', due_time: null, overdue: true, mine: true },
              { id: 8, title: 'Blumen gießen', due_date: '2026-10-02', due_time: null, overdue: false, mine: false },
            ],
            deadlines: [{ entry_id: 3, art: 'kuendigung', title: 'Kündigen bis: Strom', date: '2026-10-09', days: 7 }],
          },
          reisen: {
            current: null, upcoming: null,
            events: [{ id: 4, trip_id: 9, trip_title: 'Wien', title: 'Zug nach Wien', at: '2026-10-02T09:00:00+02:00', location: '' }],
          },
        }),
      );
      f.detectChanges();

      const rows = Array.from(f.nativeElement.querySelectorAll('.today-row strong') as NodeListOf<HTMLElement>).map((r) => r.textContent);
      expect(rows).toEqual([
        'Müll rausbringen', 'Blumen gießen', 'Zug nach Wien', 'Zahnarzt',
      ]);
      expect(f.nativeElement.querySelector('.today-list--late').textContent).toContain('Müll rausbringen');
      expect(f.nativeElement.querySelector('.today-row--lead').textContent).toContain('Blumen gießen');
      expect(f.nativeElement.querySelector('#today-list').textContent).toContain('vorbei');
      // Überfällig sagt die Gruppe (und der Screenreader-Text der Zeile); der Hinweis nennt den Bereich, ohne Doppelung.
      expect(f.nativeElement.querySelector('.plan__group--late').textContent).toContain('Überfällig');
      expect(f.nativeElement.querySelector('.today-list--late').textContent).toContain('überfällig · Haushalt');
      expect(f.nativeElement.querySelector('.today-list--late').textContent).not.toContain('Haushalt · Haushalt');
      // Spätere Fristen gehören nicht in „Heute“.
      expect(f.nativeElement.querySelector('.today').textContent).not.toContain('Kündigen bis: Strom');
      vi.useRealTimers();
    });

    it('highlights the next future appointment ahead of overdue tasks, without duplicating or hiding them', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 2, 10, 0));
      try {
        const f = TestBed.createComponent(Dashboard);
        f.componentInstance.organisationToday.set({ date: '2026-10-02', timezone: 'Europe/Berlin', event_count: 2, open_task_count: 1, overdue_count: 1,
          items: [
            { kind: 'task', id: 1, title: 'Überfällig', at: '2026-10-01T08:00:00', overdue: true },
            { kind: 'event', id: 2, title: 'Vorbei', at: '2026-10-02T09:00:00', overdue: false },
            { kind: 'event', id: 3, title: 'Arzt', at: '2026-10-02T11:00:00', overdue: false },
          ] });
        expect(f.componentInstance.lead?.title).toBe('Arzt');
        expect(f.componentInstance.overdue.map(r => r.title)).toEqual(['Überfällig']);
        expect(f.componentInstance.rest.map(r => r.title)).toEqual(['Vorbei']);
      } finally { vi.useRealTimers(); }
    });

    it('when everything with a time is behind you, the stage says so honestly instead of showing a past appointment', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 2, 21, 0));
      try {
        const f = TestBed.createComponent(Dashboard);
        f.componentInstance.organisationToday.set({ date: '2026-10-02', timezone: 'Europe/Berlin', event_count: 1, open_task_count: 0, overdue_count: 0,
          items: [{ kind: 'event', id: 2, title: 'Badminton', at: '2026-10-02T19:00:00', overdue: false }] });
        f.componentInstance.todayLoading.set(false);
        f.detectChanges();
        expect(f.componentInstance.lead).toBeNull();
        expect(f.nativeElement.querySelector('.today').textContent).toContain('Für heute ist nichts mehr geplant');
        expect(f.nativeElement.querySelector('#today-list').textContent).toContain('vorbei');
      } finally { vi.useRealTimers(); }
    });

    it('the line under the greeting counts what is still open today and what is overdue', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 2, 10, 0));
      try {
        const f = TestBed.createComponent(Dashboard);
        const c = f.componentInstance;
        c.todayLoading.set(false);
        c.organisationToday.set({ date: '2026-10-02', timezone: 'Europe/Berlin', event_count: 2, open_task_count: 2, overdue_count: 1, items: [
          { kind: 'task', id: 1, title: 'Steuer', at: '2026-09-30T08:00:00', overdue: true },
          { kind: 'event', id: 2, title: 'Vorbei', at: '2026-10-02T09:00:00', overdue: false },
          { kind: 'event', id: 3, title: 'Arzt', at: '2026-10-02T11:00:00', overdue: false },
        ] });
        expect(c.dayLine).toContain('1 Punkt heute, 1 überfällig');
        expect(c.later).toEqual([]);
        expect(c.past.map((r) => r.title)).toEqual(['Vorbei']);
      } finally { vi.useRealTimers(); }
    });

    it('a new account sees three first steps instead of empty boxes; each ticks off with real data, all done → gone', () => {
      const f = TestBed.createComponent(Dashboard);
      f.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      http.expectOne((req) => req.url.includes('/finanzen/private/summary/')).flush({ available: null, total: null, budget: null, expenses: '0.00', has_data: false });
      http.expectOne((req) => req.url.endsWith('/api/v1/today/')).flush(overview());
      http.expectOne((req) => req.url.includes('/reisen/trips/')).flush([]);
      f.detectChanges();
      const steps = f.nativeElement.querySelector('.steps');
      expect(steps.textContent).toContain('0 von 3 erledigt');
      expect(steps.querySelectorAll('li').length).toBe(3);
      f.componentInstance.finance.set({ available: '100.00', total: '500.00', budget: '500.00', expenses: '400.00', has_data: true } as never);
      f.componentInstance.trips.set([{ id: 1 } as never]);
      f.componentInstance.organisationToday.set({ date: '2026-10-02', timezone: 'Europe/Berlin', event_count: 1, open_task_count: 0, overdue_count: 0, items: [] });
      f.detectChanges();
      expect(f.nativeElement.querySelector('.steps')).toBeNull();
    });
    it('keeps the start page minimal: greeting, today, Demnächst, Für dich and Budget — no tiles, no extra lists', () => {
      const f = TestBed.createComponent(Dashboard);
      f.detectChanges();
      const el = f.nativeElement as HTMLElement;
      expect(el.querySelectorAll('.domain').length).toBe(0);
      expect(el.querySelector('.today')).toBeTruthy();
      expect(el.querySelector('.soon')).toBeTruthy();
      expect(el.querySelector('.budget')).toBeTruthy();
      expect(el.querySelector('.tasks, .month, .transactions, .next-trip, .suggestions, img')).toBeNull();
    });
  });
});
