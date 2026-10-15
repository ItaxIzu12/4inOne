import { Injectable, signal } from '@angular/core';

/**
 * Ein Zähler für „Mitgliedschaften haben sich geändert“: nach einer angenommenen Einladung oder wenn der Server
 * eine Aktion in einem geteilten Bereich mit 403/404 ablehnt (z. B. weil man inzwischen entfernt wurde). Reisen,
 * Haushalt und Personen & Gruppen laden dann neu, damit keine veraltete Ansicht stehen bleibt.
 * Bewusst ohne Abhängigkeiten, damit der HTTP-Interceptor ihn ohne Zyklus nutzen kann.
 */
@Injectable({ providedIn: 'root' })
export class MembershipChanges {
  readonly version = signal(0);

  bump(): void {
    this.version.update((v) => v + 1);
  }
}
