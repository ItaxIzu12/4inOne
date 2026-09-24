import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap, switchMap, shareReplay } from 'rxjs';
import { API_BASE_URL } from '../api.config';

export interface AuthUser {
  name: string;
  email: string;
}

export interface AuthResponse {
  access: string;
  user: AuthUser;
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

  // Nur für Anzeige (Begrüßung im Dashboard, Initialen im Header) — keine
  // sicherheitsrelevante Information, siehe core/auth_views.py::_user_payload.
  private readonly _currentUser = signal<AuthUser | null>(null);
  readonly currentUser = this._currentUser.asReadonly();

  private csrfRequest?: Observable<{ csrfToken: string }>;

  private cookiePost<T>(path: string, body: unknown): Observable<T> {
    this.csrfRequest ??= this.http
      .get<{ csrfToken: string }>(`${API_BASE_URL}/auth/csrf/`, { withCredentials: true })
      .pipe(shareReplay(1));
    return this.csrfRequest.pipe(
      switchMap(({ csrfToken }) =>
        this.http.post<T>(`${API_BASE_URL}/auth/${path}/`, body, {
          withCredentials: true,
          headers: { 'X-CSRFToken': csrfToken },
        }),
      ),
    );
  }

  login(
    email: string,
    password: string,
    remember = true,
    mfaCode = '',
  ): Observable<AuthResponse | { mfa_required: true }> {
    return this.cookiePost<AuthResponse | { mfa_required: true }>('login', {
      email,
      password,
      remember,
      mfa_code: mfaCode,
    }).pipe(
      tap((res) => {
        if ('access' in res) this.applySession(res);
      }),
    );
  }

  register(
    name: string,
    email: string,
    password: string,
    confirmPassword: string,
    acceptPrivacy: boolean,
  ): Observable<AuthResponse> {
    return this.cookiePost<AuthResponse>('register', {
      name,
      email,
      password,
      confirm_password: confirmPassword,
      accept_privacy: acceptPrivacy,
    }).pipe(tap((res) => this.applySession(res)));
  }

  /** Versucht, die Sitzung über das httpOnly-Refresh-Cookie wiederherzustellen
   * (z. B. nach einem Seiten-Reload, bei dem das In-Memory-Token weg ist).
   * Setzt auch currentUser neu — ohne das bliebe der Header nach einem
   * reinen Refresh zwar "eingeloggt", aber mit leerem Profil-Icon (kein
   * Name/keine Initialen), weil applySession() sonst nur bei login()/
   * register() läuft. */
  refresh(): Observable<AuthResponse> {
    return this.cookiePost<AuthResponse>('refresh', {}).pipe(tap((res) => this.applySession(res)));
  }

  logout(): Observable<void> {
    return this.cookiePost<void>('logout', {}).pipe(tap(() => this.forceLogout()));
  }

  /** Räumt nur den lokalen Zustand auf, ohne das Backend zu benachrichtigen —
   * für den Fall, dass die Sitzung dort bereits ungültig ist (z. B. vom
   * authInterceptor nach einem gescheiterten Refresh-Versuch aufgerufen,
   * siehe auth.interceptor.ts). Ein zusätzlicher Logout-Aufruf wäre hier
   * sinnlos: das Refresh-Token, das serverseitig geblacklistet werden
   * müsste, ist ohnehin bereits abgelaufen/ungültig. */
  forceLogout(): void {
    this._accessToken.set(null);
    this._currentUser.set(null);
  }

  requestPasswordReset(email: string): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(`${API_BASE_URL}/auth/password-reset/request/`, {
      email,
    });
  }

  confirmPasswordReset(token: string, password: string): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(`${API_BASE_URL}/auth/password-reset/confirm/`, {
      token,
      password,
    });
  }

  private applySession(res: AuthResponse): void {
    this._accessToken.set(res.access);
    this._currentUser.set(res.user);
  }
}
