import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_BASE_URL, API_ORIGIN } from '../api.config';
import { AuthService } from './auth.service';

const REFRESH_URL = `${API_BASE_URL}/auth/refresh/`;

// Login/Register/Passwort-Reset: ein 401 hier bedeutet falsche Zugangsdaten
// bzw. ein ungültiges Reset-Token, NICHT eine abgelaufene Sitzung — für
// diese Endpunkte darf kein automatischer Refresh-Versuch ausgelöst werden,
// sonst würde z. B. ein falsches Passwort einen sinnlosen Refresh-Aufruf
// nach sich ziehen, bevor die eigentliche Fehlermeldung ankommt.
const PUBLIC_AUTH_URLS = [
  `${API_BASE_URL}/auth/login/`,
  `${API_BASE_URL}/auth/register/`,
  `${API_BASE_URL}/auth/password-reset/request/`,
  `${API_BASE_URL}/auth/password-reset/confirm/`,
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!req.url.startsWith(API_ORIGIN)) {
    return next(req);
  }

  const token = auth.accessToken();
  const authorized = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      if (req.url === REFRESH_URL) {
        // Der Refresh-Call selbst kommt mit 401 zurück (Cookie fehlt/ist
        // abgelaufen/ungültig) — ein erneuter Refresh-Versuch würde in eine
        // Endlosschleife laufen, also nur lokal ausloggen (forceLogout ist
        // ein No-Op, falls eh schon kein Token da war), OHNE hier zu
        // navigieren: dieser Zweig feuert auch für den ganz normalen,
        // erwarteten Refresh-Check beim App-Start (provideAppInitializer,
        // app.config.ts) auf öffentlichen Seiten (z. B. / — features/home) —
        // ein Erstbesuch ganz ohne Login würde sonst fälschlich zu /login
        // umgeleitet, obwohl die aktuelle Route gar keinen Login braucht.
        // Ein echter Redirect passiert weiter unten, wenn eine ECHTE
        // authentifizierte Anfrage (nicht der Refresh-Call selbst) nach
        // einem gescheiterten Refresh-Versuch fehlschlägt.
        auth.forceLogout();
        return throwError(() => error);
      }

      if (PUBLIC_AUTH_URLS.includes(req.url)) {
        return throwError(() => error);
      }

      // Echte, potenziell abgelaufene Sitzung: genau EINEN Refresh-Versuch
      // starten und die ursprüngliche Anfrage mit dem neuen Access-Token
      // wiederholen.
      return auth.refresh().pipe(
        switchMap((res) => next(req.clone({ setHeaders: { Authorization: `Bearer ${res.access}` } }))),
        catchError((refreshError: unknown) => {
          auth.forceLogout();
          router.navigateByUrl('/login');
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
