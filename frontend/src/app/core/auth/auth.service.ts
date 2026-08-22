import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

// Kein Environments-Setup im Projekt bisher — für den Produktivbau muss
// diese Adresse noch konfigurierbar gemacht werden (z. B. via
// fileReplacements), siehe Zusammenfassung im Chat.
const API_BASE_URL = 'http://localhost:8000/api';

interface AccessTokenResponse {
  access: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  // ARCHITEKTUR.md §3.1: Access-Token AUSSCHLIESSLICH im Speicher (Signal),
  // NIE in localStorage/sessionStorage — sonst könnte eine XSS-Lücke ihn
  // direkt auslesen. Das Refresh-Token sieht dieser Service nie: es steckt
  // in einem httpOnly-Cookie, das der Browser automatisch mitschickt und
  // das JavaScript nicht auslesen kann (siehe login/register/refresh unten).
  private readonly _accessToken = signal<string | null>(null);
  readonly accessToken = this._accessToken.asReadonly();
  readonly isAuthenticated = computed(() => this._accessToken() !== null);

  login(email: string, password: string): Observable<AccessTokenResponse> {
    return this.http
      .post<AccessTokenResponse>(
        `${API_BASE_URL}/auth/login/`,
        { email, password },
        { withCredentials: true },
      )
      .pipe(tap((res) => this._accessToken.set(res.access)));
  }

  register(name: string, email: string, password: string): Observable<AccessTokenResponse> {
    return this.http
      .post<AccessTokenResponse>(
        `${API_BASE_URL}/auth/register/`,
        { name, email, password },
        { withCredentials: true },
      )
      .pipe(tap((res) => this._accessToken.set(res.access)));
  }

  /** Versucht, die Sitzung über das httpOnly-Refresh-Cookie wiederherzustellen
   * (z. B. nach einem Seiten-Reload, bei dem das In-Memory-Token weg ist). */
  refresh(): Observable<AccessTokenResponse> {
    return this.http
      .post<AccessTokenResponse>(`${API_BASE_URL}/auth/refresh/`, {}, { withCredentials: true })
      .pipe(tap((res) => this._accessToken.set(res.access)));
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${API_BASE_URL}/auth/logout/`, {}, { withCredentials: true })
      .pipe(tap(() => this._accessToken.set(null)));
  }

  requestPasswordReset(email: string): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(`${API_BASE_URL}/auth/password-reset/`, { email });
  }
}
