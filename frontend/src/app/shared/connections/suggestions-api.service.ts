import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api.config';

/** Die Arten von Vorschlägen — backend/connections/suggestions.py. */
export type SuggestionKind = 'TRIP_SAVINGS_GOAL' | 'TRIP_BUDGET' | 'TRIP_HOUSEHOLD_TASK' | 'TRIP_PACKING';

export type SuggestionActionKey = 'create_goal' | 'postpone' | 'hand_over' | 'link' | 'open_packing' | 'open_budget';

export interface SuggestionAction {
  action: SuggestionActionKey;
  label: string;
  /** Öffnet nur eine Ansicht, speichert nichts. */
  navigate?: boolean;
  /** Braucht die Auswahl einer Person aus dem Haushalt. */
  needs_member?: boolean;
}

export interface SuggestionMember {
  id: number;
  name: string;
}

/**
 * Ein Vorschlag: erkannt, erklärt, vorgeschlagen — entschieden wird hier
 * (D-009). Das Backend berechnet ihn bei jedem Aufruf neu und liefert nur,
 * was die Person sehen darf.
 */
export interface SuggestionDto {
  key: string;
  kind: SuggestionKind;
  title: string;
  reason: string;
  trip: { id: number; title: string };
  actions: SuggestionAction[];
  detail: {
    members?: SuggestionMember[];
    [key: string]: unknown;
  };
}

export interface SuggestionResult {
  detail: string;
}

@Injectable({ providedIn: 'root' })
export class SuggestionsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/connections/suggestions`;

  forTrip(tripId: number): Observable<SuggestionDto[]> {
    return this.http.get<SuggestionDto[]>(`${this.base}/`, { params: { trip: tripId } });
  }

  accept(key: string, action: SuggestionActionKey, memberId?: number): Observable<SuggestionResult> {
    return this.http.post<SuggestionResult>(`${this.base}/accept/`, {
      key,
      action,
      ...(memberId !== undefined ? { member_id: memberId } : {}),
    });
  }

  dismiss(key: string): Observable<void> {
    return this.http.post<void>(`${this.base}/dismiss/`, { key });
  }
}
