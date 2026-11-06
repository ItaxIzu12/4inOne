import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture;
  }

  it('shows a clear "Demo-Modus" non-interactive badge on a public demo route', async () => {
    const fixture = await renderAt('/demo/reisen', new FakeAuthService());
    const el = fixture.nativeElement as HTMLElement;

    const banner = el.querySelector('.demo-banner');
    expect(banner).toBeTruthy();
    expect(banner?.textContent).toContain('Demo-Modus');
    expect(banner?.textContent).toContain('Beispieldaten');
    expect(banner?.querySelector('a, button, [tabindex]')).toBeNull();
    expect(banner?.querySelector('.demo-badge')).toBeTruthy();
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

  describe('Beta-Feedback im Kontomenü', () => {
    const openMenu = (fixture: Awaited<ReturnType<typeof renderAt>>) => {
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.profile-button')!.click();
      fixture.detectChanges();
    };
    const items = (fixture: Awaited<ReturnType<typeof renderAt>>) =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.account-menu [role=menuitem]')).map((i) => i.textContent?.trim());

    it('shows "Feedback geben" only when the server has switched the beta on, and asks only once', async () => {
      const auth = new FakeAuthService();
      auth.isAuthenticated.set(true);
      const fixture = await renderAt('/haushalt', auth);
      const http = TestBed.inject(HttpTestingController);
      openMenu(fixture);
      http.expectOne('http://localhost:8000/api/v1/feedback/').flush({ enabled: true, areas: [], tasks: [] });
      fixture.detectChanges();
      expect(items(fixture)).toContain('Feedback geben Beta');
      openMenu(fixture); // schließen
      openMenu(fixture); // wieder öffnen: keine zweite Anfrage
      http.expectNone('http://localhost:8000/api/v1/feedback/');
    });

    it('stays hidden when switched off, in the demo and without an account', async () => {
      const auth = new FakeAuthService();
      auth.isAuthenticated.set(true);
      let fixture = await renderAt('/finanzen', auth);
      let http = TestBed.inject(HttpTestingController);
      openMenu(fixture);
      http.expectOne('http://localhost:8000/api/v1/feedback/').flush({ enabled: false, areas: [], tasks: [] });
      fixture.detectChanges();
      expect(items(fixture).join()).not.toContain('Feedback');

      fixture = await renderAt('/demo/finanzen', auth);
      http = TestBed.inject(HttpTestingController);
      openMenu(fixture);
      http.expectNone('http://localhost:8000/api/v1/feedback/');
      expect(items(fixture).join()).not.toContain('Feedback');

      fixture = await renderAt('/finanzen', new FakeAuthService());
      http = TestBed.inject(HttpTestingController);
      openMenu(fixture);
      http.expectNone('http://localhost:8000/api/v1/feedback/');
    });
  });
});
