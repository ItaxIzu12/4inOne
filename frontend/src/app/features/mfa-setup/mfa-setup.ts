import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MfaApiService } from '../../core/mfa/mfa-api.service';

type Step = 'start' | 'verify' | 'done';

/** Echter MFA-Einrichtungs-Flow (ersetzt den früheren ComingSoon-Platzhalter
 * unter /einstellungen/zwei-faktor) — Backend existierte bereits
 * (core/mfa_views.py), diese Oberfläche fehlte noch. Wird auch vom
 * Onboarding-Block (Schritt 4, shared/onboarding) verlinkt. */
@Component({
  selector: 'app-mfa-setup',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mfa-setup.html',
  styleUrl: './mfa-setup.css',
})
export class MfaSetup {
  private readonly api = inject(MfaApiService);
  private readonly router = inject(Router);

  protected readonly step = signal<Step>('start');
  protected readonly qrCode = signal<string | null>(null);
  protected readonly secret = signal<string | null>(null);
  protected readonly code = signal('');
  protected readonly backupCodes = signal<string[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly alreadyEnabled = signal(false);

  protected startSetup(): void {
    this.error.set(null);
    this.loading.set(true);
    this.api.setup().subscribe({
      next: (res) => {
        this.loading.set(false);
        this.qrCode.set(res.qr_code);
        this.secret.set(res.secret);
        this.step.set('verify');
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 400) {
          // MfaSetupView gibt 400, wenn bereits ein bestätigtes Gerät
          // existiert (core/mfa_views.py) — kein echter Fehler, nur ein
          // anderer Anzeigezustand.
          this.alreadyEnabled.set(true);
        } else {
          this.error.set('Einrichtung konnte nicht gestartet werden. Bitte versuche es erneut.');
        }
      },
    });
  }

  protected onVerifySubmit(event: Event): void {
    event.preventDefault();
    if (this.code().trim().length !== 6) {
      this.error.set('Bitte den 6-stelligen Code aus deiner Authenticator-App eingeben.');
      return;
    }

    this.error.set(null);
    this.loading.set(true);
    this.api.verify(this.code().trim()).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.backupCodes.set(res.backup_codes);
        this.step.set('done');
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(
          err.status === 429
            ? 'Zu viele Versuche. Bitte warte ein paar Minuten und versuche es erneut.'
            : 'Der Code ist ungültig oder abgelaufen. Bitte versuche es erneut.',
        );
      },
    });
  }

  protected finish(): void {
    this.router.navigateByUrl('/app');
  }
}
