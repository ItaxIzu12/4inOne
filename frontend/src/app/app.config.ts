import { ApplicationConfig, DOCUMENT, PLATFORM_ID, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { provideClientHydration, withNoIncrementalHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, TitleStrategy, withInMemoryScrolling } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { accessLostInterceptor } from './core/access/access-lost.interceptor';
import { AuthService } from './core/auth/auth.service';
import { PageViews } from './core/analytics/page-views';
import { SeoTitleStrategy } from './core/seo/seo-title-strategy';
import { DEMO_ONLY } from './core/demo-only';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // scrollPositionRestoration: 'top' — jede Navigation (jeder Linkklick,
    // egal wie tief gescrollt war) landet oben auf der neuen Seite statt an
    // der zuletzt gescrollten Position. anchorScrolling erlaubt weiterhin
    // #anchor-Links innerhalb einer Seite.
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    // Seitentitel und Meta-Beschreibung je Route (data.description)
    { provide: TitleStrategy, useClass: SeoTitleStrategy },
    // Cookielose Besucherzählung der öffentlichen Seiten (core/analytics/page-views.ts)
    // Beim Vorrendern (Build ohne Browser) wird nichts gezählt und keine Anmeldung geprüft
    provideAppInitializer(() => {
      // Testversion nur mit Demo (GitHub Pages): kein Backend, also auch keine Zählung
      if (isPlatformBrowser(inject(PLATFORM_ID)) && !DEMO_ONLY) inject(PageViews).start();
    }),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, accessLostInterceptor])),
    // Ohne diesen Initializer geht das Access-Token (nur im Speicher,
    // ARCHITEKTUR.md §3.1) bei JEDEM Seiten-Reload verloren, obwohl das
    // httpOnly-Refresh-Cookie noch gültig ist — ein eigentlich angemeldeter
    // Nutzer würde nach F5 bei jedem authentifizierten Aufruf (z. B. dem
    // Transaktions-Modal, siehe features/finanzen) ein stilles 401 bekommen.
    // Scheitert der Versuch (kein/abgelaufenes Cookie), einfach normal als
    // "nicht angemeldet" weitermachen statt den App-Start zu blockieren.
    provideAppInitializer(() => {
      if (!isPlatformBrowser(inject(PLATFORM_ID)) || DEMO_ONLY) return;
      const auth = inject(AuthService);
      const doc = inject(DOCUMENT);
      // Kein gültiges Refresh-Cookie: auch den Hinweis für den Webserver entfernen (forceLogout)
      return firstValueFrom(auth.refresh().pipe(catchError(() => of(auth.forceLogout())))).then(() => {
        if (auth.isAuthenticated() && servedPrerenderedLanding(doc)) return reloadForApp(doc);
        return undefined;
      });
    }),
    // Vorgerenderte öffentliche Seiten (app.routes.server.ts) übernimmt der Browser, statt sie neu zu zeichnen.
    // Ohne Event-Replay (kommt mit der inkrementellen Hydration): es legt Inline-Skripte ins HTML, die die strenge CSP
    // (script-src 'self', deploy/nginx) blockiert. Ein Klick in den ersten Millisekunden vor dem Laden geht dann verloren.
    provideClientHydration(withNoIncrementalHydration()),
  ]
};

/**
 * Angemeldet, aber der Webserver hat unter / die vorgerenderte Landingpage geliefert (Hinweis-Cookie fehlte, z. B.
 * gleich nach dem Update): Die App zeichnet dort das Dashboard, das passt nicht zum vorgerenderten HTML. Einmal neu
 * laden — jetzt mit Hinweis-Cookie, also mit der normalen App-Datei. Höchstens einmal je Sitzung, damit eine falsch
 * eingerichtete Weiche keine Schleife baut.
 */
function servedPrerenderedLanding(doc: Document): boolean {
  return doc.location.pathname === '/' && !!doc.querySelector('app-root[ng-server-context]');
}

function reloadForApp(doc: Document): Promise<never> | undefined {
  const key = '4io_reloaded_for_app';
  try {
    if (sessionStorage.getItem(key)) return undefined;
    sessionStorage.setItem(key, '1');
  } catch {
    return undefined;
  }
  doc.location.reload();
  return new Promise<never>(() => undefined); // nicht weiterstarten, die Seite lädt gleich neu
}
