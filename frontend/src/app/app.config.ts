import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // scrollPositionRestoration: 'top' — jede Navigation (jeder Linkklick,
    // egal wie tief gescrollt war) landet oben auf der neuen Seite statt an
    // der zuletzt gescrollten Position. anchorScrolling erlaubt weiterhin
    // #anchor-Links innerhalb einer Seite.
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Ohne diesen Initializer geht das Access-Token (nur im Speicher,
    // ARCHITEKTUR.md §3.1) bei JEDEM Seiten-Reload verloren, obwohl das
    // httpOnly-Refresh-Cookie noch gültig ist — ein eigentlich angemeldeter
    // Nutzer würde nach F5 bei jedem authentifizierten Aufruf (z. B. dem
    // Transaktions-Modal, siehe features/finanzen) ein stilles 401 bekommen.
    // Scheitert der Versuch (kein/abgelaufenes Cookie), einfach normal als
    // "nicht angemeldet" weitermachen statt den App-Start zu blockieren.
    provideAppInitializer(() => firstValueFrom(inject(AuthService).refresh().pipe(catchError(() => of(null))))),
  ]
};
