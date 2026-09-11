import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';

export interface HouseholdInviteResponse {
  detail: string;
  email: string;
  expires_at: string;
}

@Injectable({ providedIn: 'root' })
export class HouseholdApiService {
  private readonly http = inject(HttpClient);

  sendInvite(email: string, role: string): Observable<HouseholdInviteResponse> {
    return this.http.post<HouseholdInviteResponse>(`${API_BASE_URL}/household/invite/`, { email, role });
  }
}
