import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MfaApiService } from '../../core/mfa/mfa-api.service';
import { AppShell } from '../../layout/app-shell';

type Step = 'loading' | 'active' | 'start' | 'scan' | 'codes';

const STEPS = ['App holen', 'Code scannen', 'Bestätigen'];

/** Einstellungen → Zwei-Faktor-Authentifizierung.
 * Zeigt zuerst den Zustand (aktiv oder nicht) und führt sonst in drei Schritten durch die Einrichtung:
 * App holen → QR-Code scannen und Code bestätigen → Backup-Codes sichern. Backend: core/mfa_views.py.
 * Wird auch vom Onboarding (shared/onboarding) verlinkt. */
@Component({
  selector: 'app-mfa-setup',
  standalone: true,
  imports: [AppShell, RouterLink],
  templateUrl: './mfa-setup.html',
  styleUrls: ['../einstellungen/einstellungen.css', '../profil/profil.css', './mfa-setup.css'],
})
export class MfaSetup {
  private readonly api = inject(MfaApiService);

  protected readonly steps = STEPS;
  protected readonly step = signal<Step>('loading');
  protected readonly qrCode = signal<string | null>(null);
  protected readonly secret = signal<string | null>(null);
  protected readonly code = signal('');
  protected readonly backupCodes = signal<string[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly copied = signal('');
  protected readonly saved = signal(false);

  /** Für die Fortschrittsanzeige (0 = App holen, 1 = Scannen und Bestätigen, 2 = Codes sichern). */
  protected readonly stepIndex = computed(() => ({ loading: -1, active: -1, start: 0, scan: 1, codes: 2 })[this.step()]);
  protected readonly readableSecret = computed(() => (this.secret() ?? '').replace(/(.{4})/g, '$1 ').trim());

  constructor() {
    this.api.status().subscribe({
      next: (res) => this.step.set(res.enabled ? 'active' : 'start'),
      // Ohne Antwort lieber die Einrichtung anbieten; das Backend lehnt sie ab, falls 2FA schon aktiv ist.
      error: () => this.step.set('start'),
    });
  }

  protected startSetup(): void {
    this.error.set(null);
    this.loading.set(true);
    this.api.setup().subscribe({
      next: (res) => {
        this.loading.set(false);
        this.qrCode.set(res.qr_code);
        this.secret.set(res.secret);
        this.step.set('scan');
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        // 400: es gibt schon ein bestätigtes Gerät — kein Fehler, nur ein anderer Zustand.
        if (err.status === 400) this.step.set('active');
        else this.error.set('Die Einrichtung konnte nicht gestartet werden. Bitte versuche es noch einmal.');
      },
    });
  }

  protected onCode(value: string): void {
    this.code.set(value.replace(/\D/g, '').slice(0, 6));
    this.error.set(null);
  }

  protected verify(event?: Event): void {
    event?.preventDefault();
    if (this.loading()) return;
    if (this.code().length !== 6) {
      this.error.set('Bitte gib den 6-stelligen Code aus deiner Authenticator-App ein.');
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    this.api.verify(this.code()).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.backupCodes.set(res.backup_codes);
        this.step.set('codes');
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.code.set('');
        this.error.set(
          err.status === 429
            ? 'Zu viele Versuche. Bitte warte ein paar Minuten und versuche es noch einmal.'
            : 'Der Code stimmt nicht oder ist abgelaufen. Prüfe die Uhrzeit deines Geräts und versuche es mit dem aktuellen Code noch einmal.',
        );
      },
    });
  }

  protected async copy(what: 'secret' | 'codes'): Promise<void> {
    const text = what === 'secret' ? (this.secret() ?? '') : this.backupCodes().join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(what);
    } catch {
      this.copied.set('failed');
    }
  }

  protected download(): void {
    const text = `4inOne – Backup-Codes für die Zwei-Faktor-Authentifizierung\nJeder Code funktioniert einmal.\n\n${this.backupCodes().join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = '4inone-backup-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  }
}
