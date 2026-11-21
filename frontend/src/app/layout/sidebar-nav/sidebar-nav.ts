import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { FinanzenStateService } from '../../features/finance/data/finance-state.service';
import { IconFinanzen } from '../../shared/ui/icons/icon-finance';
import { IconHaushalt } from '../../shared/ui/icons/icon-household';
import { IconOrganisation } from '../../shared/ui/icons/icon-organization';
import { Brand } from '../../shared/ui/brand/brand';

/**
 * Primäre Navigation für angemeldete App-Bereiche ab 960px Breite —
 * DESIGN_SYSTEM.md Version 3 "Sidebar-Navigation", ersetzt für breite
 * Viewports die reine Kopfzeilen-Navigation (die es davor gar nicht als
 * eigenständige Spalte gab). Unter 960px vollständig ausgeblendet (siehe
 * sidebar-nav.css) — dort bleibt die jeweils vorhandene Bottom-Nav
 * (dashboard.html-inline bzw. layout/bottom-nav) die primäre Navigation.
 *
 * Wird DIREKT in den Templates von Dashboard/Finanzen eingebunden (nicht
 * global in app.html) — dadurch liegt sie im selben Dependency-Injection-
 * Ast wie diese Komponenten und kann FinanzenStateService (route-level
 * providers, siehe app.routes.ts) direkt injizieren, statt Haushaltsdaten
 * über Inputs durchreichen zu müssen. Selbstständig, keine Inputs nötig.
 */
@Component({
  selector: 'app-sidebar-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconFinanzen, IconHaushalt, IconOrganisation, Brand],
  templateUrl: './sidebar-nav.html',
  styleUrl: './sidebar-nav.css',
})
export class SidebarNav {
  protected readonly auth = inject(AuthService);
  private readonly financeState = inject(FinanzenStateService);

  // Dieselbe /app- vs. /-Verzweigung wie im globalen Header (layout/header/
  // header.ts) und in Dashboard (features/dashboard/dashboard.ts) — Start,
  // Finanzen und Haushalt haben eine öffentliche Demo-Variante,
  // Organisation zeigt immer auf /app/... (siehe dort für die Begründung).
  protected readonly homeLink = computed(() => '/');
  protected readonly finanzenLink = computed(() => (this.auth.isAuthenticated() ? '/finanzen' : '/finanzen'));
  protected readonly haushaltLink = computed(() => (this.auth.isAuthenticated() ? '/haushalt' : '/haushalt'));

  protected readonly householdName = computed(() => this.financeState.uebersicht()?.household_name ?? '');
  protected readonly members = computed(() => this.financeState.uebersicht()?.members ?? []);

  protected readonly initials = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return '';
    const letters = user.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
    return letters || user.email[0]?.toUpperCase() || '?';
  });
}
