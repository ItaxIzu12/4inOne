import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { InvitationsService } from '../../core/invitations/invitations.service';
import { Brand } from '../../shared/brand/brand';
import { tokenFromLink } from '../../shared/link-token';

type State = 'checking' | 'done' | 'invalid';

/**
 * Ziel des Links aus der Bestätigungs-Mail (/email-bestaetigen?token=…). Das Token wird sofort aus der Adresszeile
 * entfernt und nur einmal an das Backend geschickt. Danach erscheinen Kontakt-Einladungen in Glocke und Startseite.
 */
@Component({
  selector: 'app-email-bestaetigen',
  standalone: true,
  imports: [RouterLink, Brand],
  templateUrl: './email-bestaetigen.html',
  styleUrl: '../passwort-vergessen/passwort-vergessen.css',
})
export class EmailBestaetigen {
  protected readonly auth = inject(AuthService);
  private readonly invitations = inject(InvitationsService);
  protected readonly state = signal<State>('checking');

  constructor() {
    const token = tokenFromLink(inject(ActivatedRoute).snapshot);
    if (!token) {
      this.state.set('invalid');
      return;
    }
    inject(Router).navigate([], { queryParams: {}, fragment: undefined, replaceUrl: true });
    this.auth.verifyEmail(token).subscribe({
      next: () => {
        this.state.set('done');
        if (this.auth.isAuthenticated()) {
          this.auth.reloadProfile().subscribe({ error: () => undefined });
          this.invitations.refresh();
        }
      },
      error: () => this.state.set('invalid'),
    });
  }
}
