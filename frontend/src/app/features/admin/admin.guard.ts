import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/** Nur zur Navigation: wer kein Admin ist, landet auf der Startseite. Die echte Prüfung (Staff + Zwei-Faktor) macht
 * das Backend bei jeder Anfrage — dieser Guard schützt keine Daten, er spart nur eine leere Seite. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (!auth.isAuthenticated()) return inject(Router).parseUrl('/login');
  return auth.currentUser()?.is_admin === true || inject(Router).parseUrl('/');
};
