import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CategoryApiService } from '../../features/finanzen/category-api.service';
import { FinanzenStateService } from '../../features/finanzen/finanzen-state.service';
import { HouseholdInviteModalService } from '../../core/household/household-invite-modal.service';
import { OnboardingApiService } from '../../core/onboarding/onboarding-api.service';
import { Modal } from '../modal/modal';

interface OnboardingStep {
  key: 'transaction' | 'category' | 'invite';
  title: string;
  subtitle: string;
  actionLabel: string;
  action: () => void;
}

/**
 * Nur unter /app relevant (siehe features/dashboard/dashboard.html — dort
 * nur @if (auth.isAuthenticated())). Jeder der drei Basis-Schritte
 * verschwindet EINZELN, sobald der zugehörige hasData()-Wert aus
 * OnboardingStatusView true wird — nicht erst der ganze Block auf einmal.
 * Kein Schritt ist je eine Voraussetzung, um andere Teile der App zu
 * nutzen (siehe Chat-Verlauf) — reine Anregung, keine Sperre.
 */
@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [Modal],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.css',
})
export class Onboarding {
  private readonly api = inject(OnboardingApiService);
  private readonly categoryApi = inject(CategoryApiService);
  private readonly inviteModal = inject(HouseholdInviteModalService);
  private readonly router = inject(Router);

  // Dieselbe geteilte Übersicht-Instanz wie Dashboard/Finanzen (siehe
  // Chat-Verlauf SCHRITT 5: "keine separate, zweite hasData()-Prüfung
  // unabhängig vom FinanzenStateService") — has_transaction aus
  // OnboardingStatusView wird NICHT mehr verwendet, stattdessen direkt aus
  // demselben geteilten Zustand abgeleitet, den auch das Budget im
  // Dashboard nutzt. Sobald die erste Ausgabe erfasst wird, aktualisiert
  // sich uebersicht() (via invalidieren() in finanzen.ts), und dieser
  // Schritt verschwindet automatisch — aus DERSELBEN Aktualisierung, die
  // auch die Budget-Kachel im Dashboard erneuert, nicht zeitversetzt.
  private readonly financeState = inject(FinanzenStateService);
  private readonly hasTransaction = computed(() => {
    const u = this.financeState.uebersicht();
    return u !== null && Number(u.budget.planned) > 0;
  });

  private readonly status = signal<{
    has_category: boolean;
    member_count: number;
    mfa_enabled: boolean;
  } | null>(null);

  protected readonly loaded = computed(() => this.status() !== null);

  protected readonly steps = computed<OnboardingStep[]>(() => {
    const s = this.status();
    if (!s) return [];
    const list: OnboardingStep[] = [];
    if (!this.hasTransaction()) {
      list.push({
        key: 'transaction',
        title: 'Erste Ausgabe erfassen',
        subtitle: 'Leg direkt los und sieh, wie Kompass deine Ausgaben ordnet.',
        actionLabel: 'Ausgabe erfassen',
        action: () => this.router.navigateByUrl('/app/finanzen'),
      });
    }
    if (!s.has_category) {
      list.push({
        key: 'category',
        title: 'Kategorie anlegen',
        subtitle: 'Ordne deine Ausgaben in eigene Kategorien ein.',
        actionLabel: 'Kategorie anlegen',
        action: () => this.openCategoryModal(),
      });
    }
    if (s.member_count < 2) {
      list.push({
        key: 'invite',
        title: 'Haushalt einladen',
        subtitle: 'Teile Kompass mit deinem Haushalt — läuft automatisch mit.',
        actionLabel: 'Einladen',
        action: () => this.inviteModal.open(),
      });
    }
    return list;
  });

  // Bewusst kein Pflicht-Vervollständigungs-Stil (siehe GESAMTKONZEPT.md
  // §4.1 "kein Pflicht-Tutorial") — daher visuell als "Optional" statt als
  // vierter nummerierter Schritt markiert (siehe onboarding.html).
  protected readonly showMfaStep = computed(() => this.status()?.mfa_enabled === false);

  protected readonly visible = computed(() => this.steps().length > 0 || this.showMfaStep());

  // ---------- "Kategorie anlegen"-Mini-Formular ----------
  protected readonly categoryModalOpen = signal(false);
  protected readonly categoryName = signal('');
  protected readonly categorySubmitting = signal(false);
  protected readonly categoryError = signal<string | null>(null);

  constructor() {
    this.loadStatus();
  }

  private loadStatus(): void {
    this.api.getStatus().subscribe({ next: (s) => this.status.set(s), error: () => {} });
  }

  protected openCategoryModal(): void {
    this.categoryModalOpen.set(true);
  }

  protected closeCategoryModal(): void {
    this.categoryModalOpen.set(false);
    this.categoryName.set('');
    this.categoryError.set(null);
  }

  protected onCategorySubmit(event: Event): void {
    event.preventDefault();
    if (!this.categoryName().trim()) {
      this.categoryError.set('Bitte einen Namen für die Kategorie eingeben.');
      return;
    }

    this.categoryError.set(null);
    this.categorySubmitting.set(true);
    this.categoryApi.create(this.categoryName().trim()).subscribe({
      next: () => {
        this.categorySubmitting.set(false);
        this.closeCategoryModal();
        // Status neu laden, damit der Schritt sofort verschwindet, nicht
        // erst beim nächsten Seitenaufruf.
        this.loadStatus();
      },
      error: () => {
        this.categorySubmitting.set(false);
        this.categoryError.set('Kategorie konnte nicht angelegt werden. Bitte versuche es erneut.');
      },
    });
  }

  protected goToMfaSetup(): void {
    this.router.navigateByUrl('/einstellungen/zwei-faktor');
  }
}
