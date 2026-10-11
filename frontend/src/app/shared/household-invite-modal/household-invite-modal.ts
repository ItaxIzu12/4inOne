import { ErrorNoticeDirective } from '../error-notice/error-notice';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ContactsApiService, SharedArea } from '../../core/contacts/contacts-api.service';
import { HouseholdApiService } from '../../core/household/household-api.service';
import { HouseholdInviteModalService } from '../../core/household/household-invite-modal.service';
import { InvitationsService } from '../../core/invitations/invitations.service';
import { AppSelect, SelectOption } from '../form/select';
import { Modal } from '../modal/modal';

interface Candidate {
  contactId: number;
  name: string;
  area: SharedArea;
}

/**
 * EINE geteilte Einladungs-Modal-Instanz, einmal in app.html gemountet — jeder Aufrufer (Onboarding-Block,
 * Haushalt › Einkauf) öffnet sie nur über HouseholdInviteModalService.open().
 *
 * Invitation System V1: eingeladen werden nur eigene Kontakte (keine freie E-Mail-Suche, keine Konto-Erkennung),
 * in den eigenen aktiven Haushalt, mit der Rolle „Mitglied“. Die Person wird erst Mitglied, wenn sie annimmt.
 */
@Component({
  selector: 'app-household-invite-modal',
  standalone: true,
  imports: [ErrorNoticeDirective, Modal, RouterLink, AppSelect],
  templateUrl: './household-invite-modal.html',
  styleUrl: './household-invite-modal.css',
})
export class HouseholdInviteModal {
  private readonly contactsApi = inject(ContactsApiService);
  private readonly householdApi = inject(HouseholdApiService);
  private readonly invitations = inject(InvitationsService);
  private readonly auth = inject(AuthService);
  protected readonly modalService = inject(HouseholdInviteModalService);

  protected readonly loading = signal(false);
  protected readonly householdName = signal('');
  protected readonly canInvite = signal(false);
  protected readonly candidates = signal<Candidate[]>([]);
  protected readonly invitedNames = signal<string[]>([]);
  protected readonly contactCount = signal(0);
  protected readonly selected = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sentTo = signal<string | null>(null);
  protected readonly signedIn = computed(() => this.auth.isAuthenticated());
  protected readonly options = computed<SelectOption[]>(() =>
    this.candidates().map((c) => ({ value: String(c.contactId), label: c.name })),
  );

  constructor() {
    effect(() => {
      if (this.modalService.isOpen()) untracked(() => this.load());
    });
  }

  private load(): void {
    this.error.set(null);
    this.sentTo.set(null);
    this.selected.set('');
    if (!this.signedIn()) return;
    this.loading.set(true);
    this.householdApi.members().subscribe({
      next: (res) => {
        this.householdName.set(res.household?.name ?? '');
        this.canInvite.set(res.can_invite);
      },
      error: () => this.canInvite.set(false),
    });
    this.contactsApi.overview().subscribe({
      next: (overview) => {
        this.loading.set(false);
        this.contactCount.set(overview.contacts.length);
        const list: Candidate[] = [];
        const invited: string[] = [];
        for (const contact of overview.contacts) {
          const area = contact.can_add_to.find((a) => a.kind === 'HOUSEHOLD');
          if (area) list.push({ contactId: contact.id, name: contact.name, area });
          if (contact.invited_to.some((a) => a.kind === 'HOUSEHOLD')) invited.push(contact.name);
        }
        this.candidates.set(list);
        this.invitedNames.set(invited);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Deine Kontakte konnten nicht geladen werden.');
      },
    });
  }

  protected close(): void {
    this.modalService.close();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const candidate = this.candidates().find((c) => String(c.contactId) === this.selected());
    if (!candidate) {
      this.error.set('Bitte wähle eine Person aus.');
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.invitations.invite(candidate.contactId, 'HOUSEHOLD', candidate.area.id).subscribe({
      next: () => {
        this.submitting.set(false);
        this.sentTo.set(candidate.name);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(InvitationsService.errorText(err));
      },
    });
  }
}
