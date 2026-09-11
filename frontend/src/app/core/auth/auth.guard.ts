import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Schützt App-Screens (Dashboard, Finanzen, Haushalt, Organisation,
 * Einstellungen) vor Zugriff ohne gültige Sitzung. Prüft den echten
 * Auth-Zustand aus AuthService — nicht nur, ob die Route "geschützt aussieht".
 *
 * Beim App-Start hat provideAppInitializer (app.config.ts) den
 * Refresh-Versuch über das httpOnly-Cookie bereits abgeschlossen, BEVOR der
 * Router die erste Route aktiviert — isAuthenticated() ist hier also schon
 * der korrekte, aktuelle Stand, kein zusätzlicher async Check nötig.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated() || router.parseUrl('/login');
};
