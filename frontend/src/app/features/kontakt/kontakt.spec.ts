import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { API_BASE_URL } from '../../core/api.config';
import { Kontakt } from './kontakt';

describe('Kontakt', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [Kontakt],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(Kontakt);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const type = (selector: string, value: string) => {
      const input = el.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const submit = () => {
      (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };
    return { fixture, el, type, submit, http: TestBed.inject(HttpTestingController), router: TestBed.inject(Router) };
  }

  it('shows field errors and sends nothing when the form is empty', () => {
    const { el, submit, http } = setup();
    submit();
    expect(el.textContent).toContain('Bitte gib deinen Namen an.');
    expect(el.textContent).toContain('damit wir antworten können');
    expect(el.textContent).toContain('mindestens 10 Zeichen');
    http.expectNone(`${API_BASE_URL}/site/contact/`);
  });

  it('sends the trimmed message and goes to the thank-you page', () => {
    const { type, submit, http, router } = setup();
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    type('#contact-name', '  Mia ');
    type('#contact-email', 'mia@example.com');
    type('#contact-message', 'Hallo, ich habe eine Frage.');
    submit();
    const req = http.expectOne(`${API_BASE_URL}/site/contact/`);
    expect(req.request.body).toEqual({ name: 'Mia', email: 'mia@example.com', message: 'Hallo, ich habe eine Frage.', website: '' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(navigate).toHaveBeenCalledWith('/kontakt/danke');
  });

  it('explains a rate limit instead of failing silently', () => {
    const { fixture, el, type, submit, http } = setup();
    type('#contact-name', 'Mia');
    type('#contact-email', 'mia@example.com');
    type('#contact-message', 'Hallo, ich habe eine Frage.');
    submit();
    http.expectOne(`${API_BASE_URL}/site/contact/`).flush({}, { status: 429, statusText: 'Too Many Requests' });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('in einer Stunde');
  });

  it('keeps the honeypot field out of reach for people', () => {
    const { el } = setup();
    const trap = el.querySelector('#contact-website') as HTMLInputElement;
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
