import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { HouseholdApiService } from '../../core/household/household-api.service';
import { HouseholdInviteModalService } from '../../core/household/household-invite-modal.service';
import { Modal } from '../modal/modal';

type Role = 'ADMIN' | 'MEMBER' | 'CHILD_ACCOUNT';

/**
 * EINE geteilte Einladungs-Modal-Instanz, einmal in app.html gemountet —
 * jeder Aufrufer (Onboarding-Block, künftig Einstellungen/Haushalt-
 * Verwaltung) öffnet sie nur über HouseholdInviteModalService.open(), statt
 * eine eigene Instanz zu rendern (siehe dortiger Docstring).
 */
@Component({
  selector: 'app-household-invite-modal',
  standalone: true,
  imports: [Modal, DatePipe],
  templateUrl: './household-invite-modal.html',
  styleUrl: './household-invite-modal.css',
})
export class HouseholdInviteModal {
  private readonly api = inject(HouseholdApiService);
  protected readonly modalService = inject(HouseholdInviteModalService);

  protected readonly email = signal('');
  protected readonly role = signal<Role>('MEMBER');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sentTo = signal<{ email: string; expiresAt: string } | null>(null);

  protected close(): void {
    this.modalService.close();
    // Formularzustand erst NACH dem Schließen zurücksetzen (kleine
    // Verzögerung wäre unnötig komplex) — beim nächsten Öffnen soll ein
    // leeres Formular stehen, nicht die letzte Einladung.
    this.email.set('');
    this.role.set('MEMBER');
    this.error.set(null);
    this.sentTo.set(null);
  }

  protected onSubmit(event: Event): void {
    // (submit) + explizites preventDefault statt (ngSubmit): dieses
    // Formular nutzt keine Angular-Forms-Direktive (kein Reactive-/
    // FormsModule), ohne NgForm ruft Angular bei (ngSubmit) NICHT
    // automatisch preventDefault() auf — siehe features/finanzen/finanzen.ts
    // onAddExpenseSubmit()-Kommentar für denselben, dort schon gefundenen Bug.
    event.preventDefault();

    if (!this.email().trim()) {
      this.error.set('Bitte eine E-Mail-Adresse eingeben.');
      return;
    }

    this.error.set(null);
    this.submitting.set(true);
    this.api.sendInvite(this.email().trim(), this.role()).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.sentTo.set({ email: res.email, expiresAt: res.expires_at });
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.error.set(this.extractErrorMessage(err));
      },
    });
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.status === 429) {
      return 'Zu viele Einladungen in kurzer Zeit. Bitte versuche es später erneut.';
    }
    const body = err.error as Record<string, string[] | string> | undefined;
    const emailError = body?.['email'];
    if (Array.isArray(emailError) && emailError.length) {
      return emailError[0];
    }
    const detail = body?.['detail'];
    if (typeof detail === 'string') {
      return detail;
    }
    return 'Einladung konnte nicht gesendet werden. Bitte versuche es erneut.';
  }
}
