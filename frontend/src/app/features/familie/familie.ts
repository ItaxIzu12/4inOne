import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AppShell } from '../../layout/app-shell';
import {
  ContactDto,
  ContactsApiService,
  ContactsOverview,
  ReceivedInviteDto,
  Relation,
  SharedArea,
} from '../../core/contacts/contacts-api.service';
import { DEMO_MODE } from '../../core/demo-context';
import { HouseholdApiService, HouseholdMember, HouseholdMembers } from '../../core/household/household-api.service';
import { Invitation, InvitationsService } from '../../core/invitations/invitations.service';
import { timeAgo } from '../../shared/time-ago';
import { AppIcon, IconName } from '../../shared/icons/app-icon';

type Tab = 'overview' | 'groups' | 'shared';

const RELATION_LABEL: Record<Relation, string> = { FAMILY: 'Familie', FRIEND: 'Freund:in' };
const AREA: Record<SharedArea['kind'], { label: string; icon: IconName }> = {
  HOUSEHOLD: { label: 'Haushalt', icon: 'household' },
  TRIP: { label: 'Reise', icon: 'travel' },
};
/** So viele offene Einladungen zeigt die Übersicht, der Rest kommt über „Alle anzeigen“. */
const INVITES_PREVIEW = 2;
/** Ruhige Avatarfarben aus den Bereichsflächen — dieselbe Person bekommt immer dieselbe. */
const AVATAR_TONES = 5;

/** Eine Zeile in „Offene Einladungen“: Kontakt-Einladungen und Einladungen zu Haushalt/Reise gemeinsam. */
type InviteRow =
  | { key: string; kind: 'contact-received'; created_at: string; invite: ReceivedInviteDto }
  | { key: string; kind: 'contact-sent'; created_at: string; invite: ContactsOverview['sent'][number] }
  | { key: string; kind: 'space-received' | 'space-sent'; created_at: string; invite: Invitation };

/** Ein gemeinsamer Bereich mit allen Personen, mit denen du ihn teilst (Reiter „Geteilte Bereiche“). */
interface SharedSpace extends SharedArea {
  people: string[];
}

/** Personen & Gruppen: Menschen, mit denen du verbunden bist. Eine Verbindung teilt nichts — geteilt wird nur, was
 * du ausdrücklich teilst (eine Reise, ein gemeinsamer Haushalt). Alles hier zeigt nur Bestehendes aus dem Backend. */
@Component({
  selector: 'app-familie',
  standalone: true,
  imports: [ErrorNoticeDirective, AppShell, FormsModule, RouterLink, AppIcon],
  templateUrl: './familie.html',
  styleUrl: './familie.css',
})
export class Familie {
  private readonly api = inject(ContactsApiService);
  private readonly householdApi = inject(HouseholdApiService);
  protected readonly invitations = inject(InvitationsService);
  protected readonly demo = inject(DEMO_MODE);
  protected readonly household = signal<HouseholdMembers | null>(null);
  protected readonly confirmMember = signal<number | null>(null);

  protected readonly tab = signal<Tab>('overview');
  protected readonly tabs: { key: Tab; label: string; icon: IconName }[] = [
    { key: 'overview', label: 'Übersicht', icon: 'people' },
    { key: 'groups', label: 'Gruppen', icon: 'user' },
    { key: 'shared', label: 'Geteilte Bereiche', icon: 'link' },
  ];

  protected readonly data = signal<ContactsOverview | null>(null);
  protected readonly loadError = signal(false);
  protected readonly notice = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal<string | null>(null);
  protected readonly confirmRemove = signal<number | null>(null);
  /** Offenes Zeilenmenü: `share-<id>` (Teilen …) oder `more-<id>` (…). */
  protected readonly menu = signal<string | null>(null);
  protected readonly showAllInvites = signal(false);
  protected readonly query = signal('');

  protected readonly email = signal('');
  protected readonly relation = signal<Relation>('FRIEND');
  protected readonly label = RELATION_LABEL;
  protected readonly area = AREA;

