import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MfaApiService } from '../../core/mfa/mfa-api.service';
import { AppIcon } from '../../shared/icons/app-icon';
import { SettingsLayout } from './settings-layout';
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
    rows: [{ icon: 'profile', label: 'Profil bearbeiten', hint: 'Name und Heimatwährung', route: '/einstellungen/profil' }],
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
  imports: [AppShell, AppIcon, SettingsLayout, RouterLink, IconChevron, IconInfo, IconLegal, IconLogout, IconProfile, IconSessions, IconTwoFactor],
  templateUrl: './einstellungen.html',
  styleUrl: './einstellungen.css',
})
export class Einstellungen {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly groups = GROUPS;
  protected readonly name = computed(() => this.auth.currentUser()?.name ?? '');
  protected readonly email = computed(() => this.auth.currentUser()?.email ?? '');
  protected readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
  });
  protected readonly currency = computed(() => this.auth.currentUser()?.home_currency ?? 'EUR');

  // ---------- Kontoschutz (31.10.2026): drei ehrliche Zeilen statt einer Punktzahl ----------
  private readonly mfa = inject(MfaApiService);
  /** null = wird geladen / unbekannt (Fehler) — dann steht „wird geprüft“ statt einer Behauptung. */
  private readonly mfaOn = signal<boolean | null>(null);
  private readonly deviceCount = signal<number | null>(null);
  protected readonly checks = computed(() => {
    const verified = this.auth.currentUser()?.email_verified;
    const mfa = this.mfaOn();
    const devices = this.deviceCount();
    return [
      verified === false
        ? { key: 'mail', state: 'todo', title: 'E-Mail-Adresse noch nicht bestätigt', text: 'Bestätige sie über den Link in deinem Postfach – dann erreichen dich Einladungen.', link: '', action: '' }
        : { key: 'mail', state: 'ok', title: 'E-Mail-Adresse bestätigt', text: this.email(), link: '', action: '' },
      mfa === null
        ? { key: 'mfa', state: 'wait', title: 'Zwei-Faktor wird geprüft …', text: '', link: '/einstellungen/zwei-faktor', action: 'Ansehen' }
        : mfa
          ? { key: 'mfa', state: 'ok', title: 'Zwei-Faktor ist aktiv', text: 'Bei jeder Anmeldung fragen wir nach einem Code.', link: '/einstellungen/zwei-faktor', action: 'Ansehen' }
          : { key: 'mfa', state: 'todo', title: 'Zwei-Faktor ist aus', text: 'Ein zweiter Schritt schützt dein Konto, auch wenn jemand dein Passwort kennt. Dauert etwa eine Minute.', link: '/einstellungen/zwei-faktor', action: 'Einrichten' },
      devices === null
        ? { key: 'devices', state: 'wait', title: 'Angemeldete Geräte werden geladen …', text: '', link: '/einstellungen/sitzungen', action: 'Ansehen' }
        : { key: 'devices', state: 'ok', title: devices === 1 ? 'Nur dieses Gerät ist angemeldet' : `${devices} Geräte angemeldet`, text: devices === 1 ? 'Niemand sonst ist mit deinem Konto angemeldet.' : 'Kennst du ein Gerät nicht, melde es ab.', link: '/einstellungen/sitzungen', action: 'Ansehen' },
    ];
  });

  constructor() {
    this.mfa.status().subscribe({ next: (s) => this.mfaOn.set(!!s.enabled), error: () => this.mfaOn.set(null) });
    this.auth.sessions().subscribe({ next: (rows) => this.deviceCount.set(rows.length), error: () => this.deviceCount.set(null) });
  }

  protected logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login'),
    });
  }
}
