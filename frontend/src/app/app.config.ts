import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // scrollPositionRestoration: 'top' — jede Navigation (jeder Linkklick,
    // egal wie tief gescrollt war) landet oben auf der neuen Seite statt an
    // der zuletzt gescrollten Position. anchorScrolling erlaubt weiterhin
    // #anchor-Links innerhalb einer Seite.
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    provideHttpClient(withFetch()),
  ]
};