  /** Alle offenen Einladungen, neueste zuerst — empfangene vor gesendeten. */
  protected readonly inviteRows = computed<InviteRow[]>(() => {
    const d = this.data();
    if (!d) return [];
    const received: InviteRow[] = [
      ...this.invitations.received().map((i) => ({ key: `sr-${i.id}`, kind: 'space-received' as const, created_at: i.created_at, invite: i })),
      ...d.received.map((i) => ({ key: `cr-${i.token}`, kind: 'contact-received' as const, created_at: i.created_at, invite: i })),
    ];
    const sent: InviteRow[] = [
      ...this.invitations.sent().map((i) => ({ key: `ss-${i.id}`, kind: 'space-sent' as const, created_at: i.created_at, invite: i })),
      ...d.sent.map((i) => ({ key: `cs-${i.id}`, kind: 'contact-sent' as const, created_at: i.created_at, invite: i })),
    ];
    const newest = (a: InviteRow, b: InviteRow) => b.created_at.localeCompare(a.created_at);
    return [...received.sort(newest), ...sent.sort(newest)];
  });
  protected readonly inviteCount = computed(() => this.inviteRows().length);
  /** Eigene Einladungen, die nicht angenommen wurden — still als Status, nie als Meldung (letzte 14 Tage). */
  protected readonly declinedRows = computed(() => [
    ...this.invitations.declined().map((i) => ({
      key: `sd-${i.id}`,
      title: i.scope.display_name,
      text: `An ${i.invitee?.display_name ?? ''} · ${AREA[i.scope.type].label}`,
      icon: AREA[i.scope.type].icon,
    })),
    ...(this.data()?.declined ?? []).map((i) => ({
      key: `cd-${i.id}`,
      title: i.email,
      text: `Kontaktanfrage als ${RELATION_LABEL[i.relation]}`,
      icon: 'mail' as IconName,
    })),
  ]);
  protected readonly visibleInvites = computed(() =>
    this.showAllInvites() ? this.inviteRows() : this.inviteRows().slice(0, INVITES_PREVIEW),
  );
  protected readonly hiddenInvites = computed(() => this.inviteCount() - this.visibleInvites().length);

