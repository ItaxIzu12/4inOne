import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
    data: { mode: 'login' },
  },
  {
    path: 'registrieren',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
    data: { mode: 'register' },
  },
  {
    path: 'passwort-vergessen',
    loadComponent: () =>
      import('./features/passwort-vergessen/passwort-vergessen').then((m) => m.PasswortVergessen),
  },
  {
    path: 'finanzen',
    loadComponent: () => import('./features/finanzen/finanzen').then((m) => m.Finanzen),
  },
  {
    path: 'haushalt',
    loadComponent: () => import('./features/haushalt/haushalt').then((m) => m.Haushalt),
  },
  {
    path: 'organisation',
    loadComponent: () => import('./features/organisation/organisation').then((m) => m.Organisation),
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
    path: 'barrierefreiheit',
    loadComponent: () => import('./features/barrierefreiheit/barrierefreiheit').then((m) => m.Barrierefreiheit),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
