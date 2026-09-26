import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AppShell } from '../../layout/app-shell';
import { IconChevron } from '../../shared/icons/icon-chevron';
import { IconInfo } from '../../shared/icons/icon-info';
import { IconLegal } from '../../shared/icons/icon-legal';
import { IconLogout } from '../../shared/icons/icon-logout';
import { IconProfile } from '../../shared/icons/icon-profile';
import { IconSessions } from '../../shared/icons/icon-sessions';
import { IconTwoFactor } from '../../shared/icons/icon-two-factor';

type RowIcon = 'profile' | 'two-factor' | 'sessions' | 'legal' | 'info';

interface Row {
  icon: RowIcon;
  label: string;
  hint: string;
  route: string;
}
interface Group {
  id: string;
  title: string;
  rows: Row[];
}

const GROUPS: Group[] = [
  {
    id: 'konto',
    title: 'Konto',
    rows: [{ icon: 'profile', label: 'Profil bearbeiten', hint: 'Deinen Namen ändern', route: '/einstellungen/profil' }],
  },
  {
    id: 'sicherheit',
    title: 'Sicherheit',
    rows: [
      { icon: 'two-factor', label: 'Zwei-Faktor-Authentifizierung', hint: 'Dein Konto zusätzlich schützen', route: '/einstellungen/zwei-faktor' },
      { icon: 'sessions', label: 'Aktive Sitzungen', hint: 'Angemeldete Geräte ansehen und abmelden', route: '/einstellungen/sitzungen' },
    ],
  },
  {
    id: 'rechtliches',
    title: 'Datenschutz und Rechtliches',
    rows: [
      { icon: 'legal', label: 'Datenschutz', hint: 'Wie wir mit deinen Daten umgehen', route: '/datenschutz' },
      { icon: 'legal', label: 'Nutzungsbedingungen', hint: 'Regeln für die Nutzung von 4inOne', route: '/nutzungsbedingungen' },
      { icon: 'legal', label: 'Impressum', hint: 'Anbieterkennzeichnung', route: '/impressum' },
      { icon: 'info', label: 'Barrierefreiheit', hint: 'Unser Stand und Kontakt', route: '/barrierefreiheit' },
    ],
  },
];

@Component({
  selector: 'app-einstellungen',
  standalone: true,
  imports: [AppShell, RouterLink, IconChevron, IconInfo, IconLegal, IconLogout, IconProfile, IconSessions, IconTwoFactor],
  templateUrl: './einstellungen.html',
  styleUrl: './einstellungen.css',
})
export class Einstellungen {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly groups = GROUPS;
  protected readonly name = computed(() => this.auth.currentUser()?.name ?? '');
  protected readonly email = computed(() => this.auth.currentUser()?.email ?? '');
  protected readonly initials = computed(() => this.name().slice(0, 1).toUpperCase());

  protected logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login'),
    });
  }
}
