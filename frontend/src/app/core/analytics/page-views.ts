import { DestroyRef, inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { API_BASE_URL } from '../api.config';

/** Nur öffentliche Seiten werden gezählt — dieselbe Liste wie im Backend (website/views.py › TRACKED_PATHS). */
export const TRACKED_PATHS = new Set([
  '/', '/demo', '/login', '/registrieren', '/kontakt', '/kontakt/danke',
  '/impressum', '/datenschutz', '/nutzungsbedingungen', '/barrierefreiheit', '/404',
]);

/**
 * Datensparsame Besucherzählung: je Aufruf einer öffentlichen Seite ein Zähler +1 (Seite, Tag, Handy/Computer).
 * Kein Cookie, kein Speicher im Browser, keine ID; die Anfrage geht ohne Anmeldedaten an das eigene Backend.
 * Wer „Do Not Track“ oder „Global Privacy Control“ eingeschaltet hat, wird nicht gezählt, automatisierte Browser auch
 * nicht (Tests, Bots).
 */
@Injectable({ providedIn: 'root' })
export class PageViews {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private lastPath: string | null = null;

  start(): void {
    if (!this.allowed()) return;
    const sub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.record(event.urlAfterRedirects));
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  /** Pfad ohne Abfrage und Anker; unbekannte Adressen zählen als 404, alles andere außerhalb der Liste gar nicht. */
  static pathOf(url: string, notFound: boolean): string | null {
    if (notFound) return '/404';
    const path = url.split(/[?#]/)[0] || '/';
    return TRACKED_PATHS.has(path) ? path : null;
  }

  private record(url: string): void {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    const path = PageViews.pathOf(url, route.data['notFound'] === true);
    if (!path || path === this.lastPath) return;
    this.lastPath = path;
    const device = matchMedia('(max-width: 760px)').matches ? 'mobile' : 'desktop';
    try {
      void fetch(`${API_BASE_URL}/site/pageview/`, {
        method: 'POST',
        credentials: 'omit',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, device }),
      }).catch(() => undefined);
    } catch {
      // Zählen ist nie wichtiger als die Seite selbst.
    }
  }

  private allowed(): boolean {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string | null };
    if (nav.webdriver || nav.globalPrivacyControl === true || nav.doNotTrack === '1') return false;
    return typeof fetch === 'function';
  }
}
