import { Injectable, inject } from '@angular/core';
import { ReisenApi } from '../../features/reisen/reisen-api.service';
import { OrganisationApi } from '../../features/organisation/organisation-api.service';
import { Observable, of, throwError } from 'rxjs';
import { ContactDto, ContactsApiService, ContactsOverview, ReceivedInviteDto, Relation, SentInviteDto, SharedArea } from './contacts-api.service';

// Dieselben Namen wie demo-reisen-api.ts (Max/Lena) — eine Demo-Instanz erzählt eine durchgängige Geschichte,
// keine je Bereich unterschiedlich erfundenen Personen.
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}
// Derselbe Haushalt wie core/household/demo-household-api.service.ts (Sophie und Max)
const ZUHAUSE: SharedArea = { kind: 'HOUSEHOLD', id: 1, title: 'Unser Zuhause' };
function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Wie demo-reisen-api.ts: keine HTTP-Aufrufe, ersetzt ContactsApiService nur für die öffentliche Demo-Route
 * (siehe app.routes.ts), gesamter Zustand lebt nur im Speicher dieser einen Instanz — ein Reload setzt zurück.
 * Zeigt absichtlich alle drei Zustände gleichzeitig (bestehende Verbindung, offene eigene Einladung, eingehende
 * Einladung), damit die Demo das Feature in einem Blick erklärt statt nur eine leere Liste zu zeigen. */
@Injectable()
export class DemoContactsApiService {
  private nextId = 100;
  private contacts: ContactDto[] = [
    // Reisen und Kalender stehen hier NICHT fest drin — sie kommen live aus demo-reisen-api.ts und
    // demo-organisation-api.ts (siehe withLinks), damit Entfernen oder Einladen dort sofort auch hier stimmt.
    { id: 1, name: 'Max', email: 'max@beispiel.de', relation: 'FAMILY', since: daysAgo(120), shared: [ZUHAUSE], can_add_to: [], invited_to: [] },
    { id: 2, name: 'Lena', email: 'lena@beispiel.de', relation: 'FRIEND', since: daysAgo(30), shared: [], can_add_to: [ZUHAUSE], invited_to: [] },
  ];
  private sent: SentInviteDto[] = [
    { id: 1, email: 'theo@beispiel.de', relation: 'FRIEND', expires_at: daysFromNow(6), created_at: daysAgo(1) },
  ];
  private received: ReceivedInviteDto[] = [
    { token: 'demo-invite-jonas', from_name: 'Jonas', relation: 'FRIEND', expires_at: daysFromNow(6), created_at: hoursAgo(2) },
  ];

  // Konto-ID je Kontakt (wie Organisation und Reisen: Max 301, Lena 302); neue Kontakte bekommen eine eigene.
  private userIds = new Map<number, number>([[1, 301], [2, 302]]);
  private readonly reisen = inject(ReisenApi, { optional: true }) as unknown as DemoTrips | null;
  private readonly organisation = inject(OrganisationApi, { optional: true }) as unknown as DemoCalendars | null;

