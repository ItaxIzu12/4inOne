import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService, AuthUser } from '../../core/auth/auth.service';
import { Header } from './header';

@Component({ standalone: true, template: '' })
class BlankComponent {}

class FakeAuthService {
  readonly isAuthenticated = signal(false);
  readonly currentUser = signal<AuthUser | null>(null);
}

async function renderAt(url: string, auth: FakeAuthService) {
  // resetTestingModule, weil manche Tests renderAt() mehrfach in einem
  // einzigen it()-Block aufrufen (Vitest/TestBed erlaubt configureTestingModule
  // sonst nur einmal, bevor die erste Komponente erzeugt wurde).
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [Header],
    providers: [
      provideRouter([
        { path: '', component: BlankComponent, data: { dashboardNav: true } },
        { path: 'einstellungen', component: BlankComponent },
        { path: 'login', component: BlankComponent },
      ]),
      { provide: AuthService, useValue: auth },
    ],
  });
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  const fixture = TestBed.createComponent(Header);
  fixture.detectChanges();
  return fixture;
}

describe('Header', () => {
  it('always renders the "Kompass" brand', async () => {
    const fixture = await renderAt('/login', new FakeAuthService());
    expect((fixture.nativeElement as HTMLElement).querySelector('.brand-name')?.textContent).toContain('Kompass');
  });

  it('shows the module tabs only on the dashboard route', async () => {
    const dashboard = await renderAt('/', new FakeAuthService());
    expect(dashboard.nativeElement.querySelectorAll('.header-nav a').length).toBe(4);

    const settings = await renderAt('/einstellungen', new FakeAuthService());
    expect(settings.nativeElement.querySelector('.header-nav')).toBeNull();
  });

  it('shows "Anmelden" when not authenticated — regardless of route', async () => {
    const fixture = await renderAt('/', new FakeAuthService());
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.login-button')?.getAttribute('href')).toBe('/login');
    expect(compiled.querySelector('.profile-link')).toBeNull();
  });

  it('shows the profile link with real initials when authenticated — regardless of route', async () => {
    const auth = new FakeAuthService();
    auth.isAuthenticated.set(true);
    auth.currentUser.set({ name: 'Mira Beispiel', email: 'mira@example.com' });

    const fixture = await renderAt('/login', auth);
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.login-button')).toBeNull();
    expect(compiled.querySelector('.profile-link')?.getAttribute('href')).toBe('/einstellungen');
    expect(compiled.querySelector('.profile-avatar')?.textContent).toBe('MB');
  });

  it('falls back to the first letter of the email when no name is set', async () => {
    const auth = new FakeAuthService();
    auth.isAuthenticated.set(true);
    auth.currentUser.set({ name: '', email: 'jonas@example.com' });

    const fixture = await renderAt('/', auth);
    expect((fixture.nativeElement as HTMLElement).querySelector('.profile-avatar')?.textContent).toBe('J');
  });

  it('opens the mobile menu on hamburger click, with the module tabs (dashboardNav route) and "Anmelden"', async () => {
    const fixture = await renderAt('/', new FakeAuthService());
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#mobile-nav-menu')).toBeNull();

    const toggle = compiled.querySelector('.menu-toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const menu = compiled.querySelector('#mobile-nav-menu');
    expect(menu).toBeTruthy();
    expect(menu?.querySelectorAll('a').length).toBe(5); // Start/Finanzen/Haushalt/Organisation + Anmelden
    expect(menu?.querySelector('.mobile-menu__login')?.getAttribute('href')).toBe('/login');
  });

  it('hides the module tabs in the mobile menu on routes without dashboardNav, but keeps "Anmelden"', async () => {
    const fixture = await renderAt('/einstellungen', new FakeAuthService());
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.menu-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    const menu = compiled.querySelector('#mobile-nav-menu');
    expect(menu?.querySelectorAll('a').length).toBe(1);
    expect(menu?.querySelector('.mobile-menu__login')).toBeTruthy();
  });

  it('closes the mobile menu when a link inside it is clicked', async () => {
    const fixture = await renderAt('/', new FakeAuthService());
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.menu-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.querySelector('#mobile-nav-menu')).toBeTruthy();

    (compiled.querySelector('#mobile-nav-menu a') as HTMLAnchorElement).click();
    fixture.detectChanges();
    expect(compiled.querySelector('#mobile-nav-menu')).toBeNull();
  });

  it('closes the mobile menu on Escape', async () => {
    const fixture = await renderAt('/', new FakeAuthService());
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.menu-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.querySelector('#mobile-nav-menu')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(compiled.querySelector('#mobile-nav-menu')).toBeNull();
  });
});
