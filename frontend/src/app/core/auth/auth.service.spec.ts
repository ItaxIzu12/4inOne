import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { API_BASE_URL } from '../api.config';
describe('AuthService', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });
  afterEach(() => http.verify());
  it('sends CSRF and does not authenticate an MFA challenge', () => {
    auth.login('a@example.com', 'password').subscribe();
    http.expectOne(`${API_BASE_URL}/auth/csrf/`).flush({ csrfToken: 'csrf' });
    const req = http.expectOne(`${API_BASE_URL}/auth/login/`);
    expect(req.request.headers.get('X-CSRFToken')).toBe('csrf');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ mfa_required: true });
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.currentUser()).toBeNull();
    auth.login('a@example.com', 'password', true, '123456').subscribe();
    const second = http.expectOne(`${API_BASE_URL}/auth/login/`);
    expect(second.request.body.mfa_code).toBe('123456');
    second.flush({ access: 'short-lived', user: { name: 'Anna', email: 'a@example.com' } });
    expect(auth.isAuthenticated()).toBe(true);
  });
  it('sends password confirmation and actual consent to the server', () => {
    auth.register('Anna', 'a@example.com', 'password', 'password', true).subscribe();
    http.expectOne(`${API_BASE_URL}/auth/csrf/`).flush({ csrfToken: 'csrf' });
    const req = http.expectOne(`${API_BASE_URL}/auth/register/`);
    expect(req.request.body.confirm_password).toBe('password');
    expect(req.request.body.accept_privacy).toBe(true);
    expect(req.request.body.household_name).toBeUndefined();
    req.flush({ access: 'access', user: { name: 'Anna', email: 'a@example.com' } });
  });
});
