import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ConnectedObject, ConnectionDto } from './connections-api.service';
import { ConnectionsSection } from './connections-section';

@Component({
  standalone: true,
  imports: [ConnectionsSection],
  template: `<app-connections objectType="SAVINGS_GOAL" [objectId]="id()" />`,
})
class Host {
  id = signal<number | string | null>(7);
}

const task = (over: Partial<ConnectedObject> = {}): ConnectedObject => ({
  type: 'TASK', id: 5, title: 'Modelle vergleichen', subtitle: 'Fällig 12.10.2030', domain: 'organisation', ...over,
});
const goal: ConnectedObject = { type: 'SAVINGS_GOAL', id: 7, title: 'Neue Waschmaschine', subtitle: '480,00 € von 700,00 €', domain: 'finanzen' };
const dto = (id: number, other: ConnectedObject): ConnectionDto => ({
  id, relation_type: 'TASK_FOR', relation_label: 'Aufgabe für', origin: 'MANUAL', created_at: '2026-09-25T10:00:00Z',
  source: goal, target: other, other,
});

describe('ConnectionsSection', () => {
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
    const button = (label: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim().includes(label)) as
        | HTMLButtonElement
        | undefined;
    const click = (label: string) => {
      const target = button(label);
      expect(target, `Button „${label}“`).toBeDefined();
      target!.click();
      fixture.detectChanges();
    };
    const flushList = (rows: ConnectionDto[]) => {
      http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/connections/') && r.params.get('object_id') === '7').flush(rows);
      fixture.detectChanges();
    };
    return { fixture, el, text, button, click, flushList };
  }

  beforeEach(() => (authenticated = true));
  afterEach(() => http.verify());

  it('shows a loading state, then the empty state with the call to action', () => {
    const { el, text, flushList } = setup();
    expect(text()).toContain('Verknüpfungen werden geladen');
    expect(el.querySelector('[role="status"]')).not.toBeNull();

    flushList([]);
    expect(text()).toContain('Noch nichts verknüpft.');
    expect(text()).toContain('Verbinde passende Aufgaben, Termine, Sparziele oder andere Bereiche');
    expect(text()).toContain('Verbindung hinzufügen');
    expect(text()).not.toContain('+ Verbindung');
  });

  it('lists connected items with kind, title and detail — without technical terms', () => {
    const { el, text, flushList } = setup();
    flushList([dto(1, task())]);
    expect(text()).toContain('Aufgabe');
    expect(text()).toContain('Modelle vergleichen');
    expect(text()).toContain('Fällig 12.10.2030');
    expect(text()).toContain('+ Verbindung hinzufügen');
    expect(text()).not.toMatch(/source|target|TASK_FOR|Connection/i);
    expect(el.querySelector('button[aria-label="Verknüpfung mit „Modelle vergleichen“ lösen"]')).not.toBeNull();
  });

  it('links every connection to the page that opens the connected object', () => {
    const { el, flushList } = setup();
    flushList([
      dto(1, task()),
      dto(2, task({ type: 'CALENDAR_EVENT', id: 9, title: 'Lieferung' })),
      dto(3, task({ type: 'HOUSEHOLD_TASK', id: 12, title: 'Alte Maschine entsorgen', domain: 'haushalt' })),
      dto(4, task({ type: 'SAVINGS_GOAL', id: 3, title: 'Sparen', domain: 'finanzen' })),
    ]);
    const hrefs = Array.from(el.querySelectorAll('a.connection__link')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/app/organisation?kind=task&id=5',
      '/app/organisation?kind=event&id=9',
      '/app/haushalt?tab=aufgaben&task=12',
      '/app/finanzen?goal=3',
    ]);
  });

  it('shows an error state and can retry', () => {
    const { text, click, flushList, fixture } = setup();
    http.expectOne((r) => r.url.endsWith('/connections/')).flush('x', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(text()).toContain('konnten nicht geladen werden');

    click('Erneut versuchen');
    flushList([dto(1, task())]);
    expect(text()).toContain('Modelle vergleichen');
  });

  it('renders nothing when logged out (demo) or when the object is not saved yet', () => {
    authenticated = false;
    const { el, fixture } = setup();
    expect(el.querySelector('.connections')).toBeNull();
    http.expectNone((r) => r.url.includes('/connections'));

    authenticated = true;
    fixture.componentInstance.id.set(null);
    fixture.detectChanges();
    expect(el.querySelector('.connections')).toBeNull();
  });

  it('ignores ids that are not real numbers (demo data)', () => {
    const { el, fixture } = setup();
    fixture.componentInstance.id.set('demo-task-1');
    fixture.detectChanges();
    http.match(() => true); // erste Abfrage mit id 7 verwerfen
    expect(el.querySelector('.connections')).toBeNull();
  });

  it('creates a connection in three steps and refreshes the list', () => {
    const { text, click, flushList, fixture, el } = setup();
    flushList([]);

    click('Verbindung hinzufügen');
    http.expectOne((r) => r.url.endsWith('/connections/options/')).flush([
      { type: 'TASK', label: 'Aufgabe', domain: 'organisation', relation_type: 'TASK_FOR' },
    ]);
    fixture.detectChanges();
    expect(text()).toContain('Was möchtest du verbinden?');

    click('Aufgabe');
    http.expectOne((r) => r.url.endsWith('/connections/candidates/') && r.params.get('target_type') === 'TASK').flush([task()]);
    fixture.detectChanges();
    expect(text()).toContain('Aufgabe auswählen');
    expect(el.querySelector('input[type="search"]')).toBeNull(); // wenige Treffer: keine Suche nötig

    click('Modelle vergleichen');
    expect(text()).toContain('Verknüpfung bestätigen');
    expect(text()).toContain('Beide bleiben unverändert');

    click('Verknüpfen');
    const post = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/connections/'));
    expect(post.request.body).toEqual({ source_type: 'SAVINGS_GOAL', source_id: 7, target_type: 'TASK', target_id: 5 });
    post.flush(dto(1, task()));
    fixture.detectChanges();

    flushList([dto(1, task())]); // Liste wird neu geladen
    expect(text()).toContain('Modelle vergleichen');
    expect(text()).not.toContain('Verknüpfung bestätigen');
    expect(el.querySelector('.sr-only')?.textContent).toContain('Mit „Modelle vergleichen“ verknüpft.');
  });

  it('explains a duplicate instead of failing silently', () => {
    const { text, click, flushList, fixture } = setup();
    flushList([]);
    click('Verbindung hinzufügen');
    http.expectOne((r) => r.url.endsWith('/options/')).flush([{ type: 'TASK', label: 'Aufgabe', domain: 'organisation', relation_type: 'TASK_FOR' }]);
    fixture.detectChanges();
    click('Aufgabe');
    http.expectOne((r) => r.url.endsWith('/candidates/')).flush([task()]);
    fixture.detectChanges();
    click('Modelle vergleichen');
    click('Verknüpfen');
    http.expectOne((r) => r.method === 'POST').flush({ detail: 'x' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(text()).toContain('Diese Verknüpfung besteht bereits.');
  });

  it('offers a search field once there are many candidates and searches on the server', () => {
    vi.useFakeTimers();
    try {
      const { el, click, flushList, fixture } = setup();
      flushList([]);
      click('Verbindung hinzufügen');
      http.expectOne((r) => r.url.endsWith('/options/')).flush([{ type: 'TASK', label: 'Aufgabe', domain: 'organisation', relation_type: 'TASK_FOR' }]);
      fixture.detectChanges();
      click('Aufgabe');
      http.expectOne((r) => r.url.endsWith('/candidates/')).flush(
        Array.from({ length: 9 }, (_, i) => task({ id: i + 1, title: `Aufgabe ${i + 1}` })),
      );
      fixture.detectChanges();

      const search = el.querySelector('input[type="search"]') as HTMLInputElement;
      expect(search).not.toBeNull();
      search.value = 'sieben';
      search.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(300);
      http.expectOne((r) => r.url.endsWith('/candidates/') && r.params.get('q') === 'sieben').flush([]);
      fixture.detectChanges();
      expect((el.textContent ?? '')).toContain('Nichts gefunden für „sieben“.');
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes a connection and updates the list', () => {
    const { el, text, flushList, fixture } = setup();
    flushList([dto(1, task()), dto(2, task({ id: 6, title: 'Angebot einholen' }))]);

    (el.querySelector('button[aria-label="Verknüpfung mit „Modelle vergleichen“ lösen"]') as HTMLButtonElement).click();
    http.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/connections/1/')).flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    const titles = Array.from(el.querySelectorAll('.connection__title')).map((n) => n.textContent?.trim());
    expect(titles).toEqual(['Angebot einholen']);
    expect(el.querySelector('.sr-only')?.textContent).toContain('Verknüpfung mit „Modelle vergleichen“ gelöst.');
    void text;
  });

  it('keeps the connection and shows an error when removing fails', () => {
    const { el, text, flushList, fixture } = setup();
    flushList([dto(1, task())]);
    (el.querySelector('button[aria-label^="Verknüpfung mit"]') as HTMLButtonElement).click();
    http.expectOne((r) => r.method === 'DELETE').flush('x', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(text()).toContain('Modelle vergleichen');
    expect(text()).toContain('konnte nicht gelöst werden');
  });

  it('keyboard: focus moves into each step, Escape closes only the assistant and returns focus', async () => {
    vi.useFakeTimers();
    try {
      const { el, click, flushList, fixture } = setup();
      flushList([]);
      click('Verbindung hinzufügen');
      http.expectOne((r) => r.url.endsWith('/options/')).flush([{ type: 'TASK', label: 'Aufgabe', domain: 'organisation', relation_type: 'TASK_FOR' }]);
      fixture.detectChanges();
      vi.advanceTimersByTime(10);
      expect(document.activeElement?.tagName).toBe('H4');

      let bubbled = false;
      el.addEventListener('keydown', () => (bubbled = true));
      (el.querySelector('.wizard') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      await Promise.resolve();
      expect(bubbled).toBe(false); // erreicht den umgebenden Dialog nicht
      expect(el.querySelector('.wizard')).toBeNull();
      vi.advanceTimersByTime(10);
      fixture.detectChanges();
      expect(el.querySelector('.connections__add')).not.toBeNull();
      expect(document.activeElement).toBe(el.querySelector('.connections__add'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses real buttons for every action so keyboard and screen readers work', () => {
    const { el, flushList } = setup();
    flushList([dto(1, task())]);
    const actions = Array.from(el.querySelectorAll('.connections button'));
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) expect(action.getAttribute('type')).toBe('button');
    expect(el.querySelector('section')?.getAttribute('aria-labelledby')).toBe(el.querySelector('h3')?.id);
  });
});
