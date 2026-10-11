import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ConnectedObject, ConnectionDto, LinkSuggestionDto } from './connections-api.service';
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
  id, can_delete: true, relation_type: 'TASK_FOR', relation_label: 'Aufgabe für', origin: 'MANUAL', created_at: '2026-09-25T10:00:00Z',
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
    const flushList = (rows: ConnectionDto[], suggestions: LinkSuggestionDto[] = []) => {
      http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/connections/') && r.params.get('object_id') === '7').flush(rows);
      http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/link-suggestions/') && r.params.get('object_id') === '7').flush(suggestions);
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
    expect(text()).toContain('beide bleiben dabei unverändert');
    expect(text()).toContain('+ Verknüpfen');
    expect(text()).toContain('Verknüpft mit');
  });

  it('lists connected items with kind, title and detail — without technical terms', () => {
    const { el, text, flushList } = setup();
    flushList([dto(1, task())]);
    expect(text()).toContain('Aufgabe');
    expect(text()).toContain('Modelle vergleichen');
    expect(text()).toContain('Fällig 12.10.2030');
    expect(text()).toContain('+ Verknüpfen');
    expect(text()).not.toMatch(/source|target|TASK_FOR|Connection/i);
    expect(el.querySelector('button[aria-label^="Verbindung zu „Modelle vergleichen“ entfernen"]')?.textContent?.trim()).toBe('Verbindung entfernen');
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
      '/organisation?kind=task&id=5',
      '/organisation?kind=event&id=9',
      '/haushalt?tab=aufgaben&task=12',
      '/finanzen?goal=3',
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

    click('+ Verknüpfen');
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
    click('+ Verknüpfen');
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
      click('+ Verknüpfen');
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

    (el.querySelector('button[aria-label^="Verbindung zu „Modelle vergleichen“ entfernen"]') as HTMLButtonElement).click();
    http.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/connections/1/')).flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    const titles = Array.from(el.querySelectorAll('.connection__title')).map((n) => n.textContent?.trim());
    expect(titles).toEqual(['Angebot einholen']);
    expect(el.querySelector('.sr-only')?.textContent).toContain('Verbindung zu „Modelle vergleichen“ entfernt. Beide Einträge bleiben erhalten.');
    void text;
  });

  it('keeps the connection and shows an error when removing fails', () => {
    const { el, text, flushList, fixture } = setup();
    flushList([dto(1, task())]);
    (el.querySelector('button[aria-label^="Verbindung zu"]') as HTMLButtonElement).click();
    http.expectOne((r) => r.method === 'DELETE').flush('x', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(text()).toContain('Modelle vergleichen');
    expect(text()).toContain('konnte nicht entfernt werden');
  });

  it('keyboard: focus moves into each step, Escape closes only the assistant and returns focus', async () => {
    vi.useFakeTimers();
    try {
      const { el, click, flushList, fixture } = setup();
      flushList([]);
      click('+ Verknüpfen');
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

  it('shows remove only where the server allows it (read-only viewers)', () => {
    const { el, text, flushList } = setup();
    flushList([dto(1, task()), { ...dto(2, task({ id: 6, title: 'Angebot einholen' })), can_delete: false }]);
    expect(text()).toContain('Angebot einholen');
    expect(el.querySelectorAll('.connection__remove').length).toBe(1);
    expect(el.querySelector('button[aria-label^="Verbindung zu „Angebot einholen“"]')).toBeNull();
  });

  it('asks the server whether this object may be linked and explains a 403 plainly', () => {
    const { text, click, flushList, fixture } = setup();
    flushList([]);
    click('+ Verknüpfen');
    const options = http.expectOne((r) => r.url.endsWith('/options/'));
    expect(options.request.params.get('object_id')).toBe('7');
    options.flush({ detail: 'Django says no' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(text()).toContain('Dafür fehlt dir die Berechtigung.');
    expect(text()).not.toContain('Django');
  });

  it('explains a network error and a vanished object when linking or removing', () => {
    const { el, text, click, flushList, fixture } = setup();
    flushList([dto(1, task())]);
    (el.querySelector('button[aria-label^="Verbindung zu"]') as HTMLButtonElement).click();
    http.expectOne((r) => r.method === 'DELETE').flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(text()).toContain('Dieser Eintrag ist nicht mehr verfügbar.');
    expect(el.querySelector('.connection__title')).toBeNull(); // nicht mehr verfügbar → aus der Liste genommen

    click('+ Verknüpfen');
    http.expectOne((r) => r.url.endsWith('/options/')).flush([{ type: 'TASK', label: 'Aufgabe', domain: 'organisation', relation_type: 'TASK_FOR' }]);
    fixture.detectChanges();
    click('Aufgabe');
    http.expectOne((r) => r.url.endsWith('/candidates/')).flush([task()]);
    fixture.detectChanges();
    click('Modelle vergleichen');
    click('Verknüpfen');
    http.expectOne((r) => r.method === 'POST').error(new ProgressEvent('error'), { status: 0, statusText: '' });
    fixture.detectChanges();
    expect(text()).toContain('Keine Verbindung zum Server.');
  });

  const suggestion = (over: Partial<LinkSuggestionDto> = {}): LinkSuggestionDto => ({
    key: 'link:DEVICE:3:SAVINGS_GOAL:7', reason_code: 'DEVICE_SAVINGS_GOAL_MATCH',
    headline: 'Dein Sparziel „Neue Waschmaschine“ könnte mit dem Gerät „Waschmaschine“ zusammenhängen.',
    reason: 'Das Sparziel erwähnt „Waschmaschine“.', relation_label: 'Finanziert durch',
    source: goal, target: goal, other: { type: 'DEVICE', id: 3, title: 'Waschmaschine', subtitle: 'Siemens', domain: 'haushalt' },
    ...over,
  });

  it('shows a suggestion with its reason, privacy note and two real buttons — no score', () => {
    const { el, text, flushList } = setup();
    flushList([], [suggestion()]);
    expect(text()).toContain('Das könnte zusammengehören');
    expect(text()).toContain('Waschmaschine');
    expect(text()).toContain('Das Sparziel erwähnt „Waschmaschine“.');
    expect(text()).toContain('Vorschläge entstehen nur aus Einträgen, auf die du Zugriff hast.');
    expect(text()).toContain('Nur ein Vorschlag: Verknüpft wird erst, wenn du zustimmst, und geändert wird dabei nichts.');
    expect(text()).not.toMatch(/%|score|confidence|KI|AI/);
    const accept = el.querySelector('button[aria-label="Mit „Waschmaschine“ verknüpfen"]');
    const dismiss = el.querySelector('button[aria-label="Vorschlag „Waschmaschine“ ist nicht relevant"]');
    expect(accept?.getAttribute('type')).toBe('button');
    expect(dismiss?.getAttribute('type')).toBe('button');
  });

  it('accepting sends only the key, removes the suggestion and shows the new connection', () => {
    const { el, text, flushList, fixture } = setup();
    flushList([], [suggestion()]);
    (el.querySelector('button[aria-label="Mit „Waschmaschine“ verknüpfen"]') as HTMLButtonElement).click();
    const post = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/link-suggestions/accept/'));
    expect(post.request.body).toEqual({ key: 'link:DEVICE:3:SAVINGS_GOAL:7' });
    post.flush(dto(9, suggestion().other!), { status: 201, statusText: 'Created' });
    fixture.detectChanges();
    flushList([dto(9, suggestion().other!)], []);
    expect(text()).not.toContain('Das könnte zusammengehören');
    expect(Array.from(el.querySelectorAll('.connection__title')).map((n) => n.textContent?.trim())).toEqual(['Waschmaschine']);
    expect(el.querySelector('.sr-only')?.textContent).toContain('Mit „Waschmaschine“ verknüpft.');
  });

  it('dismissing hides the suggestion without creating anything', () => {
    const { el, text, flushList, fixture } = setup();
    flushList([], [suggestion()]);
    (el.querySelector('button[aria-label^="Vorschlag „Waschmaschine“"]') as HTMLButtonElement).click();
    http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/link-suggestions/dismiss/')).flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    expect(text()).not.toContain('Das könnte zusammengehören');
    expect(el.querySelector('.connection__title')).toBeNull();
    http.expectNone((r) => r.method === 'POST' && r.url.endsWith('/connections/'));
  });

  it('a suggestion that no longer applies disappears with a plain message', () => {
    const { el, text, flushList, fixture } = setup();
    flushList([], [suggestion()]);
    (el.querySelector('button[aria-label="Mit „Waschmaschine“ verknüpfen"]') as HTMLButtonElement).click();
    http.expectOne((r) => r.url.endsWith('/accept/')).flush({ detail: 'Django internals' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(text()).toContain('Dieser Vorschlag gilt nicht mehr.');
    expect(text()).not.toContain('Django');
    expect(text()).not.toContain('Das könnte zusammengehören');
  });

  it('a failing suggestion request leaves the section usable', () => {
    const { text, fixture } = setup();
    http.expectOne((r) => r.url.endsWith('/connections/')).flush([dto(1, task())]);
    http.expectOne((r) => r.url.endsWith('/link-suggestions/')).flush('x', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(text()).toContain('Modelle vergleichen');
    expect(text()).not.toContain('konnten nicht geladen');
  });
});
