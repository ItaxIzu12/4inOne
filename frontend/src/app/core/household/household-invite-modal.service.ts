import { Injectable, signal } from '@angular/core';

/**
 * Steuert die EINE geteilte Einladungs-Modal-Instanz app-weit (siehe
 * shared/household-invite-modal, einmal in app.html gemountet) — jeder
 * Aufrufer (Onboarding-Block, künftig Einstellungen/Haushalt-Verwaltung)
 * ruft nur open() auf, statt eine eigene Modal-Instanz zu rendern.
 */
@Injectable({ providedIn: 'root' })
export class HouseholdInviteModalService {
  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }
}
