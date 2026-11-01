import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import { ContactDto, ContactsApiService } from '../../core/contacts/contacts-api.service';
import { DEMO_MODE } from '../../core/demo-context';
import { AppIcon } from '../../shared/icons/app-icon';
import { Modal } from '../../shared/modal/modal';
import { CalendarColor, CalendarRole, CalendarShares, OrganisationApi, SharedCalendar, ShareRole } from './organisation-api.service';

/** 'all' · 'mine' · ID eines gemeinsamen Kalenders · `p<Konto-ID>` = für mich freigegebener Kalender einer Person */
export type CalendarFilter = 'all' | 'mine' | number | `p${number}`;

export const CALENDAR_COLORS: { value: CalendarColor; label: string }[] = [
  { value: 'green', label: 'Grün' },
  { value: 'blue', label: 'Blau' },
  { value: 'amber', label: 'Bernstein' },
  { value: 'rose', label: 'Rosé' },
  { value: 'violet', label: 'Violett' },
  { value: 'slate', label: 'Schiefer' },
];
const ROLE_LABEL: Record<CalendarRole, string> = { OWNER: 'Besitzer:in', EDITOR: 'Kann bearbeiten', VIEWER: 'Kann ansehen' };

/**
 * Organisation › Kalender › Gemeinsame Kalender (31.10.2026): oben eine Filterleiste (Alle · Nur meine · je Kalender)
 * und „Gemeinsame Kalender“ zum Verwalten — anlegen, Personen aus „Dein Kreis“ einladen (Rolle wählbar), Rollen
 * ändern, entfernen, austreten, löschen. Alle Regeln prüft der Server (backend/organisation/calendars.py); hier wird
 * nur angeboten, was die eigene Rolle erlaubt. Private Termine sieht niemand — das steht im Dialog ausdrücklich.
 */
@Component({
  selector: 'app-org-calendars',
  standalone: true,
  imports: [AppIcon, Modal],
  templateUrl: './org-calendars.html',
  styleUrl: './org-calendars.scss',
})
export class OrgCalendars {
  private readonly api = inject(OrganisationApi);
  private readonly contactsApi = inject(ContactsApiService);
  /** In der Demo nimmt niemand Einladungen an — dort lässt sich das Annehmen ausdrücklich simulieren. */
  protected readonly demo = inject(DEMO_MODE);

  readonly calendars = input<SharedCalendar[]>([]);
  /** Kalenderfreigaben wie Outlook (für wen meiner, wessen für mich). */
  readonly shares = input<CalendarShares | null>(null);
  readonly filter = model<CalendarFilter>('all');
  /** Etwas hat sich geändert — die Seite lädt Kalender und Termine neu. */
  readonly changed = output<void>();

  protected readonly colors = CALENDAR_COLORS;
  protected readonly roleLabel = ROLE_LABEL;
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  // Neuer Kalender
  protected readonly newName = signal('');
  protected readonly newColor = signal<CalendarColor>('green');
  // Einladen (je Kalender)
  protected readonly contacts = signal<ContactDto[] | null>(null);
  protected readonly inviteFor = signal<number | null>(null);
  protected readonly inviteContact = signal<number | null>(null);
  protected readonly inviteRole = signal<Exclude<CalendarRole, 'OWNER'>>('EDITOR');
  protected readonly confirmDelete = signal<number | null>(null);
  // Eigenen Kalender freigeben
  protected readonly shareOpen = signal(false);
  protected readonly shareContact = signal<number | null>(null);
  protected readonly shareRole = signal<ShareRole>('VIEWER');

  /** Für wen ich meinen Kalender noch freigeben kann: Kontakte ohne Freigabe und ohne offene Einladung. */
  protected readonly shareCandidates = computed(() => {
    const s = this.shares();
    const taken = new Set([...(s?.given ?? []).map((g) => g.name), ...(s?.pending ?? []).map((p) => p.name)]);
    return (this.contacts() ?? []).filter((c) => !taken.has(c.name));
  });

  /** Wen ich in diesen Kalender noch einladen kann: Kontakte, die weder Mitglied noch schon eingeladen sind. */
  protected candidates(calendar: SharedCalendar): ContactDto[] {
    const taken = new Set([...calendar.members.map((m) => m.name), ...(calendar.pending ?? []).map((p) => p.name)]);
    return (this.contacts() ?? []).filter((c) => !taken.has(c.name));
  }
  protected readonly ownedCount = computed(() => this.calendars().filter((c) => c.is_owner).length);

  protected openManager(): void {
    this.open.set(true);
    this.message.set('');
    this.error.set('');
    if (this.contacts() === null) {
      this.contactsApi.overview().subscribe({ next: (o) => this.contacts.set(o.contacts), error: () => this.contacts.set([]) });
    }
  }