  overview(): Observable<ContactsOverview> {
    return of({ contacts: this.contacts.map((c) => this.withLinks(c)), sent: [...this.sent], received: [...this.received] });
  }
  /** Reisen und Kalender live aus den anderen Demo-Bereichen; Reihenfolge wie im Backend: Haushalt, Reisen, Kalender.
   * Reise dabei → geteilt, offene Einladung → eingeladen, kommende Reise → einladbar (Kalender analog). */
  private withLinks(contact: ContactDto): ContactDto {
    const user = this.userIds.get(contact.id) ?? -1;
    const trips = this.reisen?.demoTripsFor?.(user) ?? [];
    const cal = this.organisation?.demoLinksFor?.(user, contact.name) ?? { shared: [], canAdd: [], invited: [] };
    const trip = (t: { id: number; title: string }): SharedArea => ({ kind: 'TRIP', id: t.id, title: t.title });
    const own = (list: SharedArea[]) => list.filter((a) => a.kind === 'HOUSEHOLD');
    return {
      ...contact,
      shared: [...own(contact.shared), ...trips.filter((t) => t.joined).map(trip), ...cal.shared],
      can_add_to: [...own(contact.can_add_to), ...trips.filter((t) => t.canInvite).map(trip), ...cal.canAdd],
      invited_to: [
        ...contact.invited_to.filter((a) => a.kind === 'HOUSEHOLD'),
        ...trips.filter((t) => t.invitationId !== null).map((t) => ({ ...trip(t), invitation_id: t.invitationId! })),
        ...cal.invited,
      ],
    };
  }
  invite(email: string, relation: Relation): Observable<{ id: number; email: string; email_sent: boolean }> {
    const created = { id: this.nextId++, email, relation, expires_at: daysFromNow(7), created_at: new Date().toISOString() };
    this.sent.push(created);
    return of({ id: created.id, email, email_sent: true });
  }
  cancelInvite(id: number): Observable<void> {
    this.sent = this.sent.filter((s) => s.id !== id);
    return of(undefined);
  }
  invitePreview(token: string): Observable<{ from_name: string; relation: Relation; expires_at: string }> {
    const invite = this.received.find((r) => r.token === token);
    if (!invite) return throwError(() => ({ status: 404 }));
    return of({ from_name: invite.from_name, relation: invite.relation, expires_at: invite.expires_at });
  }
  accept(token: string): Observable<ContactDto> {
    const invite = this.received.find((r) => r.token === token);
    if (!invite) return throwError(() => ({ status: 404 }));
    this.received = this.received.filter((r) => r.token !== token);
    const created: ContactDto = {
      id: this.nextId++,
      name: invite.from_name,
      email: `${invite.from_name.toLowerCase()}@beispiel.de`,
      relation: invite.relation,
      since: new Date().toISOString(),
      shared: [],
      can_add_to: [ZUHAUSE],
      invited_to: [],
    };
    this.userIds.set(created.id, 900 + created.id);
    this.contacts.push(created);
    return of(created);
  }
  decline(token: string): Observable<void> {
    this.received = this.received.filter((r) => r.token !== token);
    return of(undefined);
  }
  remove(id: number): Observable<void> {
    this.contacts = this.contacts.filter((c) => c.id !== id);
    return of(undefined);
  }
  setRelation(id: number, relation: Relation): Observable<ContactDto> {
    this.contacts = this.contacts.map((c) => (c.id === id ? { ...c, relation } : c));
    return of(this.contacts.find((c) => c.id === id)!);
  }
  /** Wie das Backend: eine offene Einladung, noch keine Teilnahme. */
  inviteToArea(contactId: number, area: SharedArea): Observable<unknown> {
    if (area.kind === 'TRIP') {
      // Reisen führt die Einladung selbst — dann stimmt sie auch unter Reisen › Personen
      this.reisen?.demoInvite?.(area.id, this.userIds.get(contactId) ?? -1);
      return of(undefined);
    }
    if (area.kind === 'CALENDAR' || area.kind === 'MY_CALENDAR') {
      // ebenso Kalender: die Einladung steht dann auch in Organisation › Kalender teilen
      this.organisation?.demoInviteArea?.(area.kind, area.id, contactId);
      return of(undefined);
    }
    this.contacts = this.contacts.map((c) =>
      c.id === contactId
        ? { ...c, can_add_to: c.can_add_to.filter((a) => a.id !== area.id || a.kind !== area.kind), invited_to: [...c.invited_to, { ...area, invitation_id: this.nextId++ }] }
        : c,
    );
    return of(undefined);
  }
  /** Nur Demo: offene Einladung als angenommen behandeln — der Bereich wird geteilt (niemand nimmt hier sonst an). */
  demoAccept(contactId: number, invitationId: number): Observable<void> {
    if (this.reisen?.demoAccept?.(invitationId)) return of(undefined);
    if (this.organisation?.demoAcceptNow?.(invitationId)) return of(undefined);
    const contact = this.contacts.find((c) => c.id === contactId);
    const invite = contact?.invited_to.find((i) => i.invitation_id === invitationId);
    if (!contact || !invite) return throwError(() => ({ status: 404 }));
    const { invitation_id: _, ...area } = invite;
    this.contacts = this.contacts.map((c) =>
      c.id === contactId ? { ...c, invited_to: c.invited_to.filter((i) => i !== invite), shared: [...c.shared, area] } : c,
    );
    return of(undefined);
  }
}

/** Was die Reisen-Demo für den Abgleich anbietet (demo-reisen-api.ts) — nur in der Demo vorhanden. */
interface DemoTrips {
  demoTripsFor?(user: number): { id: number; title: string; joined: boolean; invitationId: number | null; canInvite: boolean }[];
  demoInvite?(tripId: number, user: number): void;
  demoAccept?(invitationId: number): boolean;
}

/** Was die Organisation-Demo für den Abgleich anbietet (demo-organisation-api.ts) — nur in der Demo vorhanden. */
interface DemoCalendars {
  demoLinksFor?(user: number, name: string): { shared: SharedArea[]; canAdd: SharedArea[]; invited: (SharedArea & { invitation_id: number })[] };
  demoInviteArea?(kind: 'CALENDAR' | 'MY_CALENDAR', areaId: number, contactId: number): void;
  demoAcceptNow?(invitationId: number): boolean;
}
