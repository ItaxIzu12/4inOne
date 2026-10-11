import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';

export interface HouseholdMember {
  id: number;
  name: string;
  role: 'ADMIN' | 'MEMBER' | 'CHILD_ACCOUNT';
  role_label: string;
  is_self: boolean;
  can_remove: boolean;
}

export interface HouseholdMembers {
  household: { id: number; name: string } | null;
  members: HouseholdMember[];
  can_invite: boolean;
  can_leave: boolean;
}

/** Mitglieder des aktiven Haushalts (core/household_views.py). Eingeladen wird über /invitations/. */
@Injectable({ providedIn: 'root' })
export class HouseholdApiService {
  private readonly http = inject(HttpClient);

  members(): Observable<HouseholdMembers> {
    return this.http.get<HouseholdMembers>(`${API_BASE_URL}/household/members/`);
  }

  /** Mitglied entfernen (Verwalter:in) oder sich selbst austragen (Haushalt verlassen). */
  removeMember(id: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/household/members/${id}/`);
  }
}
