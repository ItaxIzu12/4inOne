import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api.config';

export type AuthEventKind =
  | 'registered'
  | 'login_succeeded'
  | 'login_failed'
  | 'locked_out'
  | 'mfa_failed'
  | 'password_reset_requested'
  | 'password_reset_completed';

export interface AdminOverview {
  accounts: { total: number; new_7d: number; active_7d: number };
  events_24h: Record<AuthEventKind, number>;
  events_7d: Record<AuthEventKind, number>;
  labels: Record<AuthEventKind, string>;
  monitoring: { connected: boolean; environment: string; url: string | null; errors_available: boolean };
  retention_days: number;
}

export interface AdminEvent {
  id: number;
  kind: AuthEventKind;
  label: string;
  created_at: string;
  /** Nur Anzeigename und maskierte Adresse („s•••@example.com“); null = unbekanntes Konto */
  user: { name: string; email: string } | null;
  ip_prefix: string;
}

export interface AdminIssue {
  id: string;
  title: string;
  culprit: string;
  level: string;
  count: number;
  last_seen: string | null;
  link: string;
}

/** Admin-Panel (backend/monitoring/views.py) — jeder Aufruf prüft serverseitig Staff + Zwei-Faktor. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/admin`;

  overview(): Observable<AdminOverview> {
    return this.http.get<AdminOverview>(`${this.base}/overview/`);
  }
  events(kind: AuthEventKind | '', page = 1): Observable<{ results: AdminEvent[]; page: number; has_more: boolean }> {
    let params = new HttpParams().set('page', page);
    if (kind) params = params.set('kind', kind);
    return this.http.get<{ results: AdminEvent[]; page: number; has_more: boolean }>(`${this.base}/events/`, { params });
  }
  errors(): Observable<{ available: boolean; reason?: string; issues: AdminIssue[] }> {
    return this.http.get<{ available: boolean; reason?: string; issues: AdminIssue[] }>(`${this.base}/errors/`);
  }
}
