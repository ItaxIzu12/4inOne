import { Component, ElementRef, HostListener, Injector, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { acceptedMessage, ContactInviteInfo, Invitation, InvitationsService } from '../../core/invitations/invitations.service';
import { AppIcon } from '../icons/app-icon';
import { devLinkPath } from '../dev-link';
import { timeAgo } from '../time-ago';

/**
 * Glocke in der Kopfzeile: offene Einladungen mit Annehmen/Ablehnen. Liest dieselbe Quelle wie Startseite und
 * Personen & Gruppen (InvitationsService). Lädt beim Erscheinen der Kopfzeile und beim Öffnen — kein Polling.
 * Am Rechner ein Popover unter der Glocke, am Handy eine Fläche über die volle Breite unter der Kopfzeile.
 */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [AppIcon, RouterLink],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.css',
})
export class NotificationBell {
  /** In der Demo gibt es kein Konto — die Glocke zeigt dort nur den leeren Zustand und ruft nichts ab. */
  readonly demo = input(false);

  protected readonly store = inject(InvitationsService);
  private readonly auth = inject(AuthService);
  /** Ohne bestätigte E-Mail-Adresse kommen Kontaktanfragen nicht in der App an — dann ein ruhiger Hinweis. */
  protected readonly needsVerification = computed(() => !this.demo() && this.auth.currentUser()?.email_verified === false);
  protected readonly resendState = signal<'idle' | 'sending' | 'sent' | 'error'>('idle');
  /** Nur lokal: Bestätigungslink direkt, weil keine echte Mail verschickt wird. */
  protected readonly devLink = signal<string | null>(null);
  protected readonly open = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly items = computed(() => (this.demo() ? [] : this.store.pending()));
  protected readonly accepted = computed(() => (this.demo() ? [] : this.store.accepted()));
  protected readonly unread = computed(() => (this.demo() ? 0 : this.store.unread()));
  protected readonly label = computed(() => {
    const count = this.unread();
    return count ? `Benachrichtigungen, ${count} ungelesen` : 'Benachrichtigungen';
  });
  protected readonly ago = timeAgo;

  constructor() {
    afterNextRender(() => {
      if (!this.demo()) this.store.refresh();
    });
  }

  protected toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.open.set(true);
    if (!this.demo()) {
      this.store.message.set('');
      this.store.refresh();
    }
    // Fokus in das Panel: die erste Aktion, sonst die Überschrift — Tastatur und Screenreader starten dort.
    afterNextRender(
      () => {
        const panel = this.host.nativeElement.querySelector<HTMLElement>('.bell-panel');
        (panel?.querySelector<HTMLElement>('button.bell-accept') ?? panel?.querySelector<HTMLElement>('.bell-panel__title'))?.focus();
        if (!this.demo()) this.store.markRead();
      },
      { injector: this.injector },
    );
  }

  protected close(returnFocus = true): void {
    if (!this.open()) return;
    this.open.set(false);
    if (returnFocus) this.trigger()?.nativeElement.focus();
  }

  protected accept(invitation: Invitation): void {
    this.store.accept(invitation).subscribe();
  }

  protected decline(invitation: Invitation): void {
    this.store.decline(invitation).subscribe();
  }

  protected readonly acceptedText = acceptedMessage;

  protected answerContact(invite: ContactInviteInfo, accept: boolean): void {
    this.store.answerContact(invite, accept).subscribe();
  }

  protected resend(): void {
    this.resendState.set('sending');
    this.auth.resendVerification().subscribe({
      next: (res) => {
        this.devLink.set(devLinkPath(res.dev_link));
        this.resendState.set('sent');
      },
      error: () => this.resendState.set('error'),
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }
}
