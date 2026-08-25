import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Header } from './shared/header/header';
import { Footer } from './shared/footer/footer';
import { BackToTop } from './shared/back-to-top/back-to-top';
import { BottomNav } from './shared/bottom-nav/bottom-nav';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, BackToTop, BottomNav],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);

  private readonly navigationEnd = toSignal(
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)),
  );

  // Header UND Footer sind überall gleich (siehe shared/header,
  // shared/footer) und werden immer gerendert. Nur Back-to-Top/Bottom-Nav
  // der Marketing-Seiten werden für App-Routen (aktuell: Dashboard,
  // Einstellungen, siehe app.routes.ts data: { shell: 'bare' }) ausgeblendet
  // — die App hat dort ihre eigene Bottom-Nav/FAB.
  protected readonly showGlobalChrome = computed(() => {
    this.navigationEnd();
    let route = this.router.routerState.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route.snapshot.data['shell'] !== 'bare';
  });
}
