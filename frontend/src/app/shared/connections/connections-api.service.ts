import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api.config';

/** Fachliche Objektarten — die Werte entsprechen backend/connections/models.py ObjectType. */
export type ConnectionObjectType =
  | 'TASK'
  | 'CALENDAR_EVENT'
  | 'SAVINGS_GOAL'
  | 'HOUSEHOLD_TASK'
  | 'TRIP'
  | 'BUDGET';

export type ConnectionDomain = 'finanzen' | 'haushalt' | 'organisation' | 'reisen';

/** Eine Seite einer Verknüpfung — enthält nur, was der Nutzer sehen darf. */
export interface ConnectedObject {
  type: ConnectionObjectType;
  id: number;
  title: string;
  subtitle: string;
  domain: ConnectionDomain;
}

export interface ConnectionDto {
  id: number;
  relation_type: string;
  relation_label: string;
  origin: 'MANUAL' | 'SUGGESTED' | 'AUTOMATED';
  created_at: string;
  source: ConnectedObject;
  target: ConnectedObject;
  /** Nur in der Liste: die Seite, die NICHT das abgefragte Objekt ist. */
  other?: ConnectedObject;
}

export interface ConnectionOption {
  type: ConnectionObjectType;
  label: string;
  domain: ConnectionDomain;
  relation_type: string;
}

@Injectable({ providedIn: 'root' })
export class ConnectionsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/connections`;

  list(type: ConnectionObjectType, id: number): Observable<ConnectionDto[]> {
    return this.http.get<ConnectionDto[]>(`${this.base}/`, { params: { object_type: type, object_id: id } });
  }

  options(type: ConnectionObjectType): Observable<ConnectionOption[]> {
    return this.http.get<ConnectionOption[]>(`${this.base}/options/`, { params: { object_type: type } });
  }

  candidates(
    type: ConnectionObjectType,
    id: number,
    targetType: ConnectionObjectType,
    query = '',
  ): Observable<ConnectedObject[]> {
    return this.http.get<ConnectedObject[]>(`${this.base}/candidates/`, {
      params: { object_type: type, object_id: id, target_type: targetType, ...(query ? { q: query } : {}) },
    });
  }

  /** Die Richtung legt das Backend pro Typpaar fest; hier zählt nur „diese zwei gehören zusammen“. */
  create(
    type: ConnectionObjectType,
    id: number,
    otherType: ConnectionObjectType,
    otherId: number,
  ): Observable<ConnectionDto> {
    return this.http.post<ConnectionDto>(`${this.base}/`, {
      source_type: type,
      source_id: id,
      target_type: otherType,
      target_id: otherId,
    });
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/`);
  }
}
