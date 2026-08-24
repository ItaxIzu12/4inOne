import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Copyright } from '../../shared/copyright/copyright';
import { IconChevron } from '../../shared/icons/icon-chevron';
import { IconDocument } from '../../shared/icons/icon-document';
import { IconLegal } from '../../shared/icons/icon-legal';
import { IconLogout } from '../../shared/icons/icon-logout';
import { IconProfile } from '../../shared/icons/icon-profile';
import { IconSessions } from '../../shared/icons/icon-sessions';
import { IconTwoFactor } from '../../shared/icons/icon-two-factor';

type AccountIcon = 'profile' | 'two-factor' | 'sessions';

interface AccountRow {
  icon: AccountIcon;
  label: string;
  route: string;
}

interface LegalRow {
  label: string;
  route: string;
}

const ACCOUNT_ROWS: AccountRow[] = [
  { icon: 'profile', label: 'Profil bearbeiten', route: '/einstellungen/profil' },
  { icon: 'two-factor', label: 'Zwei-Faktor-Authentifizierung', route: '/einstellungen/zwei-faktor' },
  { icon: 'sessions', label: 'Aktive Sitzungen', route: '/einstellungen/sitzungen' },
];

const LEGAL_ROWS: LegalRow[] = [
  { label: 'Impressum', route: '/impressum' },
  { label: 'Datenschutzerklärung', route: '/datenschutz' },
  { label: 'Nutzungsbedingungen', route: '/nutzungsbedingungen' },
  { label: 'Barrierefreiheitserklärung', route: '/barrierefreiheit' },
];

@Component({
  selector: 'app-einstellungen',
  standalone: true,
  imports: [
    RouterLink,
    Copyright,
    IconChevron,
    IconDocument,
    IconLegal,
    IconLogout,
    IconProfile,
    IconSessions,
    IconTwoFactor,
  ],
  templateUrl: './einstellungen.html',
  styleUrl: './einstellungen.css',
})
export class Einstellungen {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly accountRows = ACCOUNT_ROWS;
  protected readonly legalRows = LEGAL_ROWS;

  protected logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login'),
    });
  }
}
