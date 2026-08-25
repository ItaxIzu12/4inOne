import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ScrollService } from '../../core/scroll/scroll.service';
import { IconFinanzen } from '../icons/icon-finanzen';
import { IconHaushalt } from '../icons/icon-haushalt';
import { IconOrganisation } from '../icons/icon-organisation';
import { LogoKompass } from '../icons/logo-kompass';

/**
 * Ein Header für die gesamte App — Marketing-Seiten UND Dashboard/
 * Einstellungen. Zwei getrennte Header-Implementierungen sind bewusst
 * vermieden, damit sie nicht auseinanderdriften. Zwei unabhängige Signale
 * steuern, was zusätzlich zur Marke erscheint:
 * - `data: { dashboardNav: true }` (nur die Dashboard-Route) zeigt
 *   zusätzlich die Modul-Reiter Start/Finanzen/Haushalt/Organisation.
 * - AuthService.isAuthenticated() (ECHTER Anmeldestatus, nicht die Route!)
 *   zeigt Initialen statt des "Anmelden"-Buttons.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconFinanzen, IconHaushalt, IconOrganisation, LogoKompass],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  private readonly scroll = inject(ScrollService);
  private readonly router = inject(Router);

  private readonly navigationEnd = toSignal(
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)),
  );

  private readonly routeData = computed(() => {
    this.navigationEnd();
    let route = this.router.routerState.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route.snapshot.data;
  });

  protected readonly showDashboardNav = computed(() => this.routeData()['dashboardNav'] === true);

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

  protected goHome(): void {
    this.scroll.toTop();
  }
}
