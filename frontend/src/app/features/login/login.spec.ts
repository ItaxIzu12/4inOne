import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Login } from './login';

function setup(mode: 'login' | 'register', query: Record<string, string> = {}) {
  TestBed.configureTestingModule({
    imports: [Login],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { data: { mode }, queryParamMap: convertToParamMap(query) } } },
    ],
  });
  const fixture = TestBed.createComponent(Login);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  return { fixture, el: fixture.nativeElement as HTMLElement, http, c: fixture.componentInstance as unknown as Record<string, any> };
}
const providers = (http: HttpTestingController, value: { google: boolean; apple: boolean }) =>
  http.expectOne((r) => r.url.endsWith('/auth/oauth/providers/')).flush(value);

describe('Login (Neubau 19.11.2026)', () => {
  it('Registrierung: ein Formular mit Vorname, E-Mail, Passwort, Wiederholung und Zustimmung', () => {
    const { c, el, http } = setup('register');
    providers(http, { google: false, apple: false });
    expect(el.querySelector('h1')!.textContent).toContain('Konto erstellen');
    const form = c['registerForm'];
    form.patchValue({ name: 'Anna', email: 'anna@example.de', password: 'Passwort123', confirmPassword: 'Passwort123' });
    expect(form.valid).toBe(false);
    form.controls.acceptPrivacy.setValue(true);
    expect(form.valid).toBe(true);
    form.controls.confirmPassword.setValue('anders');
    expect(form.valid).toBe(false);
  });

  it('Passwortregeln sind immer sichtbar und haken sich live ab; kurze Passwörter werden nicht gesendet', () => {
    const { c, el, fixture, http } = setup('register');
    providers(http, { google: false, apple: false });
    expect(el.querySelectorAll('#register-password-rules li').length).toBe(3);
    c['registerForm'].patchValue({ name: 'Anna', email: 'anna@example.de', password: 'kurz1', confirmPassword: 'kurz1', acceptPrivacy: true });
    fixture.detectChanges();
    expect(el.querySelectorAll('#register-password-rules li.is-met').length).toBe(2); // Buchstabe + Zahl
    c['submitRegister']();
    http.expectNone((r) => r.url.includes('/auth/register/'));
    fixture.detectChanges();
    expect(el.querySelector('.field-error')!.textContent).toContain('Regeln');
  });

  it('Fehler erst nach dem Absenden, dann am Feld mit aria-describedby', () => {
    const { el, fixture, http, c } = setup('login');
    providers(http, { google: false, apple: false });
    expect(el.querySelectorAll('.field-error').length).toBe(0);
    c['submitLogin']();
    fixture.detectChanges();
    const email = el.querySelector('#login-email')!;
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(email.getAttribute('aria-describedby')).toBe('login-email-error');
  });

  it('Google/Apple-Knöpfe nur, wenn eingerichtet; der Klick führt zum Start im Backend', () => {
    const { el, fixture, http, c } = setup('login');
    providers(http, { google: true, apple: false });
    fixture.detectChanges();
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('.social__btn')];
    expect(buttons.map((b) => b.textContent!.trim())).toEqual(['Weiter mit Google']);
    expect(el.querySelector('.divider')!.textContent).toContain('oder mit E-Mail');
    const leave = vi.spyOn(c as any, 'leaveTo').mockImplementation(() => undefined);
    buttons[0].click();
    expect(leave).toHaveBeenCalledWith(expect.stringMatching(/\/auth\/oauth\/google\/start\/$/));
    fixture.detectChanges();
    expect(buttons[0].textContent).toContain('Weiterleitung');
  });

  it('ohne eingerichtete Anbieter keine Knöpfe und kein Trenner', () => {
    const { el, fixture, http } = setup('login');
    providers(http, { google: false, apple: false });
    fixture.detectChanges();
    expect(el.querySelector('.social')).toBeNull();
    expect(el.querySelector('.divider')).toBeNull();
  });

  it('Rückkehr mit Fehler zeigt einen verständlichen Satz statt Technik', () => {
    const { el, fixture, http } = setup('login', { fehler: 'abgebrochen' });
    providers(http, { google: true, apple: false });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('abgebrochen');
  });

  it('Rückkehr als neues Konto: Sitzung holen, dann ins Onboarding', () => {
    const { http } = setup('login', { social: 'neu' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    providers(http, { google: true, apple: false });
    http.expectOne((r) => r.url.endsWith('/auth/csrf/')).flush({ csrfToken: 't' });
    http.expectOne((r) => r.url.endsWith('/auth/refresh/')).flush({ access: 'a', user: { name: 'Lena', email: 'l@example.com' } });
    expect(navigate).toHaveBeenCalledWith('/onboarding', { replaceUrl: true });
  });

  it('bestehendes Konto: verlangt das Passwort und zeigt die Adresse maskiert', () => {
    const { el, fixture, http, c } = setup('login', { social: 'verknuepfen' });
    providers(http, { google: true, apple: false });
    http.expectOne((r) => r.url.endsWith('/auth/oauth/pending/')).flush({ step: 'link', provider: 'google', email: 'l•••@example.com', has_password: true });
    fixture.detectChanges();
    expect(el.querySelector('h1')!.textContent).toContain('Konto verbinden');
    expect(el.textContent).toContain('l•••@example.com');
    expect(el.querySelector('#link-password')).toBeTruthy();
    c['linkForm'].controls.password.setValue('geheim');
    c['submitLink']();
    http.expectOne((r) => r.url.endsWith('/auth/csrf/')).flush({ csrfToken: 't' });
    const req = http.expectOne((r) => r.url.endsWith('/auth/oauth/link/'));
    expect(req.request.body).toEqual({ password: 'geheim', mfa_code: '' });
    req.flush({ mfa_required: true });
    fixture.detectChanges();
    expect(el.querySelector('#link-code')).toBeTruthy(); // Zwei-Faktor-Feld erscheint
  });

  it('Konto ohne Passwort (über anderen Anbieter angelegt): Weg über „Passwort festlegen“', () => {
    const { el, fixture, http } = setup('login', { social: 'verknuepfen' });
    providers(http, { google: true, apple: true });
    http.expectOne((r) => r.url.endsWith('/auth/oauth/pending/')).flush({ step: 'link', provider: 'apple', email: 'l•••@example.com', has_password: false });
    fixture.detectChanges();
    expect(el.querySelector('#link-password')).toBeNull();
    expect(el.querySelector('a[href="/passwort-vergessen"]')!.textContent).toContain('Passwort festlegen');
  });

  it('Passwort anzeigen/verbergen mit passender Beschriftung', () => {
    const { el, fixture, http } = setup('login');
    providers(http, { google: false, apple: false });
    const toggle = el.querySelector<HTMLButtonElement>('.secret__toggle')!;
    expect(toggle.getAttribute('aria-label')).toBe('Passwort anzeigen');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-label')).toBe('Passwort verbergen');
    expect(el.querySelector<HTMLInputElement>('#login-password')!.type).toBe('text');
  });
});
