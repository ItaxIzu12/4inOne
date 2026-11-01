import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DEMO_MODE } from '../../core/demo-context';
import { HouseholdInviteModalService } from '../../core/household/household-invite-modal.service';
import { AppIcon } from '../../shared/icons/app-icon';
import { Modal } from '../../shared/modal/modal';
import { HouseholdPeople } from './household-people.service';

/**
 * Haushalt › Kopf (01.11.2026): kleine Avatare „wer ist dabei“ — antippen zeigt, wer im Haushalt ist, was alle sehen
 * und was privat bleibt, dazu „Person einladen“ (nur wer einladen darf) und „Verwalten“ (Personen & Gruppen).
 * Allein im Haushalt: nur „Person einladen“.
 */
@Component({
  selector: 'app-household-people',
  standalone: true,
  imports: [AppIcon, Modal, RouterLink],
  templateUrl: './household-people.html',
  styleUrl: './household-people.scss',
})
export class HouseholdPeopleButton {
  protected readonly people = inject(HouseholdPeople);
  private readonly invite = inject(HouseholdInviteModalService);
  protected readonly demo = inject(DEMO_MODE);
  protected readonly open = signal(false);

  protected readonly shown = computed(() => this.people.members().slice(0, 3));
  protected readonly more = computed(() => Math.max(0, this.people.members().length - 3));
  protected readonly alone = computed(() => this.people.loaded() && this.people.others().length === 0);
  /** Vorgelesen nach den sichtbaren Initialen: „Haushalt: du, Max – wer was sieht“. */
  protected readonly label = computed(() => {
    const names = this.people.members().map((m) => (m.is_self ? 'du' : m.name));
    return `Haushalt: ${names.join(', ')} – wer was sieht`;
  });

  protected initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }
  protected inviteSomeone(): void {
    this.open.set(false);
    this.invite.open();
  }
}
