import { Routes } from '@angular/router';
import { brandTitle } from './core/brand/brand.config';
import { onboardingGuard } from './core/onboarding/onboarding.guard';
import { HAUSHALT_DATA_PROVIDER } from './features/household/data/household-data-provider';
import { RealHaushaltDataProvider } from './features/household/data/real-household-data-provider';

/**
 * Die angemeldete App (Startseite, Finanzen, Haushalt, Organisation, Reisen, Familie, Onboarding) — eigene Datei, damit
 * die Bereichs-Dienste erst nach der Anmeldung geladen werden. Anmeldung prüft app.routes.ts (authGuard).
 */
export const APP_AREA_ROUTES: Routes = [
  {
    path: '',
    providers: [
      { provide: HAUSHALT_DATA_PROVIDER, useClass: RealHaushaltDataProvider },
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
        title: brandTitle('Finanzen'),
        loadComponent: () =>
          import('./features/finance/private-finance').then((m) => m.PrivateFinance),
        data: { shell: 'bare', dashboardNav: true, sidebarNav: true },
      },
      {
        path: 'haushaltsfinanzen',
        title: brandTitle('Haushaltsfinanzen'),
        redirectTo: 'finanzen',
        pathMatch: 'full',
      },
      {
        path: 'haushalt',
        title: brandTitle('Haushalt'),
        loadComponent: () => import('./features/household/household').then((m) => m.Haushalt),
        data: { dashboardNav: true, sidebarNav: true },
      },
      {
        path: 'onboarding',
        title: brandTitle('Willkommen'),
        loadComponent: () =>
          import('./features/onboarding/onboarding-page').then((m) => m.OnboardingPage),
        data: { shell: 'bare', hideHeader: true },
      },
      {
        path: 'reisen',
        title: brandTitle('Reisen'),
        loadComponent: () => import('./features/travel/travel').then((m) => m.Reisen),
        data: { shell: 'bare', dashboardNav: true, sidebarNav: true },
      },
      {
        path: 'familie',
        title: brandTitle('Personen & Gruppen'),
        loadComponent: () => import('./features/people/people').then((m) => m.Familie),
        data: { shell: 'bare', sidebarNav: true },
      },
      {
        path: 'organisation',
        title: brandTitle('Organisation'),
        loadComponent: () =>
          import('./features/organization/organization').then((m) => m.Organisation),
        data: { shell: 'bare', dashboardNav: true, sidebarNav: true },
      },
    ],
  },
];
