import { inject } from '@angular/core';
import { AuthService } from './core/auth/auth.service';
import { Router, Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { DEMO_ONLY } from './core/demo-only';
// Public landing and authenticated dashboard share /; session initialization runs before matching.
// Demo (demo.routes.ts) und angemeldete App (app-area.routes.ts) werden erst beim Öffnen geladen — nicht im
// Startpaket. Demo-Provider gelten nur unter /demo, unabhängig von der Anmeldung.
const ALL_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canMatch: [() => !inject(AuthService).isAuthenticated()],
    loadComponent: () => import('./features/landing/landing').then((m) => m.Landing),
    title: '4inOne – Dein Alltag. Alles verbunden.',
    data: {
      shell: 'bare',
      hideHeader: true,
      description:
        'Finanzen, Haushalt, Termine und Reisen an einem Ort. Was zusammengehört, verknüpfst du – und entscheidest selbst, was du teilst.',
    },
  },
  {
    // Compatibility redirects preserve query parameters and fragments from bookmarks.
    path: 'app',
    children: [
      '',
      'finanzen',
      'haushaltsfinanzen',
      'haushalt',
      'organisation',
      'reisen',
      'familie',
      'onboarding',
    ].map((path) => ({
      path,
      pathMatch: 'full' as const,
      redirectTo: ({ queryParams, fragment }) =>
        inject(Router).createUrlTree([path ? '/' + path : '/'], {
          queryParams,
          fragment: fragment ?? undefined,
        }),
    })),
  },
  {
    path: 'demo',
    title: '4inOne – Demo',
    loadChildren: () => import('./demo.routes').then((m) => m.DEMO_ROUTES),
  },
  {
    path: 'einladung',
    loadComponent: () => import('./features/einladung/einladung').then((m) => m.Einladung),
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'einladung/:token',
    loadComponent: () => import('./features/einladung/einladung').then((m) => m.Einladung),
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'login',
    title: 'Anmelden | 4inOne',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
    data: { mode: 'login', shell: 'bare', hideHeader: true },
  },
  {
    path: 'registrieren',
    title: 'Konto erstellen | 4inOne',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
    data: { mode: 'register', shell: 'bare', hideHeader: true },
  },
  {
    path: 'passwort-vergessen',
    title: 'Passwort vergessen | 4inOne',
    loadComponent: () =>
      import('./features/passwort-vergessen/passwort-vergessen').then((m) => m.PasswortVergessen),
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'email-bestaetigen',
    title: 'E-Mail bestätigen | 4inOne',
    loadComponent: () =>
      import('./features/email-bestaetigen/email-bestaetigen').then((m) => m.EmailBestaetigen),
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'passwort-zuruecksetzen',
    title: 'Neues Passwort | 4inOne',
    loadComponent: () =>
      import('./features/passwort-zuruecksetzen/passwort-zuruecksetzen').then(
        (m) => m.PasswortZuruecksetzen,
      ),
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'einstellungen',
    loadComponent: () =>
      import('./features/einstellungen/einstellungen').then((m) => m.Einstellungen),
    canActivate: [authGuard],
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'einstellungen/profil',
    loadComponent: () => import('./features/profil/profil').then((m) => m.Profil),
    canActivate: [authGuard],
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'einstellungen/zwei-faktor',
    loadComponent: () => import('./features/mfa-setup/mfa-setup').then((m) => m.MfaSetup),
    canActivate: [authGuard],
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'einstellungen/sitzungen',
    loadComponent: () => import('./features/sitzungen/sitzungen').then((m) => m.Sitzungen),
    canActivate: [authGuard],
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'impressum',
    title: 'Impressum | 4inOne',
    data: {
      shell: 'bare',
      hideHeader: true,
      description: 'Impressum von 4inOne: Anbieter, Kontakt und Verantwortliche.',
    },
    loadComponent: () => import('./features/impressum/impressum').then((m) => m.Impressum),
  },
  {
    path: 'datenschutz',
    title: 'Datenschutzerklärung | 4inOne',
    data: {
      shell: 'bare',
      hideHeader: true,
      description:
        'Wie 4inOne mit deinen Daten umgeht: welche Daten, wofür und welche Rechte du hast.',
    },
    loadComponent: () => import('./features/datenschutz/datenschutz').then((m) => m.Datenschutz),
  },
  {
    path: 'nutzungsbedingungen',
    title: 'Nutzungsbedingungen | 4inOne',
    data: { shell: 'bare', hideHeader: true, description: 'Die Nutzungsbedingungen von 4inOne.' },
    loadComponent: () =>
      import('./features/nutzungsbedingungen/nutzungsbedingungen').then(
        (m) => m.Nutzungsbedingungen,
      ),
  },
  {
    path: 'barrierefreiheit',
    title: 'Barrierefreiheit | 4inOne',
    data: {
      shell: 'bare',
      hideHeader: true,
      description: 'Erklärung zur Barrierefreiheit von 4inOne und wie du Barrieren melden kannst.',
    },
    loadComponent: () =>
      import('./features/barrierefreiheit/barrierefreiheit').then((m) => m.Barrierefreiheit),
  },
  {
    path: '',
    title: '4inOne – Dein Überblick',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadChildren: () => import('./app-area.routes').then((m) => m.APP_AREA_ROUTES),
  },
  {
    // Unbekannte Adressen: eigene 404-Seite statt stiller Weiterleitung auf die Startseite (Soft-404)
    path: '**',
    title: 'Seite nicht gefunden | 4inOne',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
    data: { shell: 'bare', hideHeader: true, notFound: true },
  },
];

// Testversion für GitHub Pages (environment.pages.ts): nur Landingpage, Demo und Rechtsseiten. Anmeldung und App gibt
// es dort nicht (kein Backend) — ihre Adressen führen zur passenden Stelle der Demo, alles Übrige zur 404-Seite.
const DEMO_ONLY_KEPT = new Set(['', 'demo', 'impressum', 'datenschutz', 'nutzungsbedingungen', 'barrierefreiheit', '**']);
const DEMO_ONLY_REDIRECTS: Routes = [
  ...['finanzen', 'haushalt', 'organisation', 'reisen', 'familie'].map((area) => ({
    path: area,
    redirectTo: ({ queryParams }: { queryParams: Record<string, string> }) =>
      inject(Router).createUrlTree(['/demo', area], { queryParams }),
  })),
  ...['app', 'login', 'registrieren', 'passwort-vergessen', 'passwort-zuruecksetzen', 'email-bestaetigen', 'einladung', 'einstellungen', 'onboarding'].map(
    (path) => ({ path, children: [{ path: '**', redirectTo: '/demo' }], pathMatch: 'prefix' as const }),
  ),
];

export const routes: Routes = DEMO_ONLY
  ? [
      ...ALL_ROUTES.filter((r) => DEMO_ONLY_KEPT.has(r.path ?? '') && !(r.path === '' && r.loadChildren)).slice(0, -1),
      ...DEMO_ONLY_REDIRECTS,
      ALL_ROUTES[ALL_ROUTES.length - 1],
    ]
  : ALL_ROUTES;

