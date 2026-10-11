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
  | 'DEVICE'
  | 'CONTRACT'
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
  /** Server-Entscheidung: angelegt von mir oder beide Seiten bearbeitbar. Lesende sehen die Verbindung nur. */
  can_delete: boolean;
  relation_type: string;
  relation_label: string;
  origin: 'MANUAL' | 'SUGGESTED' | 'AUTOMATED';
  created_at: string;
  source: ConnectedObject;
  target: ConnectedObject;
  /** Nur in der Liste: die Seite, die NICHT das abgefragte Objekt ist. */
  other?: ConnectedObject;
}

/** Ein Verknüpfungs-Vorschlag: nur Dinge, die der Nutzer ohnehin sehen und bearbeiten darf. */
export interface LinkSuggestionDto {
  /** Kennung für Annehmen/Ablehnen — der Server prüft beim Annehmen alles neu. */
  key: string;
  reason_code: string;
  /** Satz mit beiden Namen (für Übersichten ohne Bezugsobjekt). */
  headline: string;
  /** Warum: verständliche Begründung, nie eine Prozentzahl. */
  reason: string;
  relation_label: string;
  source: ConnectedObject;
  target: ConnectedObject;
  /** Nur bei Abruf zu einem Objekt: die jeweils andere Seite. */
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

  /** Mit `id` prüft das Backend vorab, ob dieses Objekt verknüpft werden darf (403, wenn nur lesbar). */
  options(type: ConnectionObjectType, id?: number): Observable<ConnectionOption[]> {
    const params: Record<string, string | number> = { object_type: type };
    if (id !== undefined) params['object_id'] = id;
    return this.http.get<ConnectionOption[]>(`${this.base}/options/`, { params });
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

  suggestions(type: ConnectionObjectType, id: number): Observable<LinkSuggestionDto[]> {
    return this.http.get<LinkSuggestionDto[]>(`${this.base}/link-suggestions/`, {
      params: { object_type: type, object_id: id },
    });
  }

  /** „Verknüpfen“: nur die Kennung — Typen und IDs leitet der Server ab. */
  acceptSuggestion(key: string): Observable<ConnectionDto> {
    return this.http.post<ConnectionDto>(`${this.base}/link-suggestions/accept/`, { key });
  }

  /** „Nicht relevant“: dieses Paar wird nicht mehr vorgeschlagen. */
  dismissSuggestion(key: string): Observable<void> {
    return this.http.post<void>(`${this.base}/link-suggestions/dismiss/`, { key });
  }
}
