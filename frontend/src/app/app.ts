import { ErrorNotice } from './shared/error-notice/error-notice';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Header } from './shared/header/header';
import { Footer } from './shared/footer/footer';
import { BackToTop } from './shared/back-to-top/back-to-top';
import { BottomNav } from './shared/bottom-nav/bottom-nav';
import { HouseholdInviteModal } from './shared/household-invite-modal/household-invite-modal';

@Component({
  selector: 'app-root',
  imports: [ErrorNotice, RouterOutlet, Header, Footer, BackToTop, BottomNav, HouseholdInviteModal],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);

  private readonly navigationEnd = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    ),
  );

  private readonly currentRouteData = computed(() => {
    this.navigationEnd();
    let route = this.router.routerState.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route.snapshot.data;
  });

  // Footer wird immer gerendert (siehe shared/footer). Nur Back-to-Top/
  // Bottom-Nav der Marketing-Seiten werden für App-Routen (aktuell:
  // Dashboard, Einstellungen, siehe app.routes.ts data: { shell: 'bare' })
  // ausgeblendet — die App hat dort ihre eigene Bottom-Nav/FAB.
  /** Bis die erste Navigation (inkl. Anmeldeprüfung) fertig ist, sind die Routendaten leer. Ohne diese Sperre
   * blitzte beim Neuladen kurz die Marketing-Kopfzeile auf, bevor die App-Shell sie ersetzte. */
  private readonly routed = computed(() => this.navigationEnd() !== undefined);

  protected readonly showGlobalChrome = computed(
    () =>
      this.routed() &&
      this.currentRouteData()['shell'] !== 'bare' &&
      !this.currentRouteData()['sidebarNav'] &&
      !this.currentRouteData()['hideHeader'],
  );

  // Der Header zeigt normalerweise einen "Anmelden"-Button (siehe
  // shared/header) — auf der Anmelde-/Registrierungsseite selbst wäre das
  // redundant, da diese Seiten schon ihre eigene Marke/ihren eigenen
  // Zurück-Link haben (siehe app.routes.ts data: { hideHeader: true }).
  protected readonly showHeader = computed(
    () => this.routed() && this.currentRouteData()['hideHeader'] !== true && !this.currentRouteData()['sidebarNav'],
  );
}
