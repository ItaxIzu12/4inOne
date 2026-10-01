import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService, AuthUser } from '../core/auth/auth.service';
import { AppShell } from './app-shell';

class FakeAuthService {
  readonly isAuthenticated = signal(false);
  readonly currentUser = signal<AuthUser | null>(null);
}

@Component({ standalone: true, imports: [AppShell], template: '<app-shell>Inhalt</app-shell>' })
class Host {}

describe('AppShell', () => {
  async function renderAt(url: string, auth: FakeAuthService) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideRouter([
          { path: '**', component: Host },
        ]),
        { provide: AuthService, useValue: auth },
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture;
  }

  it('shows a clear "Demo-Modus" banner with a link to create a real account on a public demo route', async () => {
    const fixture = await renderAt('/demo/reisen', new FakeAuthService());
    const el = fixture.nativeElement as HTMLElement;

    const banner = el.querySelector('.demo-banner');
    expect(banner).toBeTruthy();
    expect(banner?.textContent).toContain('Demo-Modus');
    expect(banner?.textContent).toContain('Beispieldaten');
    const cta = el.querySelector('.demo-banner__cta') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('/registrieren');
  });

  it('shows no demo banner on a real /app route, even while a session is held in memory', async () => {
    const auth = new FakeAuthService();
    auth.isAuthenticated.set(true);
    const fixture = await renderAt('/reisen', auth);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.demo-banner')).toBeNull();
  });

  it('still shows the demo banner on a public route even for an authenticated session (e.g. via "4inOne entdecken")', async () => {
    const auth = new FakeAuthService();
    auth.isAuthenticated.set(true);
    const fixture = await renderAt('/demo/finanzen', auth);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.demo-banner')).toBeTruthy();
  });

  it('shows no demo banner on a real, authenticated-only page that has no demo variant (e.g. /einstellungen/profil)', async () => {
    const auth = new FakeAuthService();
    auth.isAuthenticated.set(true);
    const fixture = await renderAt('/einstellungen/profil', auth);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.demo-banner')).toBeNull();
  });
});
