import { ErrorNoticeDirective } from '../../shared/error-notice/error-notice';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ConnectionsSection } from '../../shared/connections/connections-section';
import {
  SuggestionAction,
  SuggestionDto,
  SuggestionKind,
  SuggestionsApi,
} from '../../shared/connections/suggestions-api.service';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { AppSelect, SelectOption } from '../../shared/form/select';

export type TripPlanTarget = 'packliste' | 'budget';

const KIND_ICON: Record<SuggestionKind, IconName> = {
  TRIP_PACKING: 'travel',
  TRIP_HOUSEHOLD_TASK: 'household',
  TRIP_SAVINGS_GOAL: 'finance',
  TRIP_SAVINGS_GOAL_MANUAL: 'finance',
  TRIP_BUDGET: 'finance',
};

/**
 * „Nächste Schritte“ einer Reise: was 4inOne bereichsübergreifend erkannt
 * hat (Sparziel, Haushaltsfolgen, Packliste), warum — und die Person
 * entscheidet (D-009). Darunter, was bereits mit der Reise verknüpft ist.
 *
 * Nur angemeldet: die Demo hat keine echten Bereiche, die sich verbinden
 * ließen (wie ConnectionsSection).
 */
@Component({
  selector: 'app-trip-plan',
  standalone: true,
  imports: [ErrorNoticeDirective, AppIcon, AppSelect, ConnectionsSection],
  templateUrl: './trip-plan.html',
  styleUrl: './trip-plan.scss',
})
export class TripPlan {
  private readonly api = inject(SuggestionsApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly tripId = input.required<number>();
  /** Eine Aktion, die nur eine Ansicht öffnet (Packliste, Budget). */
  readonly openTab = output<TripPlanTarget>();

  protected readonly enabled = computed(() => this.auth.isAuthenticated());
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly items = signal<SuggestionDto[]>([]);
  protected readonly busyKey = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  /** Vorschlag, für den gerade eine Person ausgewählt wird. */
  protected readonly choosingFor = signal<string | null>(null);
  protected readonly chosenMember = signal('');
  /** Neu erzeugen statt neu laden: so liest die Verbindungsliste nach einer Annahme frisch. */
  protected readonly connectionsVersion = signal(0);
  protected readonly kindIcon = KIND_ICON;

  constructor() {
    effect(() => {
      const id = this.tripId();
      if (!this.enabled()) return;
      untracked(() => {
        this.message.set(null);
        this.choosingFor.set(null);
        this.load(id);
      });
    });
  }

  private load(tripId: number): void {
    this.status.set('loading');
    this.api.forTrip(tripId).subscribe({
      next: (items) => {
        if (tripId !== this.tripId()) return;
        this.items.set(items);
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  protected reload(): void {
    this.load(this.tripId());
  }

  protected memberOptions(suggestion: SuggestionDto): SelectOption[] {
    return (suggestion.detail.members ?? []).map((m) => ({ value: String(m.id), label: m.name }));
  }

  protected run(suggestion: SuggestionDto, action: SuggestionAction): void {
    this.actionError.set(null);
    if (action.action === 'open_finance') {
      // Fremdwährung: das Sparziel legt die Person selbst in Euro an (keine Wechselkurse in 4inOne).
      void this.router.navigate(['/finanzen'], { queryParams: { goal: 'new', title: `Reise: ${suggestion.trip.title}` } });
      return;
    }
    if (action.navigate) {
      this.openTab.emit(action.action === 'open_budget' ? 'budget' : 'packliste');
      return;
    }
    if (action.needs_member) {
      this.choosingFor.set(suggestion.key);
      this.chosenMember.set('');
      return;
    }
    this.accept(suggestion, action);
  }

  protected confirmHandOver(suggestion: SuggestionDto): void {
    const memberId = Number(this.chosenMember());
    if (!memberId) {
      this.actionError.set('Bitte wähle aus, wer die Aufgabe übernimmt.');
      return;
    }
    const action = suggestion.actions.find((a) => a.action === 'hand_over');
    if (action) this.accept(suggestion, action, memberId);
  }

  protected cancelHandOver(): void {
    this.choosingFor.set(null);
    this.actionError.set(null);
  }

  private accept(suggestion: SuggestionDto, action: SuggestionAction, memberId?: number): void {
    if (this.busyKey()) return;
    this.busyKey.set(suggestion.key);
    this.api.accept(suggestion.key, action.action, memberId).subscribe({
      next: (result) => {
        this.busyKey.set(null);
        this.choosingFor.set(null);
        this.message.set(result.detail);
        this.connectionsVersion.update((v) => v + 1);
        this.reload();
      },
      error: (error: unknown) => {
        this.busyKey.set(null);
        this.actionError.set(this.errorText(error));
        // Gilt der Vorschlag nicht mehr (404), zeigt das Neuladen den aktuellen Stand.
        if (error instanceof HttpErrorResponse && error.status === 404) this.reload();
      },
    });
  }

  protected dismiss(suggestion: SuggestionDto): void {
    if (this.busyKey()) return;
    this.busyKey.set(suggestion.key);
    this.actionError.set(null);
    this.api.dismiss(suggestion.key).subscribe({
      next: () => {
        this.busyKey.set(null);
        this.items.update((items) => items.filter((i) => i.key !== suggestion.key));
      },
      error: (error: unknown) => {
        this.busyKey.set(null);
        this.actionError.set(this.errorText(error));
      },
    });
  }

  private errorText(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.detail === 'string') return error.error.detail;
    return 'Das hat nicht geklappt. Bitte versuche es noch einmal.';
  }
}
