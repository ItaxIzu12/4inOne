import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Header } from './shared/header/header';
import { Footer } from './shared/footer/footer';
import { BackToTop } from './shared/back-to-top/back-to-top';
import { BottomNav } from './shared/bottom-nav/bottom-nav';
import { DemoBanner } from './shared/demo-banner/demo-banner';
import { HouseholdInviteModal } from './shared/household-invite-modal/household-invite-modal';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, BackToTop, BottomNav, DemoBanner, HouseholdInviteModal],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);

  private readonly navigationEnd = toSignal(
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)),
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
  protected readonly showGlobalChrome = computed(() => this.currentRouteData()['shell'] !== 'bare' && !this.currentRouteData()['sidebarNav'] && !this.currentRouteData()['hideHeader']);

  // Der Header zeigt normalerweise einen "Anmelden"-Button (siehe
  // shared/header) — auf der Anmelde-/Registrierungsseite selbst wäre das
  // redundant, da diese Seiten schon ihre eigene Marke/ihren eigenen
  // Zurück-Link haben (siehe app.routes.ts data: { hideHeader: true }).
  protected readonly showHeader = computed(() => this.currentRouteData()['hideHeader'] !== true && !this.currentRouteData()['sidebarNav']);

  // Kompakte Erklär-Kopfzeile NUR auf den öffentlichen Demo-Routen (data:
  // { isDemo: true } auf der Root-Routengruppe, siehe app.routes.ts) —
  // niemals unter /app, wo echte Nutzerdaten laufen.
  protected readonly showDemoBanner = computed(() => this.currentRouteData()['isDemo'] === true);
}
