import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { MembershipChanges } from '../../core/access/membership-changes';
import { HouseholdApiService, HouseholdMember } from '../../core/household/household-api.service';

/**
 * Wer ist im Haushalt (01.11.2026)? Ein Stand für die Seite: Avatare im Kopf und der Satz „Sehen alle im Haushalt: …“
 * in den Dialogen. Lädt neu, wenn sich Mitgliedschaften ändern. Bereitgestellt von der Haushalt-Seite.
 */
@Injectable()
export class HouseholdPeople {
  private readonly api = inject(HouseholdApiService);
  readonly members = signal<HouseholdMember[]>([]);
  readonly canInvite = signal(false);
  readonly loaded = signal(false);
  /** Alle außer mir. */
  readonly others = computed(() => this.members().filter((m) => !m.is_self));

  constructor() {
    const changes = inject(MembershipChanges).version;
    effect(() => {
      changes();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.api.members().subscribe({
      next: (r) => {
        this.members.set(r.members ?? []);
        this.canInvite.set(!!r.can_invite);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  /** Satz für Dialoge. `adultsOnly`: Geräte/Verträge sehen Kind-Konten nicht. Leer, solange nichts geladen ist. */
  audience(adultsOnly = false): string {
    if (!this.loaded() || !this.members().length) return '';
    const names = this.others()
      .filter((m) => !adultsOnly || m.role !== 'CHILD_ACCOUNT')
      .map((m) => m.name);
    if (!names.length) return 'Nur du – noch niemand sonst im Haushalt.';
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} und ${names.at(-1)}`;
    return `Sehen ${adultsOnly ? 'alle Erwachsenen' : 'alle'} im Haushalt: du und ${list}.`;
  }
}
