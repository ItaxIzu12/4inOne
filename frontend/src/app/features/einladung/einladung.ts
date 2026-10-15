import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ContactsApiService, Relation } from '../../core/contacts/contacts-api.service';
import { tokenFromLink } from '../../shared/link-token';

/** Ziel des Links aus der Einladungs-E-Mail (/einladung#<token>, ältere Links /einladung/<token>). Angenommen wird nur mit dem Konto, an dessen
 * E-Mail-Adresse die Einladung ging; für alle anderen (und für ungültige Links) sieht es gleich aus. */
@Component({
  selector: 'app-einladung',
  standalone: true,
  imports: [ErrorNoticeDirective, RouterLink, DatePipe],
  templateUrl: './einladung.html',
  styleUrls: ['../profil/profil.css', './einladung.css'],
})
export class Einladung {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ContactsApiService);
  private readonly router = inject(Router);
  private readonly token = tokenFromLink(inject(ActivatedRoute).snapshot);

  protected readonly invite = signal<{ from_name: string; relation: Relation; expires_at: string } | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'invalid' | 'guest'>('loading');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  constructor() {
    if (!this.auth.isAuthenticated()) {
      // Link bleibt in der Adresszeile, damit er nach dem Anmelden erneut geöffnet werden kann.
      this.state.set('guest');
      return;
    }
    if (!this.token) {
      this.state.set('invalid');
      return;
    }
    this.router.navigate(['/einladung'], { replaceUrl: true }); // Token sofort aus Adresszeile/Verlauf nehmen
    this.api.invitePreview(this.token).subscribe({
      next: (invite) => {
        this.invite.set(invite);
        this.state.set('ready');
      },
      error: () => this.state.set('invalid'),
    });
  }

  protected relationLabel(): string {
    return this.invite()?.relation === 'FAMILY' ? 'Familie' : 'Freund:in';
  }

  protected answer(accept: boolean): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    (accept ? this.api.accept(this.token).pipe(map(() => undefined)) : this.api.decline(this.token)).subscribe({
      next: () => this.router.navigateByUrl('/familie'),
      error: () => {
        this.busy.set(false);
        this.error.set('Das hat nicht geklappt. Bitte versuche es noch einmal.');
      },
    });
  }
}
