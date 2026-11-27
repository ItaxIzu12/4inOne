import { AutoLinksApi } from './shared/features/connections/auto-links-api.service';
import { DemoAutoLinksApi } from './shared/features/connections/demo-auto-links-api';
import { PlacesService } from './core/places/places.service';
import { DemoPlacesService } from './core/places/demo-places.service';
import { Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { brandTitle } from './core/brand/brand.config';
import { DEMO_MODE } from './core/demo-context';
import { ContactsApiService } from './core/contacts/contacts-api.service';
import { HouseholdApiService } from './core/household/household-api.service';
import { DemoHouseholdApiService } from './core/household/demo-household-api.service';
import { DemoContactsApiService } from './core/contacts/demo-contacts-api.service';
import { ConnectionsApi } from './shared/features/connections/connections-api.service';
import { DemoConnectionsApi } from './shared/features/connections/demo-connections-api';
import { DemoFxService, FxService } from './core/fx/fx.service';
import { DemoHomeCurrency, HomeCurrency } from './core/fx/home-currency';
import { DemoPrivateFinanceApi } from './features/finance/data/demo-private-finance-api';
import { PrivateFinanceApi } from './features/finance/data/private-finance-api.service';
import { DemoHaushaltDataProvider } from './features/household/data/demo-household-data-provider';
import { HAUSHALT_DATA_PROVIDER } from './features/household/data/household-data-provider';
import { DemoOrganisationApi } from './features/organization/data/demo-organization-api';
import { OrganisationApi } from './features/organization/data/organization-api.service';
import { DemoReisenApi } from './features/travel/data/demo-travel-api';
import { ReisenApi } from './features/travel/data/travel-api.service';

/** Alle Demo-Dienste (nur unter /demo) – auch für Tests, die die Demo als Ganzes prüfen. */
export const DEMO_PROVIDERS: Provider[] = [
  { provide: DEMO_MODE, useValue: true },
  { provide: HAUSHALT_DATA_PROVIDER, useClass: DemoHaushaltDataProvider },
  { provide: PrivateFinanceApi, useClass: DemoPrivateFinanceApi },
  { provide: OrganisationApi, useClass: DemoOrganisationApi },
  { provide: ReisenApi, useClass: DemoReisenApi },
  { provide: FxService, useClass: DemoFxService },
  { provide: HomeCurrency, useClass: DemoHomeCurrency },
  { provide: ContactsApiService, useClass: DemoContactsApiService },
  { provide: HouseholdApiService, useClass: DemoHouseholdApiService },
  // Ortsvorschläge in der Demo ohne externen Dienst (Beispielorte)
  { provide: PlacesService, useClass: DemoPlacesService },
  // Verknüpfungen in der Demo: Bestand live aus den Demo-Bereichen, nur im Browser (14.11.2026)
  { provide: ConnectionsApi, useClass: DemoConnectionsApi },
  // Connection Engine V2 in der Demo: abgeleitete Verbindungen aus den Demo-Daten (nur im Browser)
  { provide: AutoLinksApi, useClass: DemoAutoLinksApi },
];

/**
 * Die Demo unter /demo — eigene Datei, damit Demo-Daten und Bereichs-Dienste erst beim Öffnen der Demo geladen
 * werden und nicht im Startpaket jedes Besuchers der Landingpage landen. Die Demo-Provider gelten nur hier, unabhängig
 * von der Anmeldung.
 */
export const DEMO_ROUTES: Routes = [
  {
    path: '',
    providers: DEMO_PROVIDERS,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
        data: { shell: 'bare', dashboardNav: true, sidebarNav: true },
      },
      {
        path: 'finanzen',
        title: brandTitle('Finanzen – Demo'),
        loadComponent: () =>
          import('./features/finance/private-finance').then((m) => m.PrivateFinance),
        data: { dashboardNav: true, sidebarNav: true },
      },
      {
        path: 'haushalt',
        title: brandTitle('Haushalt – Demo'),
        loadComponent: () => import('./features/household/household').then((m) => m.Haushalt),
        data: { dashboardNav: true, sidebarNav: true },
      },
      {
        path: 'organisation',
        title: brandTitle('Organisation – Demo'),
        loadComponent: () =>
          import('./features/organization/organization').then((m) => m.Organisation),
        data: { dashboardNav: true, sidebarNav: true },
      },
      {
        path: 'reisen',
        title: brandTitle('Reisen – Demo'),
        loadComponent: () => import('./features/travel/travel').then((m) => m.Reisen),
        data: { dashboardNav: true, sidebarNav: true },
      },
      {
        // Dieselbe Komponente wie die echte Seite, nur mit DemoContactsApiService (siehe oben) statt echtem
        // Backend-Aufruf — zuvor fehlte diese Route komplett, wodurch "Familie & Freunde" aus der Demo heraus
        // zur Anmeldung zwang, obwohl der Rest der Demo ohne Login auskommt.
        path: 'familie',
        title: brandTitle('Personen & Gruppen – Demo'),
        loadComponent: () => import('./features/people/people').then((m) => m.Familie),
        data: { shell: 'bare', sidebarNav: true },
      },
    ],
  },
];
