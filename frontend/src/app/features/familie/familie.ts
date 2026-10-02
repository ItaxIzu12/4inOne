import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { AppShell } from '../../layout/app-shell';
import { ContactDto, ContactsApiService, ContactsOverview, ReceivedInviteDto, Relation } from '../../core/contacts/contacts-api.service';
import { DEMO_MODE } from '../../core/demo-context';

const RELATION_LABEL: Record<Relation, string> = { FAMILY: 'Familie', FRIEND: 'Freund:in' };

/** Familie & Freunde: Menschen, mit denen du verbunden bist. Eine Verbindung teilt nichts — sie ist nur die Grundlage,
 * später jemanden ausdrücklich zu einer Reise oder einem gemeinsamen Haushalt einzuladen. */
@Component({
  selector: 'app-familie',
  standalone: true,
  imports: [AppShell, FormsModule, DatePipe, NgTemplateOutlet],
  templateUrl: './familie.html',
  styleUrls: ['../einstellungen/einstellungen.css', '../profil/profil.css', './familie.css'],
})
export class Familie {
  private readonly api = inject(ContactsApiService);
  protected readonly demo = inject(DEMO_MODE);

  protected readonly data = signal<ContactsOverview | null>(null);
  protected readonly loadError = signal(false);
  protected readonly notice = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal<string | null>(null);
  protected readonly confirmRemove = signal<number | null>(null);

  protected readonly email = signal('');
  protected readonly relation = signal<Relation>('FRIEND');
  protected readonly label = RELATION_LABEL;

  protected readonly family = computed(() => (this.data()?.contacts ?? []).filter((c) => c.relation === 'FAMILY'));
  protected readonly friends = computed(() => (this.data()?.contacts ?? []).filter((c) => c.relation === 'FRIEND'));
  protected readonly isEmpty = computed(() => {
    const d = this.data();
    return !!d && !d.contacts.length && !d.sent.length && !d.received.length;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loadError.set(false);
    this.api.overview().subscribe({
      next: (d) => this.data.set(d),
      error: () => this.loadError.set(true),
    });
  }

  protected initial(name: string): string {
    return name.slice(0, 1).toUpperCase();
  }

  protected sendInvite(event: Event): void {
    event.preventDefault();
    if (this.busy()) return;
    const email = this.email().trim();
    this.notice.set('');
    if (!email || !email.includes('@')) {
      this.error.set('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }
    this.error.set('');
    this.busy.set('invite');
    this.api.invite(email, this.relation()).subscribe({
      next: (res) => {
        this.busy.set(null);
        this.email.set('');
        this.notice.set(
          res.email_sent
            ? `Einladung an ${res.email} gesendet.`
            : `Einladung für ${res.email} gespeichert, aber die E-Mail konnte nicht gesendet werden. Versuche es später noch einmal.`,
        );
        this.load();
      },
      error: (e: unknown) => {
        this.busy.set(null);
        this.error.set(this.errorText(e));
      },
    });
  }

  private errorText(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      if (e.status === 429) return 'Du hast in kurzer Zeit viele Einladungen gesendet. Bitte versuche es später noch einmal.';
      const first = (e.error as Record<string, string[] | string> | null)?.['email'];
      if (e.status === 400 && first) return Array.isArray(first) ? first[0] : first;
    }
    return 'Das hat nicht geklappt. Bitte versuche es noch einmal.';
  }

  protected answer(invite: ReceivedInviteDto, accept: boolean): void {
    if (this.busy()) return;
    this.busy.set(invite.token);
    this.notice.set('');
    const call = accept ? this.api.accept(invite.token).pipe(map(() => undefined)) : this.api.decline(invite.token);
    call.subscribe({
      next: () => {
        this.busy.set(null);
        this.notice.set(accept ? `Du bist jetzt mit ${invite.from_name} verbunden.` : 'Einladung abgelehnt.');
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.notice.set('Das hat nicht geklappt. Bitte versuche es noch einmal.');
        this.load();
      },
    });
  }

  protected cancel(id: number): void {
    if (this.busy()) return;
    this.busy.set(`sent-${id}`);
    this.api.cancelInvite(id).subscribe({
      next: () => {
        this.busy.set(null);
        this.notice.set('Einladung zurückgezogen.');
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.notice.set('Das hat nicht geklappt. Bitte versuche es noch einmal.');
      },
    });
  }

  protected remove(contact: ContactDto): void {
    if (this.busy()) return;
    this.busy.set(`contact-${contact.id}`);
    this.api.remove(contact.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.confirmRemove.set(null);
        this.notice.set(`Die Verbindung zu ${contact.name} wurde beendet.`);
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.notice.set('Das hat nicht geklappt. Bitte versuche es noch einmal.');
      },
    });
  }
}
