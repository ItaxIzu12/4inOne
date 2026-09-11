import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';

export interface MfaSetupResponse {
  secret: string;
  otpauth_url: string;
  qr_code: string;
}

export interface MfaVerifyResponse {
  detail: string;
  backup_codes: string[];
}

@Injectable({ providedIn: 'root' })
export class MfaApiService {
  private readonly http = inject(HttpClient);

  setup(): Observable<MfaSetupResponse> {
    return this.http.post<MfaSetupResponse>(`${API_BASE_URL}/auth/mfa/setup/`, {});
  }

  verify(code: string): Observable<MfaVerifyResponse> {
    return this.http.post<MfaVerifyResponse>(`${API_BASE_URL}/auth/mfa/verify/`, { code });
  }
}
