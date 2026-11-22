import { DOCUMENT, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = '4io-darstellung';

/**
 * Darstellung (22.11.2026): System (Standard), Hell oder Dunkel. Die Wahl gilt je Gerät (Browser-Speicher, eine reine
 * Anzeige-Bequemlichkeit) und wird als data-theme an <html> gesetzt; „System“ entfernt das Attribut, dann entscheidet
 * prefers-color-scheme (shared/styles/theme-dark.css).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);
  readonly choice = signal<ThemeChoice>(this.read());

  /** Website-Seiten (Startseite, Rechtliches, 404) sind ein helles Editorial-Design: Route-Daten `theme: 'light'`. */
  private forcedLight = false;

  constructor() {
    this.apply(this.choice());
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
        let light = false;
        while (route) {
          if (route.data?.['theme'] === 'light') light = true;
          route = route.firstChild;
        }
        this.forcedLight = light;
        this.apply(this.choice());
      });
  }


  set(choice: ThemeChoice): void {
    this.choice.set(choice);
    try {
      if (choice === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      /* ohne Speicher gilt die Wahl nur bis zum Neuladen */
    }
    this.apply(choice);
  }

  private read(): ThemeChoice {
    if (!this.browser) return 'system';
    try {
      const value = localStorage.getItem(KEY);
      return value === 'light' || value === 'dark' ? value : 'system';
    } catch {
      return 'system';
    }
  }

  private apply(choice: ThemeChoice): void {
    const root = this.document.documentElement;
    if (!root) return;
    if (this.forcedLight) root.setAttribute('data-theme', 'light');
    else if (choice === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', choice);
  }
}
