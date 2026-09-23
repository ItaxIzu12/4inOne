import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconFinanzen } from '../icons/icon-finanzen';
import { IconHaushalt } from '../icons/icon-haushalt';
import { IconOrganisation } from '../icons/icon-organisation';

interface NavItem {
  route: string;
  label: string;
  accent?: 'finance' | 'organize' | 'household';
}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconFinanzen, IconHaushalt, IconOrganisation],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.css',
})
export class BottomNav {
  // Nur auf Marketing-/Rechtsseiten sichtbar (data: shell !== 'bare', siehe
  // app.ts showGlobalChrome()) — Dashboard/Finanzen haben ihre eigene
  // Bottom-Nav. Finanzen zeigt hier immer auf die öffentliche Demo-Route
  // (/finanzen bzw. /haushalt); Organisation hat keine Demo-Variante und
  // zeigt auf /app/..., der Guard leitet im ausgeloggten Zustand zu /login.
  protected readonly items: NavItem[] = [
    { route: '/', label: 'Start' },
    { route: '/finanzen', label: 'Finanzen', accent: 'finance' },
    { route: '/haushalt', label: 'Haushalt', accent: 'household' },
    { route: '/app/organisation', label: 'Organisation', accent: 'organize' },
  ];
}
