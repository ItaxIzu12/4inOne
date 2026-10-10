import { ErrorNoticeDirective } from '../shared/error-notice/error-notice';
import { Component, DestroyRef, input, output, ElementRef, HostListener, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IsActiveMatchOptions, NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { BackToTop } from '../shared/back-to-top/back-to-top';
import { Brand } from '../shared/brand/brand';
import { AppIcon, IconName } from '../shared/icons/app-icon';
import { IconInfo } from '../shared/icons/icon-info';
import { IconLegal } from '../shared/icons/icon-legal';
import { IconLogout } from '../shared/icons/icon-logout';
import { IconProfile } from '../shared/icons/icon-profile';
import { IconSettings } from '../shared/icons/icon-settings';
import { IconTwoFactor } from '../shared/icons/icon-two-factor';
import { Modal } from '../shared/modal/modal';
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [ErrorNoticeDirective, RouterLink, RouterLinkActive, BackToTop, Brand, AppIcon, Modal, IconInfo, IconLegal, IconLogout, IconProfile, IconSettings, IconTwoFactor],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  /** Auf der Startseite filtert die Suche live (dashboardQuery); überall sonst führt Enter dorthin. */
  /** Genau ein aktiver Navigationspunkt: Start nur auf der Startseite selbst, ein Bereich auch auf seinen Unterseiten
   * (?tab=…, ?trip=…) — Query-Parameter zählen dabei nie mit. */
  protected readonly startMatch: IsActiveMatchOptions = { paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' };
  protected readonly areaMatch: IsActiveMatchOptions = { paths: 'subset', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' };
  readonly dashboardHeader = input(false);
  readonly dashboardQuery = output<string>();
  /** Vorbelegung des Suchfelds, z. B. ein von einer anderen Seite mitgebrachter Suchbegriff. */
  readonly searchValue = input('');
  private readonly today = new Date();
  /** Datum in der Kopfzeile: Wochentag klein darüber, Datum darunter (z. B. „Montag“ / „5. Oktober 2026“). */
  readonly todayWeekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(this.today);
  readonly todayDate = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(this.today);
  readonly todayShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }).format(this.today);
  readonly todayIso = `${this.today.getFullYear()}-${String(this.today.getMonth() + 1).padStart(2, '0')}-${String(this.today.getDate()).padStart(2, '0')}`;
  private readonly dashboardSearch = viewChild<ElementRef<HTMLInputElement>>('dashboardSearch');
  private readonly topbar = viewChild<ElementRef<HTMLElement>>('topbar');
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Die globale Kopfzeile ist je nach Breite und Demo-Hinweis unterschiedlich hoch (Suchfeld in eigener Zeile).
    // Ihre echte Höhe steht in --shell-header-height, damit feststehende Seitenköpfe (domain-layout) direkt
    // darunter andocken statt darunter zu verschwinden.
    afterNextRender(() => {
      const bar = this.topbar()?.nativeElement;
      if (!bar || typeof ResizeObserver === 'undefined') return;
      const apply = () => this.host.nativeElement.style.setProperty('--shell-header-height', `${Math.round(bar.getBoundingClientRect().height)}px`);
      apply();
      const observer = new ResizeObserver(apply);
      observer.observe(bar);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
  @HostListener('document:keydown', ['$event'])
  focusDashboardSearch(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.dashboardSearch()?.nativeElement.focus();
    }
  }

  readonly auth = inject(AuthService);
  private router = inject(Router);
  // Eigenes Signal statt nur auth.isAuthenticated(): wer über "4inOne entdecken" (Onboarding) oder einen
  // direkten Link auf eine öffentliche Vorschau-Route (siehe app.routes.ts) navigiert, sieht dort Demo-Daten,
  // auch während die eigene Sitzung (Token im Speicher) weiterhin angemeldet bleibt — der Demo-Hinweis unten
  // muss sich deshalb nach der tatsächlich angezeigten Route richten, nicht nur nach dem Anmeldestatus.
  private readonly currentUrl = toSignal(
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)),
    { initialValue: null },
  );
  // Die explizite Demo-URL bestimmt den Modus, auch bei bestehender Anmeldung.
  readonly isDemoRoute = computed(() => {
    const url = (this.currentUrl()?.urlAfterRedirects ?? this.router.url).split('?')[0].split('#')[0];
    return url === '/demo' || url.startsWith('/demo/');
  });
  readonly name = computed(() => this.isDemoRoute() ? 'Sophie' : this.auth.currentUser()?.name || 'Mein Konto');
  /** „Mira Neu“ → „MN“, „Sophie“ → „S“. */
  readonly initials = computed(() => {
    const words = this.name().trim().split(/\s+/).filter(Boolean);
    return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase() || '?';
  });
  /** Kleine Zeile unter dem Namen im Profil-Knopf. */
  readonly accountHint = computed(() => (this.isDemoRoute() ? 'Vorschau' : 'Mein Konto'));
  readonly links = computed(() => {
    const live = !this.isDemoRoute();
    return [
      { label: 'Startseite', icon: 'home' as IconName, path: live ? '/' : '/demo' },
      {
        label: 'Finanzen',
        icon: 'finance' as IconName,
        path: live ? '/finanzen' : '/demo/finanzen',
      },
      {
        label: 'Haushalt',
        icon: 'household' as IconName,
        path: live ? '/haushalt' : '/demo/haushalt',
      },
      { label: 'Organisation', icon: 'calendar' as IconName, path: live ? '/organisation' : '/demo/organisation' },
      { label: 'Reisen', icon: 'travel' as IconName, path: live ? '/reisen' : '/demo/reisen' },
    ];
  });
  onSearchInput(value: string) {
    if (this.dashboardHeader()) this.dashboardQuery.emit(value);
  }
  /** Außerhalb der Startseite: zur Startseite, dort zeigt die Suche die Treffer. */
  submitSearch(value: string) {
    if (this.dashboardHeader() || !value.trim()) return;
    void this.router.navigate([this.links()[0].path], { queryParams: { q: value.trim() } });
  }
  readonly panel = signal('');
  readonly menuOpen = signal(false);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly logoutError = signal('');
  readonly busy = signal(false);
  close() {
    this.panel.set('');
  }
  toggleMenu() {
    if (this.menuOpen()) return this.closeMenu(true);
    this.logoutError.set('');
    this.menuOpen.set(true);
    // erst nach dem Rendern ist der Menüpunkt da
    afterNextRender(() => this.menuItems()[0]?.focus(), { injector: this.injector });
  }
  closeMenu(returnFocus = false) {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    if (returnFocus) this.trigger()?.nativeElement.focus();
  }
  private menuItems(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.account-menu [role=menuitem]:not([disabled])'));
  }
  /** Pfeiltasten wandern durch die Punkte, Escape schließt und gibt den Fokus zurück, Tab verlässt das Menü. */
  onMenuKey(event: KeyboardEvent) {
    const items = this.menuItems();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focus = (i: number) => {
      event.preventDefault();
      items[(i + items.length) % items.length]?.focus();
    };
    if (event.key === 'ArrowDown') focus(index + 1);
    else if (event.key === 'ArrowUp') focus(index - 1);
    else if (event.key === 'Home') focus(0);
    else if (event.key === 'End') focus(items.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeMenu(true);
    } else if (event.key === 'Tab') this.closeMenu();
  }
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent) {
    if (this.menuOpen() && !(event.target as HTMLElement).closest('.account')) this.closeMenu();
  }
  logout() {
    if (this.busy()) return;
    this.busy.set(true);
    this.logoutError.set('');
    this.auth.logout().subscribe({
      next: () => {
        this.busy.set(false);
        this.closeMenu();
        this.close();
        this.router.navigateByUrl('/', { onSameUrlNavigation: 'reload', replaceUrl: true });
      },
      error: () => {
        this.busy.set(false);
        this.logoutError.set('Abmelden fehlgeschlagen. Bitte erneut versuchen.');
      },
    });
  }
}
