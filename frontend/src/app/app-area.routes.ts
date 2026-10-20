import { Routes } from '@angular/router';
import { onboardingGuard } from './core/onboarding/onboarding.guard';
import { FINANZEN_DATA_PROVIDER } from './features/finanzen/finanzen-data-provider';
import { FinanzenStateService } from './features/finanzen/finanzen-state.service';
import { RealFinanzenDataProvider } from './features/finanzen/real-finanzen-data-provider';
import { HAUSHALT_DATA_PROVIDER } from './features/haushalt/haushalt-data-provider';
import { RealHaushaltDataProvider } from './features/haushalt/real-haushalt-data-provider';

/**
 * Die angemeldete App (Startseite, Finanzen, Haushalt, Organisation, Reisen, Familie, Onboarding) — eigene Datei, damit
 * die Bereichs-Dienste erst nach der Anmeldung geladen werden. Anmeldung prüft app.routes.ts (authGuard).
 */
export const APP_AREA_ROUTES: Routes = [
  {
    path: '',
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
        redirectTo: 'finanzen',
        pathMatch: 'full',
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
];
