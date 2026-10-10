import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';

/** Voreinstellung für neue Konten — identisch mit backend/core/currencies.py DEFAULT_HOME_CURRENCY. Die einzige Stelle,
 * an der eine Währung vorgegeben ist; danach gilt nur noch, was im Profil eingestellt ist. */
export const ACCOUNT_DEFAULT_HOME_CURRENCY = 'EUR';

/**
 * Die Heimatwährung des Nutzers (Einstellungen → Profil) — Ziel jeder Umrechnung. Keine Komponente nimmt eine
 * Währung an; alle lesen sie hier.
 */
@Injectable({ providedIn: 'root' })
export class HomeCurrency {
  private readonly auth = inject(AuthService);
  readonly code = computed(() => this.auth.currentUser()?.home_currency ?? ACCOUNT_DEFAULT_HOME_CURRENCY);
}

/** Demo: die Heimatwährung der Beispielperson — eigene, änderbare Einstellung, unabhängig von einer Anmeldung. */
@Injectable()
export class DemoHomeCurrency extends HomeCurrency {
  private readonly demo = signal(ACCOUNT_DEFAULT_HOME_CURRENCY);
  override readonly code = this.demo.asReadonly();
  set(code: string): void {
    this.demo.set(code);
  }
}
