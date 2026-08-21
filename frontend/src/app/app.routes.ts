import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: 'finanzen',
    loadComponent: () => import('./features/module-preview/module-preview').then((m) => m.ModulePreview),
    data: {
      label: 'Finanzen',
      accent: 'finance',
      description: 'Budget, wiederkehrende Ausgaben und geteilte Haushaltskasse — dieser Bereich wird gerade gebaut.',
    },
  },
  {
    path: 'haushalt',
    loadComponent: () => import('./features/module-preview/module-preview').then((m) => m.ModulePreview),
    data: {
      label: 'Haushalt',
      accent: 'household',
      description: 'Einkaufsliste und Aufgaben, gemeinsam bearbeitbar für die ganze Familie — dieser Bereich wird gerade gebaut.',
    },
  },
  {
    path: 'organisation',
    loadComponent: () => import('./features/module-preview/module-preview').then((m) => m.ModulePreview),
    data: {
      label: 'Organisation',
      accent: 'organize',
      description: 'Ein gemeinsamer Kalender, der Termine aus Finanzen und Haushalt automatisch aufnimmt — dieser Bereich wird gerade gebaut.',
    },
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
