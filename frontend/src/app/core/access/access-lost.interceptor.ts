import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { MembershipChanges } from './membership-changes';

/** Geteilte Bereiche: dort kann der Zugriff jederzeit von jemand anderem entzogen werden. */
const SHARED = [`${API_BASE_URL}/reisen/`, `${API_BASE_URL}/haushalt/`, `${API_BASE_URL}/household/`];

/**
 * Lehnt der Server eine Änderung in einem geteilten Bereich mit 403/404 ab, ist die angezeigte Ansicht veraltet
 * (aus Reise/Haushalt entfernt, Eintrag von anderen gelöscht). Dann sofort neu laden statt nur „Fehler“ zu zeigen —
 * der Server bleibt die einzige Quelle der Wahrheit, das Frontend gibt hier keine Rechte, es spiegelt sie nur.
 */
export const accessLostInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method === 'GET' || !SHARED.some((prefix) => req.url.startsWith(prefix))) return next(req);
  const changes = inject(MembershipChanges);
  return next(req).pipe(
    tap({
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404)) changes.bump();
      },
    }),
  );
};
