import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
    // shell: 'bare' blendet Footer/Bottom-Nav der Marketing-Seiten aus
    // (siehe app.ts/app.html) — der Header bleibt überall gleich (siehe
    // shared/header), bekommt hier aber zusätzlich die Modul-Reiter
    // (dashboardNav) und zeigt Profil statt "Anmelden" (shell: 'bare').
    data: { shell: 'bare', dashboardNav: true },
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
    path: 'einstellungen',
    loadComponent: () => import('./features/einstellungen/einstellungen').then((m) => m.Einstellungen),
    // Eigene App-Shell wie das Dashboard, siehe app.ts/app.html — Settings
    // ist ein App-Screen, keine öffentliche Marketing-Seite.
    data: { shell: 'bare' },
  },
  {
    path: 'einstellungen/profil',
    loadComponent: () => import('./shared/coming-soon/coming-soon').then((m) => m.ComingSoon),
    data: {
      shell: 'bare',
      title: 'Profil bearbeiten',
      description: 'Name und E-Mail-Adresse ändern kannst du hier bald direkt — dieser Bereich wird gerade gebaut.',
    },
  },
  {
    path: 'einstellungen/zwei-faktor',
    loadComponent: () => import('./shared/coming-soon/coming-soon').then((m) => m.ComingSoon),
    data: {
      shell: 'bare',
      title: 'Zwei-Faktor-Authentifizierung',
      description:
        'Die TOTP-Einrichtung folgt hier, siehe ARCHITEKTUR.md §3.1 (MFA verpflichtend für Finanzfunktionen).',
    },
  },
  {
    path: 'einstellungen/sitzungen',
    loadComponent: () => import('./shared/coming-soon/coming-soon').then((m) => m.ComingSoon),
    data: {
      shell: 'bare',
      title: 'Aktive Sitzungen',
      description:
        'Die Übersicht deiner angemeldeten Geräte mit Möglichkeit zum Abmelden folgt hier, siehe ARCHITEKTUR.md §3.6.',
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
    path: 'nutzungsbedingungen',
    loadComponent: () =>
      import('./features/nutzungsbedingungen/nutzungsbedingungen').then((m) => m.Nutzungsbedingungen),
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
