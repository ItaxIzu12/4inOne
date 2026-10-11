import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, of, tap } from 'rxjs';
import { API_BASE_URL } from '../api.config';

export type InvitationScope = 'HOUSEHOLD' | 'TRIP';

/** Eine In-App-Einladung so, wie das Backend sie zeigt (core/invitations.py › present) — ohne E-Mail-Adressen. */
export interface Invitation {
  id: number;
  scope: { type: InvitationScope; id: number; display_name: string; detail: string };
  role: string;
  role_label: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED';
  created_at: string;
  expires_at: string;
  inviter?: { display_name: string };
  invitee?: { display_name: string };
}

export interface ContactInviteInfo {
  token: string;
  from_name: string;
  relation: 'FAMILY' | 'FRIEND';
  relation_label: string;
}

/** Rückmeldung an die einladende Person: jemand hat angenommen (Ablehnungen werden bewusst nicht gemeldet). */
export interface AcceptedInfo {
  name: string;
  relation_label?: string;
  scope?: { type: InvitationScope; id: number; display_name: string };
}

/** Eine Benachrichtigung: Einladung zu Haushalt/Reise, Kontaktanfrage (nur bei bestätigter E-Mail-Adresse)
 * oder die Meldung, dass jemand deine Einladung angenommen hat. */
export type InvitationNotification =
  | { id: number; kind: 'INVITATION_CREATED'; read: boolean; created_at: string; invitation: Invitation }
  | { id: number; kind: 'CONTACT_INVITE'; read: boolean; created_at: string; contact_invite: ContactInviteInfo }
  | { id: number; kind: 'CONTACT_ACCEPTED' | 'INVITATION_ACCEPTED'; read: boolean; created_at: string; accepted: AcceptedInfo };

/** Text und nächster Schritt einer Annahme-Meldung (Glocke und Startseite): Erfolg ruhig zeigen, direkt zum Teilen führen. */
export function acceptedMessage(note: AcceptedNotification): { text: string; link: string; query: Record<string, number> | null; action: string } {
  const { name, scope } = note.accepted;
  if (!scope) return { text: `${name} hat deine Einladung angenommen. Ihr seid jetzt verbunden.`, link: '/familie', query: null, action: 'Etwas teilen' };
  if (scope.type === 'HOUSEHOLD') return { text: `${name} ist jetzt Mitglied von „${scope.display_name}“.`, link: '/haushalt', query: null, action: 'Zum Haushalt' };
  return { text: `${name} ist jetzt bei „${scope.display_name}“ dabei.`, link: '/reisen', query: { trip: scope.id }, action: 'Zur Reise' };
}

export type PendingNotification = Extract<InvitationNotification, { kind: 'INVITATION_CREATED' | 'CONTACT_INVITE' }>;
export type AcceptedNotification = Extract<InvitationNotification, { kind: 'CONTACT_ACCEPTED' | 'INVITATION_ACCEPTED' }>;

/**
 * Eine Quelle für offene Einladungen: Glocke, Startseite und Personen & Gruppen lesen dieselben Signale — dieselbe
 * Einladung erscheint überall als dieselbe Sache und verschwindet überall gleichzeitig. Geladen wird beim Start
 * der App-Shell, beim Öffnen der Glocke und nach jeder Aktion; kein Dauer-Polling, keine WebSockets (V1).
 */
