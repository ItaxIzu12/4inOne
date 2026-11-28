import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { BRAND } from '../../core/brand/brand.config';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ScrollService } from '../../core/scroll/scroll.service';
import { IconFinanzen } from '../../shared/ui/icons/icon-finance';
import { IconHaushalt } from '../../shared/ui/icons/icon-household';
import { IconOrganisation } from '../../shared/ui/icons/icon-organization';
import { IconMenu } from '../../shared/ui/icons/icon-menu';
import { IconClose } from '../../shared/ui/icons/icon-close';
import { Brand } from '../../shared/ui/brand/brand';
import { DEMO_ONLY } from '../../core/demo-only';

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
  imports: [
    RouterLink,
    RouterLinkActive,
    IconFinanzen,
    IconHaushalt,
    IconOrganisation,
    IconMenu,
    IconClose,
    Brand,
  ],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  protected readonly homeLabel = BRAND.a11y.homeLink;
  /** Testversion nur mit Demo (GitHub Pages): keine Wege zu Anmeldung/Registrierung. */
  protected readonly demoOnly = DEMO_ONLY;
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

  // `sidebarNav: true` (Bereiche mit der Seitenleiste der App-Hülle, siehe app-area.routes.ts) blendet die
  // redundante Modul-Reiter-Zeile hier aus — die Seitenleiste (layout/app-shell) übernimmt die Navigation ab
  // 960px, die Bottom-Nav darunter.
  protected readonly showDashboardNav = computed(
    () => this.routeData()['dashboardNav'] === true && this.routeData()['sidebarNav'] !== true,
  );

  // "Start" im Marken-Logo/in der Modul-Navigation soll für eingeloggte
  // Nutzer:innen zum echten Dashboard führen (/app), nicht zur öffentlichen
  // Demo-Startseite (/) — beide rendern dieselbe Dashboard-Komponente, nur
  // mit unterschiedlichem FinanzenDataProvider (siehe app.routes.ts).
  protected readonly homeLink = computed(() => '/');

  // Finanzen hat ebenfalls eine öffentliche Demo-Variante (/finanzen) und
  // eine echte (/app/finanzen) — Haushalt/Organisation haben aktuell keine
  // Demo-Variante (rein statische Feature-Listen ohne Datenanbindung) und
  // zeigen daher immer auf /app/..., der Guard dort leitet im ausgeloggten
  // Zustand zu /login weiter.
  protected readonly finanzenLink = computed(() => (this.auth.isAuthenticated() ? '/finanzen' : '/demo/finanzen'));
  // Haushalt hat seit dem Haushalt-Modul ebenfalls eine öffentliche Demo.
  protected readonly haushaltLink = computed(() => (this.auth.isAuthenticated() ? '/haushalt' : '/demo/haushalt'));

  // Mobiles Hamburger-Menü: bündelt auf schmalen Viewports dieselben Inhalte,
  // die ab 900px direkt im Header stehen (Modul-Reiter + Anmelden/Profil),
  // siehe header.css für die Breakpoint-Umschaltung.
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  constructor() {
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closeMenu();
      }
    };
    document.addEventListener('keydown', onKeydown);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('keydown', onKeydown));
  }

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
