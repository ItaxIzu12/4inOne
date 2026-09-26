import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';

export type Relation = 'FAMILY' | 'FRIEND';

export interface ContactDto {
  id: number;
  name: string;
  email: string;
  relation: Relation;
  since: string;
}
export interface SentInviteDto {
  id: number;
  email: string;
  relation: Relation;
  expires_at: string;
}
export interface ReceivedInviteDto {
  token: string;
  from_name: string;
  relation: Relation;
  expires_at: string;
}
export interface ContactsOverview {
  contacts: ContactDto[];
  sent: SentInviteDto[];
  received: ReceivedInviteDto[];
}

/** Familie & Freunde (Backend: core/contact_views.py). Eine Verbindung teilt nichts. */
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
}
