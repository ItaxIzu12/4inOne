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
  it('validates access fields before progressing to household and privacy', () => {
    const fixture = createLogin('register');
    const c = fixture.componentInstance;
    c['continueRegistration']();
    expect(c['registerStep']()).toBe(1);
    c['registerForm'].patchValue({name:'Anna',email:'anna@example.de',password:'Passwort123',confirmPassword:'Passwort123'});
    c['continueRegistration'](); fixture.detectChanges();
    expect(c['registerStep']()).toBe(2);
    expect(fixture.nativeElement.querySelector('#register-household-name')).toBeTruthy();
    expect(c['registerForm'].valid).toBe(false);
    c['registerForm'].controls.acceptPrivacy.setValue(true);
    expect(c['registerForm'].valid).toBe(true);
    c['registerStep'].set(1); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#register-email').value).toBe('anna@example.de');
  });

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

  it('shows labelled login fields and a registration link', () => {
    const fixture = createLogin('login');
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('label[for="login-email"]')).toBeTruthy();
    expect(compiled.querySelector('.secondary-button')?.getAttribute('href')).toBe('/registrieren');
  });

  it('does not submit the register form when the password is shorter than 10 characters', () => {
    const fixture = createLogin('register');
    const component = fixture.componentInstance;

    component['registerForm'].setValue({
      name: 'Mira',
      email: 'mira@example.com',
      password: 'kurz1',
      confirmPassword: 'kurz1',
      householdName: '',
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