  protected create(event: Event): void {
    event.preventDefault();
    const name = this.newName().trim();
    if (!name || this.busy()) return;
    this.run(this.api.createCalendar(name, this.newColor()), `„${name}“ ist angelegt. Lade jetzt Personen ein.`, () => this.newName.set(''));
  }
  protected startInvite(calendar: SharedCalendar): void {
    this.inviteFor.set(this.inviteFor() === calendar.id ? null : calendar.id);
    this.inviteContact.set(null);
    this.inviteRole.set('EDITOR');
  }
  protected invite(calendar: SharedCalendar): void {
    const contact = this.inviteContact();
    if (contact === null) return;
    const name = this.contacts()?.find((c) => c.id === contact)?.name ?? '';
    this.run(this.api.inviteToCalendar(calendar.id, contact, this.inviteRole()), `${name} ist eingeladen. Sobald die Einladung angenommen ist, seht ihr die Termine von „${calendar.name}“.`, () =>
      this.inviteFor.set(null),
    );
  }
  protected changeRole(calendar: SharedCalendar, userId: number, role: string): void {
    this.run(this.api.changeCalendarRole(calendar.id, userId, role as Exclude<CalendarRole, 'OWNER'>), 'Rolle geändert.');
  }
  protected remove(calendar: SharedCalendar, userId: number, name: string): void {
    this.run(this.api.removeCalendarMember(calendar.id, userId), `${name} sieht „${calendar.name}“ ab sofort nicht mehr.`);
  }
  protected leave(calendar: SharedCalendar): void {
    const me = calendar.members.find((m) => m.is_self);
    if (!me) return;
    this.run(this.api.removeCalendarMember(calendar.id, me.user_id), `Du bist aus „${calendar.name}“ ausgetreten.`, () => {
      if (this.filter() === calendar.id) this.filter.set('all');
    });
  }
  protected deleteCalendar(calendar: SharedCalendar): void {
    this.run(this.api.deleteCalendar(calendar.id), `„${calendar.name}“ ist gelöscht. Eure Termine sind wieder private Termine der Person, die sie eingetragen hat.`, () => {
      this.confirmDelete.set(null);
      if (this.filter() === calendar.id) this.filter.set('all');
    });
  }

  protected startShare(): void {
    this.shareOpen.set(!this.shareOpen());
    this.shareContact.set(null);
    this.shareRole.set('VIEWER');
  }
  protected share(): void {
    const contact = this.shareContact();
    const owner = this.shares()?.owner_id;
    if (contact === null || owner === undefined) return;
    const name = this.contacts()?.find((c) => c.id === contact)?.name ?? '';
    this.run(this.api.shareMyCalendar(owner, contact, this.shareRole()), `${name} ist eingeladen. Nach dem Annehmen sieht ${name} nur die Termine, die du mit ${name} teilst.`, () =>
      this.shareOpen.set(false),
    );
  }
  protected changeShareRole(userId: number, role: string): void {
    this.run(this.api.changeShareRole(userId, role as ShareRole), 'Rolle geändert.');
  }
  protected endShare(userId: number, name: string): void {
    this.run(this.api.endShare(userId), `${name} sieht deinen Kalender ab sofort nicht mehr.`);
  }
  protected leaveShare(ownerId: number, name: string): void {
    this.run(this.api.leaveShare(ownerId), `Der Kalender von ${name} wird dir nicht mehr angezeigt.`, () => {
      if (this.filter() === `p${ownerId}`) this.filter.set('all');
    });
  }
  protected demoAccept(invitationId: number, name: string): void {
    const api = this.api as unknown as { demoAccept?: (id: number) => import('rxjs').Observable<void> };
    if (!this.demo || !api.demoAccept) return;
    this.run(api.demoAccept(invitationId), `Demo: ${name} hat angenommen.`);
  }
  protected personFilter(userId: number): `p${number}` {
    return `p${userId}`;
  }

  private run(request: import('rxjs').Observable<unknown>, success: string, after?: () => void): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.message.set(success);
        after?.();
        this.changed.emit();
      },
      error: (e: { status?: number; error?: Record<string, unknown> }) => {
        this.busy.set(false);
        const body = e?.error ?? {};
        const first = Object.values(body)[0];
        const text = Array.isArray(first) ? String(first[0]) : typeof first === 'string' ? first : '';
        this.error.set(
          e?.status === 0
            ? 'Keine Verbindung zum Server. Bitte versuche es noch einmal.'
            : e?.status === 429
              ? 'Zu viele Änderungen in kurzer Zeit. Bitte warte einen Moment.'
              : text || 'Das hat nicht geklappt. Bitte versuche es noch einmal.',
        );
      },
    });
  }
}
