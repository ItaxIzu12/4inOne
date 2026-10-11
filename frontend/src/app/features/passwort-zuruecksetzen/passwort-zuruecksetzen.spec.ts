import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api.config';
import { PasswortZuruecksetzen } from './passwort-zuruecksetzen';

function create(token: string | null) {
  TestBed.configureTestingModule({
    imports: [PasswortZuruecksetzen],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } } },
    ],
  });
  const fixture = TestBed.createComponent(PasswortZuruecksetzen);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance, http: TestBed.inject(HttpTestingController), el: fixture.nativeElement as HTMLElement };
}

const URL = `${API_BASE_URL}/auth/password-reset/confirm/`;

describe('PasswortZuruecksetzen', () => {
  it('explains an invalid link when no token is present', () => {
    const { el } = create(null);
    expect(el.querySelector('h1')?.textContent).toContain('Dieser Link funktioniert nicht mehr');
    expect(el.querySelector('a[href="/passwort-vergessen"]')).toBeTruthy();
  });

  it('shows errors only after submitting and does not call the backend', () => {
    const { fixture, c, http, el } = create('abc');
    expect(el.querySelector('.field-error')).toBeNull();
    c['form'].setValue({ password: 'Sicher12345', confirmPassword: 'Anders12345' });
    c['submit']();
    fixture.detectChanges();
    expect(el.textContent).toContain('Die Passwörter stimmen nicht überein.');
    http.expectNone(URL);
  });

  it('sends token and new password, then offers the login', () => {
    const { fixture, c, http, el } = create('abc');
    c['form'].setValue({ password: 'Sicher12345', confirmPassword: 'Sicher12345' });
    c['submit']();
    const req = http.expectOne(URL);
    expect(req.request.body).toEqual({ token: 'abc', password: 'Sicher12345' });
    req.flush({ detail: 'ok' });
    fixture.detectChanges();
    expect(el.querySelector('h1')?.textContent).toContain('Passwort geändert');
    expect(el.querySelector('a.submit-button')?.getAttribute('href')).toBe('/login');
  });

  it('switches to the invalid-link state when the token is rejected', () => {
    const { fixture, c, http, el } = create('alt');
    c['form'].setValue({ password: 'Sicher12345', confirmPassword: 'Sicher12345' });
    c['submit']();
    http.expectOne(URL).flush({ detail: 'ungültig' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el.querySelector('h1')?.textContent).toContain('Dieser Link funktioniert nicht mehr');
  });
});
