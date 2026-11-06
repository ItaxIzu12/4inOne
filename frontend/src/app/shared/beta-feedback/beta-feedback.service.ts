import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api.config';

export interface BetaChoice {
  value: string;
  label: string;
}
export interface BetaFeedbackInfo {
  /** Aus = kein Eintrag „Feedback geben“ (backend settings.BETA_FEEDBACK_ENABLED). */
  enabled: boolean;
  areas: BetaChoice[];
  tasks: BetaChoice[];
}
export type BetaAnswer = 'YES' | 'NO' | 'UNSURE' | '';
export interface BetaFeedbackInput {
  area: string;
  task: string;
  understood: number | null;
  in_control: number | null;
  saves_time: BetaAnswer;
  would_continue: BetaAnswer;
  message: string;
  /** Nur der Pfad der Seite (ohne Query) — der Server kürzt ohnehin. */
  page: string;
}

/** Beta-Rückmeldungen (backend core/feedback_views.py, Entwicklungsplan Phase 5). Es gibt bewusst kein Lesen. */
@Injectable({ providedIn: 'root' })
export class BetaFeedbackService {
  private readonly http = inject(HttpClient);

  info(): Observable<BetaFeedbackInfo> {
    return this.http.get<BetaFeedbackInfo>(`${API_BASE_URL}/feedback/`);
  }

  send(input: BetaFeedbackInput): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${API_BASE_URL}/feedback/`, input);
  }
}