@Injectable({ providedIn: 'root' })
export class InvitationsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/invitations`;

  readonly received = signal<Invitation[]>([]);
  readonly sent = signal<Invitation[]>([]);
  /** Eigene Einladungen, die nicht angenommen wurden — nur still in Personen & Gruppen, nie als Meldung. */
  readonly declined = signal<Invitation[]>([]);
  readonly notifications = signal<InvitationNotification[]>([]);
  readonly loaded = signal(false);
  readonly busy = signal<number | null>(null);
  /** Kurze Rückmeldung nach Annehmen/Ablehnen, z. B. „Du bist jetzt Mitglied von „Unser Zuhause“.“ */
  readonly message = signal('');

  readonly unread = computed(() => this.notifications().filter((n) => !n.read).length);
  /** Offene Einladungen an dich (mit Annehmen/Ablehnen). */
  readonly pending = computed(() =>
    this.notifications().filter((n): n is PendingNotification => n.kind === 'INVITATION_CREATED' || n.kind === 'CONTACT_INVITE'),
  );
  /** Meldungen „… hat angenommen“ für dich als einladende Person. */
  readonly accepted = computed(() =>
    this.notifications().filter((n): n is AcceptedNotification => n.kind === 'CONTACT_ACCEPTED' || n.kind === 'INVITATION_ACCEPTED'),
  );

  /** Erhöht sich nach jeder angenommenen Einladung — Bereiche laden ihre Daten dann neu, ohne Seiten-Reload. */
  readonly membershipVersion = signal(0);

  refresh(): void {
    this.http.get<{ unread: number; items: InvitationNotification[] }>(`${API_BASE_URL}/notifications/`).subscribe({
      next: (res) => {
        this.notifications.set(Array.isArray(res?.items) ? res.items : []);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
    this.http.get<{ received: Invitation[]; sent: Invitation[]; declined?: Invitation[] }>(`${this.base}/`).subscribe({
      next: (res) => {
        this.received.set(Array.isArray(res?.received) ? res.received : []);
        this.sent.set(Array.isArray(res?.sent) ? res.sent : []);
        this.declined.set(Array.isArray(res?.declined) ? res.declined : []);
      },
      error: () => undefined,
    });
  }

  /** Beim Öffnen der Glocke: als gelesen markieren. Ändert nichts an der Einladung (gelesen ≠ angenommen). */
  markRead(): void {
    if (!this.unread()) return;
    this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
    this.http.post(`${API_BASE_URL}/notifications/read/`, {}).subscribe({ error: () => undefined });
  }

  accept(invitation: Invitation): Observable<unknown> {
    const name = invitation.scope.display_name;
    return this.answer(invitation, 'accept', () => {
      this.message.set(
        invitation.scope.type === 'HOUSEHOLD' ? `Du bist jetzt Mitglied von „${name}“.` : `Du bist jetzt bei „${name}“ dabei.`,
      );
      this.membershipVersion.update((v) => v + 1);
    });
  }

  decline(invitation: Invitation): Observable<unknown> {
    return this.answer(invitation, 'decline', () => this.message.set('Einladung abgelehnt.'));
  }

  revoke(invitation: Invitation): Observable<unknown> {
    return this.answer(invitation, 'revoke', () => this.message.set('Einladung zurückgezogen.'));
  }

  /** Kontaktanfrage direkt in der App beantworten (gleicher Endpunkt wie der Link aus der Mail). */
  answerContact(invite: ContactInviteInfo, accept: boolean): Observable<unknown> {
    this.message.set('');
    this.notifications.update((list) => list.filter((n) => n.kind !== 'CONTACT_INVITE' || n.contact_invite.token !== invite.token));
    const url = `${API_BASE_URL}/contacts/invites/${encodeURIComponent(invite.token)}/${accept ? 'accept' : 'decline'}/`;
    return this.http.post(url, {}).pipe(
      tap(() => {
        this.message.set(accept ? `Du bist jetzt mit ${invite.from_name} verbunden.` : 'Einladung abgelehnt.');
        if (accept) this.membershipVersion.update((v) => v + 1);
      }),
      catchError((error: unknown) => {
        this.message.set(InvitationsService.errorText(error));
        return of(null);
      }),
      finalize(() => this.refresh()),
    );
  }

  invite(contactId: number, scopeType: InvitationScope, scopeId: number, role?: string): Observable<Invitation> {
    return this.http
      .post<Invitation>(`${this.base}/`, { contact_id: contactId, scope_type: scopeType, scope_id: scopeId, ...(role ? { role } : {}) })
      .pipe(tap(() => this.refresh()));
  }

  /** Verständlicher Text für Fehler beim Einladen oder Beantworten. */
  static errorText(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 429) return 'Du hast in kurzer Zeit viele Einladungen gesendet. Bitte versuche es später noch einmal.';
      const body = error.error as Record<string, string[] | string> | null;
      const first = body && (body['detail'] ?? body['contact_id'] ?? body['role'] ?? body['scope_type']);
      if ((error.status === 400 || error.status === 404) && first) return Array.isArray(first) ? first[0] : first;
    }
    return 'Das hat nicht geklappt. Bitte versuche es noch einmal.';
  }

  private answer(invitation: Invitation, action: 'accept' | 'decline' | 'revoke', done: () => void): Observable<unknown> {
    this.busy.set(invitation.id);
    this.message.set('');
    // Sofort aus „offen“ nehmen — die Antwort des Servers bestätigt oder holt den Stand neu.
    const drop = (list: Invitation[]) => list.filter((i) => i.id !== invitation.id);
    this.received.update(drop);
    this.sent.update(drop);
    this.notifications.update((list) => list.filter((n) => n.kind !== 'INVITATION_CREATED' || n.invitation.id !== invitation.id));
    return this.http.post(`${this.base}/${invitation.id}/${action}/`, {}).pipe(
      tap(() => done()),
      catchError((error: unknown) => {
        this.message.set(InvitationsService.errorText(error));
        return of(null);
      }),
      finalize(() => {
        this.busy.set(null);
        this.refresh();
      }),
    );
  }
}
