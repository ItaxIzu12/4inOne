import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';

export type Relation = 'FAMILY' | 'FRIEND';

/** Etwas, das du mit einer Person heute wirklich teilst (oder zu dem du sie hinzufügen darfst). */
export interface SharedArea {
  kind: 'TRIP' | 'HOUSEHOLD';
  id: number;
  title: string;
}
export interface ContactDto {
  id: number;
  name: string;
  email: string;
  relation: Relation;
  since: string;
  shared: SharedArea[];
  /** Wozu du die Person einladen darfst: dein Haushalt (als Verwalter:in) und kommende eigene Reisen. */
  can_add_to: SharedArea[];
  /** Offene Einladungen von dir an diese Person. */
  invited_to: (SharedArea & { invitation_id: number })[];
}
export interface SentInviteDto {
  id: number;
  email: string;
  relation: Relation;
  expires_at: string;
  created_at: string;
}
export interface ReceivedInviteDto {
  token: string;
  from_name: string;
  relation: Relation;
  expires_at: string;
  created_at: string;
}
export interface DeclinedInviteDto {
  id: number;
  email: string;
  relation: Relation;
  declined_at: string;
}
export interface ContactsOverview {
  contacts: ContactDto[];
  sent: SentInviteDto[];
  received: ReceivedInviteDto[];
  /** Nicht angenommen (die letzten 14 Tage) — wird nie als Meldung verschickt. */
  declined?: DeclinedInviteDto[];
}

/** Personen & Gruppen (Backend: core/contact_views.py). Eine Verbindung teilt nichts. */
@Injectable({ providedIn: 'root' })
export class ContactsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/contacts`;

  overview(): Observable<ContactsOverview> {
    return this.http.get<ContactsOverview>(`${this.base}/`);
  }
  invite(email: string, relation: Relation): Observable<{ id: number; email: string; email_sent: boolean }> {
    return this.http.post<{ id: number; email: string; email_sent: boolean }>(`${this.base}/invites/`, { email, relation });
  }
  cancelInvite(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/invites/${id}/`);
  }
  invitePreview(token: string): Observable<{ from_name: string; relation: Relation; expires_at: string }> {
    return this.http.get<{ from_name: string; relation: Relation; expires_at: string }>(`${this.base}/invites/${token}/`);
  }
  accept(token: string): Observable<ContactDto> {
    return this.http.post<ContactDto>(`${this.base}/invites/${token}/accept/`, {});
  }
  decline(token: string): Observable<void> {
    return this.http.post<void>(`${this.base}/invites/${token}/decline/`, {});
  }
  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/`);
  }
  setRelation(id: number, relation: Relation): Observable<ContactDto> {
    return this.http.patch<ContactDto>(`${this.base}/${id}/`, { relation });
  }
  /** Lädt einen Kontakt in einen Haushalt oder eine Reise ein (In-App-Einladung, Rolle: die kleinste erlaubte). */
  inviteToArea(contactId: number, area: SharedArea): Observable<unknown> {
    return this.http.post(`${API_BASE_URL}/invitations/`, { contact_id: contactId, scope_type: area.kind, scope_id: area.id });
  }
}
