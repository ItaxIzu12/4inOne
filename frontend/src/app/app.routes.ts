import { Routes } from '@angular/router';
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

// Dashboard und Finanzen sind JEWEILS EIN Component, das an zwei Stellen in
// den Routen referenziert wird — einmal öffentlich (Demo-Daten), einmal
// unter /app (echte Daten). Welche Datenquelle eine Komponente tatsächlich
// sieht, entscheidet sich ausschließlich über die `providers` der jeweiligen
// Routengruppe (Dependency Injection), NICHT über eine if/else-Verzweigung
// im Component-Code selbst — siehe FinanzenDataProvider-Interface
// (finanzen-data-provider.ts) und dessen zwei Implementierungen.
export const routes: Routes = [
  {
    path: '',
    // Öffentliche Demo-Gruppe (KEIN authGuard): Dashboard + Finanzen mit
    // DemoFinanzenDataProvider — feste Beispieldaten, keine HTTP-Aufrufe
    // (siehe demo-finanzen-data-provider.ts).
    // FinanzenStateService HIER (nicht providedIn:'root') registriert: pro
    // Routengruppe entsteht dadurch genau eine Instanz, korrekt an
    // DemoFinanzenDataProvider gebunden und zwischen Dashboard + Finanzen
    // dieser Gruppe geteilt (siehe finanzen-state.service.ts-Docstring).
    // Haushalt-Demo (GESAMTKONZEPT.md §5.4: der Einkauf-zu-Ausgabe-Moment
    // darf nicht hinter dem Login versteckt sein) — DemoHaushaltDataProvider
    // bucht über den Demo-Finanzen-Provider DIESER Gruppe, komplett im
    // Speicher.
    providers: [
      // Ältere Demo-Datenquelle: hält weiterhin den Einkauf-zu-Ausgabe-Moment von Haushalt am Laufen
      // (DemoHaushaltDataProvider bucht darüber, siehe dortiger Docstring) — das ältere Finanzen-Design selbst
      // wird über die Demo-Route nicht mehr gezeigt (siehe 'finanzen' unten).
      { provide: FINANZEN_DATA_PROVIDER, useClass: DemoFinanzenDataProvider },
      { provide: HAUSHALT_DATA_PROVIDER, useClass: DemoHaushaltDataProvider },
      // Aktuelles Finanzen-Design (PrivateFinance) und Organisation bekommen in der Demo-Gruppe jeweils ihre
      // eigene, unabhängige In-Memory-Datenquelle statt echter HTTP-Aufrufe.
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
        // Aktuelles Design (dasselbe Component wie /app/finanzen), nur mit Demo-Daten statt echten API-Aufrufen —
        // vorher zeigte diese Route noch das ältere, abweichende Finanzen-Design (features/finanzen/finanzen.ts).
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
        // Ohne Login erreichbar (vorher gab es hier gar keine Demo-Route — ein Klick auf „Organisation“ in der
        // Vorschau landete auf der Anmeldemaske): dieselbe Component wie /app/organisation, mit Demo-Daten.
        path: 'organisation',
        loadComponent: () =>
          import('./features/organisation/organisation').then((m) => m.Organisation),
        data: { dashboardNav: true, sidebarNav: true },
      },
      {
        // Wie oben bei Organisation: dieselbe Component wie /app/reisen, mit Demo-Daten (DemoReisenApi), ohne Login
        // erreichbar. Feste Beispielreise statt echter Nutzer-Reisen (siehe demo-reisen-api.ts).
        path: 'reisen',
        loadComponent: () => import('./features/reisen/reisen').then((m) => m.Reisen),
        data: { dashboardNav: true, sidebarNav: true },
      },
    ],
  },
  {
    path: 'app',
    // Geschützte Gruppe: derselbe authGuard wie bisher, jetzt einmal für die
    // ganze Gruppe statt pro Route (canActivate auf einem Eltern-Route
    // blockiert automatisch auch alle children). RealFinanzenDataProvider
    // ruft die echten /api/v1/finanzen/-Endpunkte auf.
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
    // Link aus der Einladungs-E-Mail; ohne Anmeldung erklärt die Seite, was zu tun ist.
    path: 'einladung/:token',
    loadComponent: () => import('./features/einladung/einladung').then((m) => m.Einladung),
    data: { shell: 'bare', hideHeader: true },
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
    // shell: 'bare' blendet Back-to-Top/Bottom-Nav der Marketing-Seiten aus
    // (siehe app.ts/app.html) — auf der Anmeldeseite ergibt eine Navigation
    // zu den App-Modulen keinen Sinn. hideHeader, weil der globale Header
    // selbst nur einen "Anmelden"-Button zeigt, der auf genau dieser Seite
    // redundant wäre — die Login-Seite hat ihre eigene Marke/ihren eigenen
    // Zurück-Link (siehe features/login).
    data: { mode: 'login', shell: 'bare', hideHeader: true },
  },
  {
    path: 'registrieren',
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
    // Eigene App-Shell wie das Dashboard, siehe app.ts/app.html — Settings
    // ist ein App-Screen, keine öffentliche Marketing-Seite und hat keine
    // Demo-Variante (kein Sinn ohne echtes Konto), daher eigener Guard statt
    // unter /app.
    canActivate: [authGuard],
    // Die Seite bringt ihren eigenen App-Rahmen (Seitenleiste, Kopfzeile) mit: kein globaler Header, kein Footer.
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
    // Echter Setup-Flow (Backend core/mfa_views.py existierte bereits, die
    // Oberfläche fehlte) — ersetzt den früheren ComingSoon-Platzhalter.
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
    path: '**',
    redirectTo: '',
  },
];
