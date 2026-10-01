import { Component, ElementRef, HostListener, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
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
  imports: [RouterLink, RouterLinkActive, Brand, AppIcon, Modal, IconInfo, IconLegal, IconLogout, IconProfile, IconSettings, IconTwoFactor],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
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
  // Explizite Liste statt "alles außer /app": z. B. /einstellungen/* ist ebenfalls real-only (angemeldet,
  // keine Demo-Variante, siehe app.routes.ts) und läge sonst fälschlich außerhalb von /app.
  private static readonly DEMO_PATHS = new Set(['/', '/finanzen', '/haushalt', '/organisation', '/reisen']);
  readonly isDemoRoute = computed(() => {
    const url = (this.currentUrl()?.urlAfterRedirects ?? this.router.url).split('?')[0].split('#')[0];
    return AppShell.DEMO_PATHS.has(url);
  });
  readonly name = computed(() => this.auth.currentUser()?.name || 'Sophie');
  readonly initials = computed(() => this.name().slice(0, 1).toUpperCase());
  readonly links = computed(() => {
    const live = this.auth.isAuthenticated();
    return [
      { label: 'Startseite', icon: 'home' as IconName, path: live ? '/app' : '/' },
      {
        label: 'Finanzen',
        icon: 'finance' as IconName,
        path: live ? '/app/finanzen' : '/finanzen',
      },
      {
        label: 'Haushalt',
        icon: 'household' as IconName,
        path: live ? '/app/haushalt' : '/haushalt',
      },
      { label: 'Organisation', icon: 'calendar' as IconName, path: live ? '/app/organisation' : '/organisation' },
      { label: 'Reisen', icon: 'travel' as IconName, path: live ? '/app/reisen' : '/reisen' },
    ];
  });
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
        this.router.navigateByUrl('/login');
      },
      error: () => {
        this.busy.set(false);
        this.logoutError.set('Abmelden fehlgeschlagen. Bitte erneut versuchen.');
      },
    });
  }
}
