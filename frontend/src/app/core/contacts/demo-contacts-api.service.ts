import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { ContactDto, ContactsApiService, ContactsOverview, ReceivedInviteDto, Relation, SentInviteDto } from './contacts-api.service';

// Dieselben Namen wie demo-reisen-api.ts (Max/Lena) — eine Demo-Instanz erzählt eine durchgängige Geschichte,
// keine je Bereich unterschiedlich erfundenen Personen.
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
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
    { id: 1, name: 'Max', email: 'max@beispiel.de', relation: 'FAMILY', since: daysAgo(120) },
    { id: 2, name: 'Lena', email: 'lena@beispiel.de', relation: 'FRIEND', since: daysAgo(30) },
  ];
  private sent: SentInviteDto[] = [
    { id: 1, email: 'theo@beispiel.de', relation: 'FRIEND', expires_at: daysFromNow(6) },
  ];
  private received: ReceivedInviteDto[] = [
    { token: 'demo-invite-jonas', from_name: 'Jonas', relation: 'FRIEND', expires_at: daysFromNow(6) },
  ];

  overview(): Observable<ContactsOverview> {
    return of({ contacts: [...this.contacts], sent: [...this.sent], received: [...this.received] });
  }
  invite(email: string, relation: Relation): Observable<{ id: number; email: string; email_sent: boolean }> {
    const created = { id: this.nextId++, email, relation, expires_at: daysFromNow(7) };
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
    };
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
}
