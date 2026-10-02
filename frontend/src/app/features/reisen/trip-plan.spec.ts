import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SuggestionDto } from '../../shared/connections/suggestions-api.service';
import { TripPlan, TripPlanTarget } from './trip-plan';

@Component({
  standalone: true,
  imports: [TripPlan],
  template: `<app-trip-plan [tripId]="id()" (openTab)="opened.set($event)" />`,
})
class Host {
  id = signal(4);
  opened = signal<TripPlanTarget | null>(null);
}

const goal: SuggestionDto = {
  key: 'trip:4:goal',
  kind: 'TRIP_SAVINGS_GOAL',
  title: 'Für „Lissabon“ sparen',
  reason: 'Das Budget der Reise ist 900,00 €. Bis zur Abreise bleiben 3 Monate – das sind 300,00 € pro Monat.',
  trip: { id: 4, title: 'Lissabon' },
  actions: [{ action: 'create_goal', label: 'Sparziel anlegen' }],
  detail: {},
};
const chore: SuggestionDto = {
  key: 'trip:4:htask:9',
  kind: 'TRIP_HOUSEHOLD_TASK',
  title: '„Müll“ fällt in deine Reise',
  reason: 'Sie ist am 12.11.2026 fällig – da bist du in Lissabon.',
  trip: { id: 4, title: 'Lissabon' },
  actions: [
    { action: 'postpone', label: 'Auf 18.11.2026 verschieben' },
    { action: 'hand_over', label: 'Jemand anderes übernimmt', needs_member: true },
    { action: 'link', label: 'Nur merken' },
  ],
  detail: { members: [{ id: 2, name: 'Ben' }] },
};
const packing: SuggestionDto = {
  key: 'trip:4:packing',
  kind: 'TRIP_PACKING',
  title: 'Packliste anlegen',
  reason: '„Lissabon“ beginnt in 3 Tagen, und die Packliste ist noch leer.',
  trip: { id: 4, title: 'Lissabon' },
  actions: [{ action: 'open_packing', label: 'Packliste öffnen', navigate: true }],
  detail: {},
};

describe('TripPlan', () => {
  let http: HttpTestingController;
  let authenticated = true;

  function setup() {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAuthenticated: () => authenticated } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = () => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    const click = (label: string) => {
      const target = Array.from(el.querySelectorAll('button')).find((b) =>
        (b.textContent ?? '').replace(/\s+/g, ' ').trim().includes(label),
      );
      expect(target, `Button „${label}“`).toBeDefined();
      target!.click();
      fixture.detectChanges();
    };
    const suggestionsRequest = (): TestRequest =>
      http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/connections/suggestions/') && r.params.get('trip') === '4');
    const flushSuggestions = (rows: SuggestionDto[]) => {
      suggestionsRequest().flush(rows);
      fixture.detectChanges();
    };
    const flushConnections = () => {
      for (const r of http.match((req) => req.url.endsWith('/connections/') && req.method === 'GET')) r.flush([]);
      fixture.detectChanges();
    };
    return { fixture, el, text, click, flushSuggestions, flushConnections };
  }

  beforeEach(() => (authenticated = true));
  afterEach(() => http.verify());

  it('explains every suggestion and lists what is already connected to the trip', () => {
    const { text, flushSuggestions, flushConnections } = setup();
    flushSuggestions([packing, chore, goal]);
    flushConnections();

    expect(text()).toContain('Nächste Schritte');
    expect(text()).toContain('Packliste anlegen');
    expect(text()).toContain('da bist du in Lissabon');
    expect(text()).toContain('300,00 € pro Monat');
    expect(text()).toContain('Verknüpft');
  });

  it('accepting a suggestion posts the action, shows the result and reloads', () => {
    const { text, click, flushSuggestions, flushConnections } = setup();
    flushSuggestions([goal]);
    flushConnections();

    click('Sparziel anlegen');
    const accept = http.expectOne((r) => r.url.endsWith('/connections/suggestions/accept/'));
    expect(accept.request.body).toEqual({ key: 'trip:4:goal', action: 'create_goal' });
    accept.flush({ detail: 'Sparziel „Reise: Lissabon“ angelegt, 300,00 € pro Monat.' });
    flushSuggestions([]);
    flushConnections();

    expect(text()).toContain('Sparziel „Reise: Lissabon“ angelegt');
    expect(text()).toContain('für diese Reise gibt es gerade nichts zu tun');
  });

  it('handing over asks who takes it before anything is saved', () => {
    const { text, click, flushSuggestions, flushConnections } = setup();
    flushSuggestions([chore]);
    flushConnections();

    click('Jemand anderes übernimmt');
    expect(text()).toContain('Wer übernimmt?');
    click('Übergeben');
    expect(text()).toContain('Bitte wähle aus, wer die Aufgabe übernimmt.');
    http.expectNone((r) => r.url.endsWith('/accept/'));
  });

  it('navigation actions open the tab instead of calling the backend', () => {
    const { fixture, click, flushSuggestions, flushConnections } = setup();
    flushSuggestions([packing]);
    flushConnections();

    click('Packliste öffnen');
    expect(fixture.componentInstance.opened()).toBe('packliste');
    http.expectNone((r) => r.url.endsWith('/accept/'));
  });

  it('dismissing removes the suggestion', () => {
    const { fixture, text, click, flushSuggestions, flushConnections } = setup();
    flushSuggestions([chore]);
    flushConnections();

    click('Nicht vorschlagen');
    const dismiss = http.expectOne((r) => r.url.endsWith('/connections/suggestions/dismiss/'));
    expect(dismiss.request.body).toEqual({ key: 'trip:4:htask:9' });
    dismiss.flush(null);
    fixture.detectChanges();
    expect(text()).not.toContain('„Müll“ fällt in deine Reise');
  });

  it('renders nothing and asks nothing without a login (demo)', () => {
    authenticated = false;
    const { el } = setup();
    expect(el.querySelector('.trip-plan')).toBeNull();
  });
});
