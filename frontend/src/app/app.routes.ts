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
    path: 'fitness',
    loadComponent: () => import('./features/module-preview/module-preview').then((m) => m.ModulePreview),
    data: {
      label: 'Fitness',
      accent: 'fitness',
      description: 'Trainingspläne, Workout-Log und Fortschritt — dieser Bereich wird gerade gebaut.',
    },
  },
  {
    path: 'finanzen',
    loadComponent: () => import('./features/module-preview/module-preview').then((m) => m.ModulePreview),
    data: {
      label: 'Finanzen',
      accent: 'finance',
      description: 'Budgets, Ausgaben und Sparziele — dieser Bereich wird gerade gebaut.',
    },
  },
  {
    path: 'organisation',
    loadComponent: () => import('./features/module-preview/module-preview').then((m) => m.ModulePreview),
    data: {
      label: 'Organisation',
      accent: 'organize',
      description: 'Kalender, Aufgaben und Notizen — dieser Bereich wird gerade gebaut.',
    },
  },
  {
    path: 'haushalt',
    loadComponent: () => import('./features/module-preview/module-preview').then((m) => m.ModulePreview),
    data: {
      label: 'Haushalt',
      accent: 'household',
      description: 'Einkaufslisten und geteilte Aufgaben — dieser Bereich wird gerade gebaut.',
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
];
