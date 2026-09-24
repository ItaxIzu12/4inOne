import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';

export interface OnboardingProfileDto {
  needs_onboarding: boolean;
  completed: boolean;
  usage: 'personal' | 'shared' | null;
  domains: string[];
}

export interface OnboardingStatusDto {
  has_transaction: boolean;
  has_category: boolean;
  member_count: number;
  mfa_enabled: boolean;
}

/** Nur unter /app relevant (IsAuthenticated-Endpunkt, siehe
 * finanzen/views.py OnboardingStatusView) — auf der Demo-Route (/) wird
 * dieser Service nie aufgerufen, siehe shared/onboarding. */
@Injectable({ providedIn: 'root' })
export class OnboardingApiService {
  private readonly http = inject(HttpClient);

  getProfile(): Observable<OnboardingProfileDto> {
    return this.http.get<OnboardingProfileDto>(`${API_BASE_URL}/onboarding/profile/`);
  }
  complete(usage: 'personal' | 'shared', domains: string[]): Observable<OnboardingProfileDto> {
    return this.http.put<OnboardingProfileDto>(`${API_BASE_URL}/onboarding/profile/`, {
      usage,
      domains,
    });
  }

  getStatus(): Observable<OnboardingStatusDto> {
    return this.http.get<OnboardingStatusDto>(`${API_BASE_URL}/onboarding/status/`);
  }
}
