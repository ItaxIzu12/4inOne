import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { Brand } from '../shared/brand/brand';
import { AppIcon, IconName } from '../shared/icons/app-icon';
import { Modal } from '../shared/modal/modal';
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, Brand, AppIcon, Modal],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  readonly auth = inject(AuthService);
  private router = inject(Router);
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
      { label: 'Organisation', icon: 'calendar' as IconName, path: '/app/organisation' },
      { label: 'Reisen', icon: 'travel' as IconName, path: '/app/reisen' },
    ];
  });
  readonly panel = signal('');
  readonly query = signal('');
  readonly logoutError = signal('');
  readonly busy = signal(false);
  readonly results = computed(() =>
    this.links().filter((x) =>
      x.label.toLocaleLowerCase('de').includes(this.query().trim().toLocaleLowerCase('de')),
    ),
  );
  close() {
    this.panel.set('');
  }
  logout() {
    if (this.busy()) return;
    this.busy.set(true);
    this.logoutError.set('');
    this.auth.logout().subscribe({
      next: () => {
        this.busy.set(false);
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
