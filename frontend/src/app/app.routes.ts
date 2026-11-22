import { inject } from '@angular/core';
import { AuthService } from './core/auth/auth.service';
import { Router, Routes } from '@angular/router';
import { adminGuard } from './features/admin/admin.guard';
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
      // Website-Seiten bleiben hell (eigenes Editorial-Design), auch im Dunkelmodus (core/theme/theme.service.ts)
      theme: 'light',
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
    loadComponent: () => import('./features/invitation/invitation').then((m) => m.Einladung),
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'einladung/:token',
    loadComponent: () => import('./features/invitation/invitation').then((m) => m.Einladung),
    data: { shell: 'bare', hideHeader: true },
  },
  {
    // Start ohne Netz (22.11.2026): gespeicherte Einkaufsliste. Der Service Worker hält alle App-Teile vorrätig
    // (ngsw-config.json › „/*.js“), deshalb lädt auch diese Seite ohne Netz nach.
    path: 'offline',
    title: 'Offline | 4inOne',
    loadComponent: () => import('./features/offline/offline-page').then((m) => m.OfflinePage),
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
      import('./features/forgot-password/forgot-password').then((m) => m.PasswortVergessen),
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'email-bestaetigen',
    title: 'E-Mail bestätigen | 4inOne',
    loadComponent: () =>
      import('./features/verify-email/verify-email').then((m) => m.EmailBestaetigen),
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'passwort-zuruecksetzen',
    title: 'Neues Passwort | 4inOne',
    loadComponent: () =>
      import('./features/reset-password/reset-password').then(
        (m) => m.PasswortZuruecksetzen,
      ),
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'einstellungen',
    title: 'Einstellungen | 4inOne',
    loadComponent: () =>
      import('./features/settings/settings').then((m) => m.Einstellungen),
    canActivate: [authGuard],
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'einstellungen/profil',
    title: 'Profil bearbeiten | 4inOne',
    loadComponent: () => import('./features/profile/profile').then((m) => m.Profil),
    canActivate: [authGuard],
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'einstellungen/zwei-faktor',
    title: 'Zwei-Faktor-Anmeldung | 4inOne',
    loadComponent: () => import('./features/mfa-setup/mfa-setup').then((m) => m.MfaSetup),
    canActivate: [authGuard],
    data: { shell: 'bare', hideHeader: true },
  },
  {
    // Admin-Panel (features/admin/, docs/MONITORING.md) — nur für Admin-Konten; das Backend prüft Staff + Zwei-Faktor
    path: 'admin',
    title: 'Admin-Panel | 4inOne',
    loadComponent: () => import('./features/admin/admin').then((m) => m.Admin),
    canActivate: [adminGuard],
    data: { shell: 'bare', hideHeader: true },
  },
  {
    // Wer sieht was (22.11.2026): Übersicht der Freigaben je Bereich, nur lesen
    path: 'einstellungen/freigaben',
    title: 'Wer sieht was | 4inOne',
    loadComponent: () => import('./features/sharing/sharing').then((m) => m.Sharing),
    canActivate: [authGuard],
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'einstellungen/sitzungen',
    title: 'Angemeldete Geräte | 4inOne',
    loadComponent: () => import('./features/sessions/sessions').then((m) => m.Sitzungen),
    canActivate: [authGuard],
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'impressum',
    title: 'Impressum | 4inOne',
    data: {
      theme: 'light',
      shell: 'bare',
      hideHeader: true,
      description: 'Impressum von 4inOne: Anbieter, Kontakt und Verantwortliche.',
    },
    loadComponent: () => import('./features/imprint/imprint').then((m) => m.Impressum),
  },
  {
    path: 'datenschutz',
    title: 'Datenschutzerklärung | 4inOne',
    data: {
      theme: 'light',
      shell: 'bare',
      hideHeader: true,
      description:
        'Wie 4inOne mit deinen Daten umgeht: welche Daten, wofür und welche Rechte du hast.',
    },
    loadComponent: () => import('./features/privacy/privacy').then((m) => m.Datenschutz),
  },
  {
    path: 'nutzungsbedingungen',
    title: 'Nutzungsbedingungen | 4inOne',
    data: { theme: 'light', shell: 'bare', hideHeader: true, description: 'Die Nutzungsbedingungen von 4inOne.' },
    loadComponent: () =>
      import('./features/terms/terms').then(
        (m) => m.Nutzungsbedingungen,
      ),
  },
  {
    path: 'barrierefreiheit',
    title: 'Barrierefreiheit | 4inOne',
    data: {
      theme: 'light',
      shell: 'bare',
      hideHeader: true,
      description: 'Erklärung zur Barrierefreiheit von 4inOne und wie du Barrieren melden kannst.',
    },
    loadComponent: () =>
      import('./features/accessibility/accessibility').then((m) => m.Barrierefreiheit),
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
    data: { theme: 'light', shell: 'bare', hideHeader: true, notFound: true },
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

