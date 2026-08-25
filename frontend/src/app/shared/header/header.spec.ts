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
});
