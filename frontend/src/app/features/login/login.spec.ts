import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Login } from './login';

function createLogin(mode: 'login' | 'register') {
  TestBed.overrideProvider(ActivatedRoute, {
    useValue: { snapshot: { data: { mode } } },
  });
  const fixture = TestBed.createComponent(Login);
  fixture.detectChanges();
  return fixture;
}

describe('Login', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: {} } } },
      ],
    }).compileComponents();
  });

  it('shows the login form with a labelled email field and the MFA hint by default', () => {
    const fixture = createLogin('login');
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('label[for="login-email"]')).toBeTruthy();
    expect(compiled.querySelector('.mfa-hint')?.textContent).toContain('Zwei-Faktor-Authentifizierung');
  });

  it('does not submit the register form when the password is shorter than 10 characters', () => {
    const fixture = createLogin('register');
    const component = fixture.componentInstance;

    component['registerForm'].setValue({
      name: 'Mira',
      email: 'mira@example.com',
      password: 'kurz1',
      confirmPassword: 'kurz1',
      acceptPrivacy: true,
    });
    fixture.detectChanges();

    expect(component['registerForm'].controls.password.valid).toBe(false);
  });

  it('computes a 3-bar password strength independent of the hard policy', () => {
    const fixture = createLogin('register');
    const component = fixture.componentInstance;

    component['registerForm'].controls.password.setValue('Sicher123!x');
    fixture.detectChanges();

    expect(component['passwordStrength']()).toBe(3);
  });

  it('renders a permanent field-hint (not just a placeholder) under the password field', () => {
    const fixture = createLogin('register');
    const compiled = fixture.nativeElement as HTMLElement;

    const hint = compiled.querySelector('#register-password-hint');
    expect(hint?.textContent).toContain('Mindestens 10 Zeichen');
    expect(compiled.querySelector('#register-password')?.getAttribute('placeholder')).toBeNull();
  });

  it('toggles password visibility with an aria-label that reflects the current state', () => {
    const fixture = createLogin('login');
    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector('.toggle-visibility') as HTMLButtonElement;

    expect(toggle.getAttribute('aria-label')).toBe('Passwort anzeigen');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-label')).toBe('Passwort verbergen');
  });
});
