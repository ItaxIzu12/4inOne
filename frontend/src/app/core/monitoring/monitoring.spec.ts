import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ErrorEvent } from '@sentry/browser';
import { Monitoring, scrubBrowserEvent } from './monitoring';

describe('Monitoring (Fehlerberichte an GlitchTip)', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));

  it('ohne Fehler keine Anfrage — öffentliche Seiten laden weiterhin nichts', () => {
    TestBed.inject(Monitoring);
    TestBed.inject(HttpTestingController).expectNone((r) => r.url.includes('/monitoring/'));
  });

  it('erst der erste Fehler fragt das Backend; ist Monitoring aus, wird nichts geladen und nie wieder gefragt', async () => {
    const monitoring = TestBed.inject(Monitoring);
    monitoring.capture(new Error('eins'));
    monitoring.capture(new Error('zwei'));
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url.endsWith('/monitoring/config/')).flush({ enabled: false, dsn: null, environment: 'test' });
    await (monitoring as unknown as { starting: Promise<void> }).starting;
    monitoring.capture(new Error('drei'));
    http.expectNone((r) => r.url.includes('/monitoring/'));
    expect((monitoring as unknown as { sentry: unknown }).sentry).toBeNull();
  });

  it('Backend nicht erreichbar → still ohne Fehlerberichte, kein Absturz', async () => {
    const monitoring = TestBed.inject(Monitoring);
    monitoring.capture(new Error('x'));
    TestBed.inject(HttpTestingController).expectOne((r) => r.url.endsWith('/monitoring/config/')).flush(null, { status: 502, statusText: 'Bad Gateway' });
    await expect((monitoring as unknown as { starting: Promise<void> }).starting).resolves.toBeUndefined();
  });

  it('entfernt vor dem Senden Nutzer, Cookies, Header, Parameter und E-Mail-Adressen', () => {
    const event = {
      type: undefined,
      user: { email: 'sophie@example.com', ip_address: '1.2.3.4' },
      request: { url: 'https://4inone.de/finanzen?monat=2026-11#x', cookies: { a: 'b' }, headers: { Authorization: 'Bearer z' }, query_string: 'monat=2026-11', data: '{"password":"x"}' },
      message: 'Fehler für sophie@example.com',
      exception: { values: [{ type: 'Error', value: 'kein Konto anna@example.org', stacktrace: { frames: [{ filename: 'main.js', vars: { token: 'geheim' } }] } }] },
      breadcrumbs: [{ message: 'Klick max@example.com', data: { url: '/api/v1/x?token=abc' } }],
    } as unknown as ErrorEvent;
    const text = JSON.stringify(scrubBrowserEvent(event));
    for (const secret of ['sophie@', 'anna@', 'max@', '1.2.3.4', 'Bearer', 'password', 'geheim', 'token=abc', 'monat=2026-11']) {
      expect(text).not.toContain(secret);
    }
    expect(event.request!.url).toBe('https://4inone.de/finanzen');
  });
});
