import { IllustrationHome } from '../../shared/icons/illustration-home';
import { ContextBar } from '../../shared/context-bar/context-bar';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { IconHaushalt } from '../../shared/icons/icon-haushalt';
import { IconOrganisation } from '../../shared/icons/icon-organisation';
import { Onboarding } from '../../shared/onboarding/onboarding';
import { SidebarNav } from '../../shared/sidebar-nav/sidebar-nav';
import { FINANZEN_DATA_PROVIDER } from '../finanzen/finanzen-data-provider';
import { TransactionDto } from '../finanzen/finanzen-api.service';
import { FinanzenStateService } from '../finanzen/finanzen-state.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    IllustrationHome,
    RouterLink,
    DecimalPipe,
    DatePipe,
    IconHaushalt,
    IconOrganisation,
    Onboarding,
    SidebarNav,
    ContextBar,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  // protected statt private: dashboard.html braucht auth.isAuthenticated()
  // direkt, um den Onboarding-Block nur unter /app zu zeigen (nie auf der
  // öffentlichen Demo-Route, siehe Chat-Verlauf TEIL 4).
  protected readonly auth = inject(AuthService);

  // Geteilter Übersicht-Zustand mit der Finanzen-Seite (siehe Chat-Verlauf:
  // "Dashboard und Finanzen dürfen niemals auseinanderlaufen") — DIESELBE
  // Service-Instanz wie in features/finanzen/finanzen.ts (pro Routengruppe
  // einmal bereitgestellt, siehe app.routes.ts), ruft denselben
  // /api/v1/finanzen/uebersicht/-Endpunkt auf, keine eigene Berechnung mehr.
  // budget war vorher ein hartkodiertes Platzhalter-Objekt ({amount:1240,
  // spent:794}) — komplett losgelöst von echten Daten und sogar von den
  // eigenen Demo-Werten der Finanzen-Seite abweichend (1950/1240 dort).
  protected readonly financeState = inject(FinanzenStateService);
  private readonly provider = inject(FINANZEN_DATA_PROVIDER);

  // "Dienstag, 22. September" — für die jetzt sichtbare Begrüßungszeile
  // (siehe Design-Entwurf: "Guten Morgen, Anna." + Datum darunter).
  protected readonly todayLabel = computed(() =>
    new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(
      new Date(),
    ),
  );

  // Tageszeit-abhängig ("Guten Morgen"/"Guten Tag"/"Guten Abend") statt der
  // Mockup-Beispielzeit fest zu übernehmen — sonst stünde nachmittags
  // fälschlich "Guten Morgen" da.
  protected readonly greeting = computed(() => {
    const user = this.auth.currentUser();
    const firstName = user?.name.trim().split(/\s+/)[0];
    const hour = new Date().getHours();
    const zeit = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
    return firstName ? `${zeit}, ${firstName}` : zeit;
  });

  // Hero-Kennzahl (Design-Entwurf: "Diesen Monat verfügbar") — dieselbe
  // Kennzahl wie im Analysen-Tab von Finanzen (verfuegbares_einkommen),
  // NICHT der Budget-"ausgegeben"-Wert von oben. Kommt aus demselben
  // geteilten FinanzenStateService, braucht dafür ladenBeide() statt nur
  // laden() (siehe Konstruktor).
  protected readonly verfuegbaresEinkommen = computed(() =>
    Number(this.financeState.analysen()?.verfuegbares_einkommen ?? 0),
  );
  protected readonly monthlyBuffer = computed(() =>
    Number(this.financeState.analysen()?.monthly_buffer ?? 0),
  );

  // "Letzte Ausgaben" (Design-Entwurf) — dieselben echten Transaktionen wie
  // in Finanzen (searchTransactions('')), hier nur die obersten paar.
  protected readonly recentTransactions = signal<TransactionDto[]>([]);

  constructor() {
    this.financeState.ladenBeide();
    this.provider.searchTransactions('').subscribe({
      next: (page) => this.recentTransactions.set(page.results.slice(0, 3)),
      error: () => {},
    });
  }

  // Für die eigene Bottom-Nav unten (mobil) — dasselbe /app- vs. /-Muster
  // wie im globalen Header (shared/header/header.ts homeLink/finanzenLink).
  protected readonly homeLink = computed(() => (this.auth.isAuthenticated() ? '/app' : '/'));
  protected readonly finanzenLink = computed(() =>
    this.auth.isAuthenticated() ? '/app/finanzen' : '/finanzen',
  );
}
