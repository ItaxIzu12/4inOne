import { ActivatedRouteSnapshot } from '@angular/router';

/**
 * Token aus einem Mail-Link lesen. Neue Links tragen es im Fragment (`/seite#token=…` bzw. `/einladung#…`): alles
 * hinter `#` schickt der Browser nie an einen Server, es landet also in keinem Zugriffsprotokoll und keinem Referer.
 * Ältere Links (`?token=…`, `/einladung/<token>`) funktionieren weiter.
 */
export function tokenFromLink(route: ActivatedRouteSnapshot, key = 'token'): string {
  const fragment = route.fragment ?? '';
  if (fragment) {
    const value = fragment.includes('=') ? new URLSearchParams(fragment).get(key) : fragment;
    if (value) return value;
  }
  return route.queryParamMap?.get(key) ?? route.paramMap?.get(key) ?? '';
}
