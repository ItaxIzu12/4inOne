import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api.config';
import { SuggestionDto } from '../../shared/connections/suggestions-api.service';
import { TodayData, organisationTimezone } from '../organisation/organisation-api.service';

export interface TodayHouseholdTask {
  id: number;
  title: string;
  due_date: string;
  due_time: string | null;
  overdue: boolean;
  mine: boolean;
}

export interface TodayDeadline {
  entry_id: number;
  art: 'kuendigung' | 'garantie' | 'wartung';
  title: string;
  date: string;
  days: number;
}

export interface TodayTrip {
  id: number;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  days_until: number;
}

export interface TodayTripEvent {
  id: number;
  trip_id: number;
  trip_title: string;
  title: string;
  at: string;
  location: string;
}

/**
 * „Heute“ aus allen Bereichen — backend/connections/today.py. Jeder Abschnitt
 * enthält nur, was die Person in der jeweiligen Domain sehen darf; `haushalt`
 * ist null ohne Haushalt.
 */
export interface TodayOverview {
  date: string;
  timezone: string;
  organisation: TodayData;
  haushalt: {
    tasks: TodayHouseholdTask[];
    task_count: number;
    deadlines: TodayDeadline[];
    shopping_open: number;
  } | null;
  reisen: { current: TodayTrip | null; upcoming: TodayTrip | null; events: TodayTripEvent[] };
  finanzen: { month: string; budget: string | null; expenses: string; available: string | null; spent_today: string };
  suggestions: SuggestionDto[];
}

@Injectable({ providedIn: 'root' })
export class TodayApi {
  private readonly http = inject(HttpClient);

  overview(): Observable<TodayOverview> {
    return this.http.get<TodayOverview>(`${API_BASE_URL}/today/`, { params: { timezone: organisationTimezone() } });
  }
}