  protected readonly contacts = computed(() => this.data()?.contacts ?? []);
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.contacts().filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(q)) : this.contacts();
  });
  protected readonly family = computed(() => this.contacts().filter((c) => c.relation === 'FAMILY'));
  protected readonly friends = computed(() => this.contacts().filter((c) => c.relation === 'FRIEND'));
  protected readonly spaces = computed<SharedSpace[]>(() => {
    const byKey = new Map<string, SharedSpace>();
    for (const contact of this.contacts()) {
      for (const area of contact.shared) {
        const key = `${area.kind}-${area.id}`;
        const space = byKey.get(key) ?? { ...area, people: [] };
        space.people.push(contact.name);
        byKey.set(key, space);
      }
    }
    return [...byKey.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title, 'de'));
  });

  constructor() {
    this.load();
    // Nach „Annehmen“ (hier oder in der Glocke) Personen und Haushalt neu laden — ohne Seiten-Reload.
    effect(() => {
      if (this.invitations.membershipVersion()) untracked(() => this.load());
    });
  }

  protected load(): void {
    this.loadError.set(false);
    this.api.overview().subscribe({
      next: (d) => this.data.set(d),
      error: () => this.loadError.set(true),
    });
    if (this.demo) return; // Demo: keine Konto-Daten abrufen
    this.invitations.refresh();
    this.householdApi.members().subscribe({ next: (h) => this.household.set(h), error: () => this.household.set(null) });
  }

  protected selectTab(tab: Tab): void {
    this.tab.set(tab);
    this.menu.set(null);
  }

  /** Reiter-Tastatur wie üblich: Pfeile wechseln, Pos1/Ende springen; der Fokus folgt der Auswahl. */
  protected onTabKey(event: KeyboardEvent): void {
    const keys = this.tabs.map((t) => t.key);
    const index = keys.indexOf(this.tab());
    const next =
      event.key === 'ArrowRight' ? (index + 1) % keys.length
      : event.key === 'ArrowLeft' ? (index + keys.length - 1) % keys.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? keys.length - 1
      : -1;
    if (next < 0) return;
    event.preventDefault();
    this.selectTab(keys[next]);
    queueMicrotask(() => document.getElementById(`people-tab-${keys[next]}`)?.focus());
  }

  protected initial(name: string): string {
    return name.slice(0, 1).toUpperCase();
  }

  protected tone(name: string): number {
    return (name.toUpperCase().charCodeAt(0) || 0) % AVATAR_TONES;
  }

  protected readonly ago = timeAgo;

  protected toggleMenu(key: string, event: Event): void {
    event.stopPropagation();
    this.confirmRemove.set(null);
    this.menu.update((open) => (open === key ? null : key));
  }

  @HostListener('document:click')
  protected closeMenus(): void {
    this.menu.set(null);
  }

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    if (this.menu()) {
      const key = this.menu();
      this.menu.set(null);
      queueMicrotask(() => document.querySelector<HTMLElement>(`[data-menu-trigger="${key}"]`)?.focus());
    }
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

  protected inviteTo(contact: ContactDto, area: SharedArea): void {
    if (this.busy()) return;
    this.busy.set(`share-${contact.id}`);
    this.menu.set(null);
    this.api.inviteToArea(contact.id, area).subscribe({
      next: () => {
        this.busy.set(null);
        this.notice.set(`Einladung gesendet. ${contact.name} ist bei „${area.title}“ dabei, sobald ${contact.name} annimmt.`);
        this.load();
      },
      error: (e: unknown) => {
        this.busy.set(null);
        this.notice.set(InvitationsService.errorText(e));
        this.load();
      },
    });
  }

  /** Eigene offene Einladung zurückziehen (aus „Offene Einladungen“ oder der Personenzeile). */
  protected revokeSpace(invitation: Invitation): void {
    this.notice.set('');
    this.invitations.revoke(invitation).subscribe(() => this.load());
  }

  protected revokeById(id: number): void {
    const invitation = this.invitations.sent().find((i) => i.id === id);
    if (invitation) this.revokeSpace(invitation);
  }

  protected answerSpace(invitation: Invitation, accept: boolean): void {
    this.notice.set('');
    (accept ? this.invitations.accept(invitation) : this.invitations.decline(invitation)).subscribe(() => this.load());
  }

  protected removeMember(member: HouseholdMember): void {
    if (this.busy()) return;
    this.busy.set(`member-${member.id}`);
    this.householdApi.removeMember(member.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.confirmMember.set(null);
        this.notice.set(member.is_self ? 'Du hast den Haushalt verlassen.' : `${member.name} ist nicht mehr Mitglied.`);
        this.invitations.membershipVersion.update((v) => v + 1);
      },
      error: () => {
        this.busy.set(null);
        this.notice.set('Das hat nicht geklappt. Bitte versuche es noch einmal.');
      },
    });
  }

  protected switchRelation(contact: ContactDto): void {
    if (this.busy()) return;
    const relation: Relation = contact.relation === 'FAMILY' ? 'FRIEND' : 'FAMILY';
    this.busy.set(`contact-${contact.id}`);
    this.menu.set(null);
    this.api.setRelation(contact.id, relation).subscribe({
      next: () => {
        this.busy.set(null);
        this.notice.set(`${contact.name} steht jetzt unter ${RELATION_LABEL[relation]}.`);
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.notice.set('Das hat nicht geklappt. Bitte versuche es noch einmal.');
      },
    });
  }

  protected askRemove(contact: ContactDto): void {
    this.menu.set(null);
    this.confirmRemove.set(contact.id);
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
