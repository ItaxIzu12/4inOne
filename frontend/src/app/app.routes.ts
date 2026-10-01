import { inject } from '@angular/core';
import { AuthService } from './core/auth/auth.service';
import { DEMO_MODE } from './core/demo-context';
import { Router, Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { onboardingGuard } from './core/onboarding/onboarding.guard';
import { FINANZEN_DATA_PROVIDER } from './features/finanzen/finanzen-data-provider';
import { DemoFinanzenDataProvider } from './features/finanzen/demo-finanzen-data-provider';
import { RealFinanzenDataProvider } from './features/finanzen/real-finanzen-data-provider';
import { FinanzenStateService } from './features/finanzen/finanzen-state.service';
import { PrivateFinanceApi } from './features/finanzen/private-finance-api.service';
import { DemoPrivateFinanceApi } from './features/finanzen/demo-private-finance-api';
import { OrganisationApi } from './features/organisation/organisation-api.service';
import { DemoOrganisationApi } from './features/organisation/demo-organisation-api';
import { HAUSHALT_DATA_PROVIDER } from './features/haushalt/haushalt-data-provider';
import { DemoHaushaltDataProvider } from './features/haushalt/demo-haushalt-data-provider';
import { RealHaushaltDataProvider } from './features/haushalt/real-haushalt-data-provider';
import { ReisenApi } from './features/reisen/reisen-api.service';
import { DemoReisenApi } from './features/reisen/demo-reisen-api';
// Public landing and authenticated dashboard share /; session initialization runs before matching.
// Demo providers are scoped exclusively to /demo, independently of the current session.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canMatch: [() => !inject(AuthService).isAuthenticated()],
    loadComponent: () => import('./features/landing/landing').then((m) => m.Landing),
    title: '4inOne – Dein Alltag. Alles verbunden.',
    data: { shell: 'bare', hideHeader: true },
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
    providers: [
      { provide: DEMO_MODE, useValue: true },
      { provide: FINANZEN_DATA_PROVIDER, useClass: DemoFinanzenDataProvider },
      { provide: HAUSHALT_DATA_PROVIDER, useClass: DemoHaushaltDataProvider },
      { provide: PrivateFinanceApi, useClass: DemoPrivateFinanceApi },
      { provide: OrganisationApi, useClass: DemoOrganisationApi },
      { provide: ReisenApi, useClass: DemoReisenApi },
      FinanzenStateService,
    ],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
        data: { shell: 'bare', dashboardNav: true, sidebarNav: true },
      },
      {
        path: 'finanzen',
        loadComponent: () =>
          import('./features/finanzen/private-finance').then((m) => m.PrivateFinance),
        data: { dashboardNav: true, sidebarNav: true },
      },
      {
        path: 'haushalt',
        loadComponent: () => import('./features/haushalt/haushalt').then((m) => m.Haushalt),
        data: { dashboardNav: true, sidebarNav: true },
      },
      {
        path: 'organisation',
        loadComponent: () =>
          import('./features/organisation/organisation').then((m) => m.Organisation),
        data: { dashboardNav: true, sidebarNav: true },
      },
      {
        path: 'reisen',
        loadComponent: () => import('./features/reisen/reisen').then((m) => m.Reisen),
        data: { dashboardNav: true, sidebarNav: true },
      },
    ],
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
    loadComponent: () =>
      import('./features/passwort-vergessen/passwort-vergessen').then((m) => m.PasswortVergessen),
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
    loadComponent: () => import('./features/impressum/impressum').then((m) => m.Impressum),
  },
  {
    path: 'datenschutz',
    loadComponent: () => import('./features/datenschutz/datenschutz').then((m) => m.Datenschutz),
  },
  {
    path: 'nutzungsbedingungen',
    loadComponent: () =>
      import('./features/nutzungsbedingungen/nutzungsbedingungen').then(
        (m) => m.Nutzungsbedingungen,
      ),
  },
  {
    path: 'barrierefreiheit',
    loadComponent: () =>
      import('./features/barrierefreiheit/barrierefreiheit').then((m) => m.Barrierefreiheit),
  },
  {
    path: '',
    title: '4inOne – Dein Überblick',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    providers: [
      { provide: FINANZEN_DATA_PROVIDER, useClass: RealFinanzenDataProvider },
      { provide: HAUSHALT_DATA_PROVIDER, useClass: RealHaushaltDataProvider },
      FinanzenStateService,
    ],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
        canActivate: [onboardingGuard],
        data: { shell: 'bare', dashboardNav: true, sidebarNav: true },
      },
      {
        path: 'finanzen',
        loadComponent: () =>
          import('./features/finanzen/private-finance').then((m) => m.PrivateFinance),
        data: { shell: 'bare', dashboardNav: true, sidebarNav: true },
      },
      {
        path: 'haushaltsfinanzen',
        loadComponent: () => import('./features/finanzen/finanzen').then((m) => m.Finanzen),
        data: { dashboardNav: true, sidebarNav: true },
      },
      {
        path: 'haushalt',
        loadComponent: () => import('./features/haushalt/haushalt').then((m) => m.Haushalt),
        data: { dashboardNav: true, sidebarNav: true },
      },
      {
        path: 'onboarding',
        loadComponent: () =>
          import('./features/onboarding/onboarding-page').then((m) => m.OnboardingPage),
        data: { shell: 'bare', hideHeader: true },
      },
      {
        path: 'reisen',
        loadComponent: () => import('./features/reisen/reisen').then((m) => m.Reisen),
        data: { shell: 'bare', dashboardNav: true, sidebarNav: true },
      },
      {
        path: 'familie',
        loadComponent: () => import('./features/familie/familie').then((m) => m.Familie),
        data: { shell: 'bare', sidebarNav: true },
      },
      {
        path: 'organisation',
        loadComponent: () =>
          import('./features/organisation/organisation').then((m) => m.Organisation),
        data: { shell: 'bare', dashboardNav: true, sidebarNav: true },
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
