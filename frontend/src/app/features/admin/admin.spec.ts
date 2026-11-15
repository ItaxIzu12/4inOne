import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { Admin } from './admin';
import { adminGuard } from './admin.guard';
import { AuthService } from '../../core/auth/auth.service';

const OVERVIEW = {
  accounts: { total: 12, new_7d: 3, active_7d: 7 },
  events_24h: { registered: 1, login_succeeded: 9, login_failed: 4, locked_out: 1, mfa_failed: 0, password_reset_requested: 0, password_reset_completed: 0 },
  events_7d: { registered: 3, login_succeeded: 40, login_failed: 6, locked_out: 1, mfa_failed: 0, password_reset_requested: 1, password_reset_completed: 1 },
  labels: {},
  monitoring: { connected: true, environment: 'entwicklung', url: 'http://localhost:8001', errors_available: false },
  retention_days: 90,
};

describe('Admin-Panel', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ imports: [Admin], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }),
  );
  const http = () => TestBed.inject(HttpTestingController);

  function render() {
    const fixture = TestBed.createComponent(Admin);
    fixture.detectChanges();
    return fixture;
  }

  it('ohne Zwei-Faktor: erklärt, was fehlt, und verlinkt die Einrichtung — sonst nichts', () => {
    const fixture = render();
    http().expectOne((r) => r.url.endsWith('/admin/overview/')).flush({ detail: 'x', code: 'mfa_required' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Erst Zwei-Faktor einrichten');
    expect(el.querySelector('a[href="/einstellungen/zwei-faktor"]')).toBeTruthy();
    http().expectNone((r) => r.url.includes('/admin/events/'));
  });

  it('alte Sitzung ohne zweiten Faktor: bittet um neue Anmeldung', () => {
    const fixture = render();
    http().expectOne((r) => r.url.endsWith('/admin/overview/')).flush({ detail: 'x', code: 'mfa_session' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Bitte mit Zwei-Faktor neu anmelden');
  });

  it('zeigt Status, Kennzahlen (Fehlversuche/Sperren hervorgehoben), Ereignisse und den Hinweis zur API', () => {
    const fixture = render();
    http().expectOne((r) => r.url.endsWith('/admin/overview/')).flush(OVERVIEW);
    http().expectOne((r) => r.url.includes('/admin/events/')).flush({
      results: [
        { id: 2, kind: 'locked_out', label: 'Gesperrt nach Fehlversuchen', created_at: '2026-11-15T10:00:00Z', user: { name: 'Sophie', email: 's•••@example.com' }, ip_prefix: '203.0.113.0' },
        { id: 1, kind: 'login_failed', label: 'Anmeldung fehlgeschlagen', created_at: '2026-11-15T09:00:00Z', user: null, ip_prefix: '' },
      ],
      page: 1,
      has_more: false,
    });
    http().expectOne((r) => r.url.endsWith('/admin/errors/')).flush({ available: false, reason: 'not_configured', issues: [] });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('GlitchTip verbunden');
    expect(el.querySelector('a[href="http://localhost:8001"]')!.getAttribute('rel')).toContain('noopener');
    expect(el.querySelector('.admin__kpi.is-warn .admin__kpi-value')!.textContent).toBe('4');
    expect(el.querySelector('.admin__kpi.is-bad .admin__kpi-value')!.textContent).toBe('1');
    expect(el.textContent).toContain('Sophie · s•••@example.com · IP 203.0.113.0');
    expect(el.textContent).toContain('Unbekanntes Konto');
    expect(el.textContent).toContain('GLITCHTIP_API_TOKEN');
  });

  it('Filter lädt nur diese Art neu', () => {
    const fixture = render();
    http().expectOne((r) => r.url.endsWith('/admin/overview/')).flush(OVERVIEW);
    http().expectOne((r) => r.url.includes('/admin/events/')).flush({ results: [], page: 1, has_more: false });
    http().expectOne((r) => r.url.endsWith('/admin/errors/')).flush({ available: true, issues: [] });
    fixture.detectChanges();
    const chip = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.admin__chip')].find((b) => b.textContent === 'Gesperrt')!;
    chip.click();
    const req = http().expectOne((r) => r.url.includes('/admin/events/'));
    expect(req.request.params.get('kind')).toBe('locked_out');
    expect(req.request.params.get('page')).toBe('1');
  });

  it('Guard: ohne Admin-Recht zur Startseite, ohne Anmeldung zum Login', () => {
    const auth = TestBed.inject(AuthService);
    const run = () => TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    vi.spyOn(auth, 'isAuthenticated').mockReturnValue(false);
    expect(TestBed.inject(Router).serializeUrl(run() as UrlTree)).toBe('/login');
    vi.spyOn(auth, 'isAuthenticated').mockReturnValue(true);
    vi.spyOn(auth, 'currentUser').mockReturnValue({ name: 'Max', email: 'max@example.com', is_admin: false });
    expect(TestBed.inject(Router).serializeUrl(run() as UrlTree)).toBe('/');
    vi.spyOn(auth, 'currentUser').mockReturnValue({ name: 'Ada', email: 'ada@example.com', is_admin: true });
    expect(run()).toBe(true);
  });
});
