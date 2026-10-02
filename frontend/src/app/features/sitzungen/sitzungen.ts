import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, LoginSession } from '../../core/auth/auth.service';
import { AppShell } from '../../layout/app-shell';
import { describeDevice } from '../../shared/device/describe-device';

/** Einstellungen → Aktive Sitzungen: wo bin ich angemeldet, und einzelne Geräte (oder alle anderen) abmelden. */
@Component({
  selector: 'app-sitzungen',
  standalone: true,
  imports: [ErrorNoticeDirective, AppShell, RouterLink, DatePipe],
  templateUrl: './sitzungen.html',
  styleUrls: ['../einstellungen/einstellungen.css', '../profil/profil.css', './sitzungen.css'],
})
export class Sitzungen {
  private readonly auth = inject(AuthService);

  protected readonly sessions = signal<LoginSession[] | null>(null);
  protected readonly loadError = signal(false);
  protected readonly busy = signal<string | null>(null);
  protected readonly notice = signal('');
  protected readonly others = computed(() => (this.sessions() ?? []).filter((s) => !s.current));
  protected readonly describe = describeDevice;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loadError.set(false);
    this.auth.sessions().subscribe({
      next: (rows) => this.sessions.set(rows),
      error: () => this.loadError.set(true),
    });
  }

  protected revoke(session: LoginSession): void {
    if (this.busy()) return;
    this.busy.set(session.id);
    this.notice.set('');
    this.auth.revokeSession(session.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.notice.set(`${describeDevice(session.device)} wurde abgemeldet.`);
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.notice.set('Abmelden hat nicht geklappt. Bitte versuche es noch einmal.');
      },
    });
  }

  protected revokeOthers(): void {
    if (this.busy()) return;
    this.busy.set('all');
    this.notice.set('');
    this.auth.revokeOtherSessions().subscribe({
      next: () => {
        this.busy.set(null);
        this.notice.set('Alle anderen Geräte wurden abgemeldet.');
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.notice.set('Abmelden hat nicht geklappt. Bitte versuche es noch einmal.');
      },
    });
  }
}
