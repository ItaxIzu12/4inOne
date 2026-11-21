import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { API_BASE_URL } from '../api.config';

/**
 * Startleitfäden (seit 21.11.2026): je Bereich drei Schritte, abgehakt aus echten Daten (Backend:
 * core/onboarding_views.py › OnboardingGuideView); „Ausblenden“ wird im Konto gespeichert und gilt auf allen Geräten.
 *
 * Nie in der Demo aufrufen — der Demo-Modus hängt an der Route (DEMO_MODE), deshalb prüfen das die Komponenten.
 */
export type GuideArea = 'finanzen' | 'haushalt' | 'organisation' | 'reisen';
export type GuideScope = GuideArea | 'start';

export interface GuideAreas {
  finanzen: { budget: boolean; transaction: boolean; goal: boolean };
  haushalt: { task: boolean; shopping: boolean; folder: boolean };
  organisation: { event: boolean; task: boolean; note: boolean };
  reisen: { trip: boolean; packing: boolean; budget: boolean; trip_id: number | null };
}
export interface GuideStatus {
  areas: GuideAreas;
  dismissed: GuideScope[];
}

/** Die ersten beiden Schritte machen einen Bereich „begonnen und eingerichtet“; der dritte ist jeweils optional. */
const REQUIRED: { [A in GuideArea]: (keyof GuideAreas[A])[] } = {
  finanzen: ['budget', 'transaction'],
  haushalt: ['task', 'shopping'],
  organisation: ['event', 'task'],
  reisen: ['trip', 'packing'],
};
const STEPS: { [A in GuideArea]: (keyof GuideAreas[A])[] } = {
  finanzen: ['budget', 'transaction', 'goal'],
  haushalt: ['task', 'shopping', 'folder'],
  organisation: ['event', 'task', 'note'],
  reisen: ['trip', 'packing', 'budget'],
};
export const GUIDE_AREAS: GuideArea[] = ['finanzen', 'haushalt', 'organisation', 'reisen'];

@Injectable({ providedIn: 'root' })
export class GuideService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/onboarding/guide/`;

  readonly status = signal<GuideStatus | null>(null);

  readonly dismissed = computed(() => new Set(this.status()?.dismissed ?? []));

  /** Neu laden — jeder Bereich ruft das beim Öffnen auf, damit frisch angelegte Einträge sofort abgehakt sind. */
  load(): void {
    this.http.get<GuideStatus>(this.url).subscribe({ next: (s) => this.accept(s), error: () => undefined });
  }

  /** Nur eine vollständige Antwort übernehmen — eine unerwartete Form darf keine Seite lahmlegen (dann kein Leitfaden). */
  private accept(s: unknown): void {
    const v = s as Partial<GuideStatus> | null;
    const ok = !!v && typeof v === 'object' && Array.isArray(v.dismissed) && !!v.areas && GUIDE_AREAS.every((a) => typeof v.areas?.[a] === 'object');
    if (ok) this.status.set(v as GuideStatus);
  }

  doneCount(area: GuideArea): number {
    const a = this.status()?.areas[area] as Record<string, unknown> | undefined;
    return a ? STEPS[area].filter((k) => a[k as string] === true).length : 0;
  }

  /** Erste beiden Schritte erledigt → der Bereich braucht keinen Leitfaden mehr. */
  isSetUp(area: GuideArea): boolean {
    const a = this.status()?.areas[area] as Record<string, unknown> | undefined;
    return !!a && REQUIRED[area].every((k) => a[k as string] === true);
  }

  /** Leitfaden zeigen? Nur mit geladenem Stand, nicht ausgeblendet und noch nicht eingerichtet. */
  shows(area: GuideArea): boolean {
    return !!this.status() && !this.dismissed().has(area) && !this.isSetUp(area);
  }

  hide(scope: GuideScope, hidden = true): void {
    const current = this.status();
    if (current) {
      // sofort ausblenden; das Backend bestätigt (bei Fehler kommt der Leitfaden beim nächsten Laden wieder)
      const rest = current.dismissed.filter((d) => d !== scope);
      this.status.set({ ...current, dismissed: hidden ? [...rest, scope] : rest });
    }
    this.http.put<GuideStatus>(this.url, { area: scope, hidden }).subscribe({ next: (s) => this.accept(s), error: () => undefined });
  }
}
