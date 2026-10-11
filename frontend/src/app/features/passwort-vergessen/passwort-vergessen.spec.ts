import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api.config';
import { PasswortVergessen } from './passwort-vergessen';

describe('PasswortVergessen', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswortVergessen],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('has a single labelled email field and does not submit when invalid', () => {
    const fixture = TestBed.createComponent(PasswortVergessen);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('label[for="reset-email"]')).toBeTruthy();

    component['submit']();
    expect(component['submitting']()).toBe(false);
    expect(component['form'].controls.email.touched).toBe(true);
    TestBed.inject(HttpTestingController).expectNone(`${API_BASE_URL}/auth/password-reset/request/`);
  });

  it('requests the reset link and shows the same neutral confirmation for every address', () => {
    const fixture = TestBed.createComponent(PasswortVergessen);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['form'].controls.email.setValue('jemand@example.com');

    component['submit']();
    const req = TestBed.inject(HttpTestingController).expectOne(`${API_BASE_URL}/auth/password-reset/request/`);
    expect(req.request.body).toEqual({ email: 'jemand@example.com' });
    req.flush({ detail: 'ok' });
    fixture.detectChanges();

    const status = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');
    expect(status?.textContent).toContain('Falls ein Konto mit dieser E-Mail-Adresse existiert');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('noch nicht mit dem Backend verbunden');
  });
});
