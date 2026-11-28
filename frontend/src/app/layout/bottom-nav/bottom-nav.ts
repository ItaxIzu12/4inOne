import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { BRAND } from '../../core/brand/brand.config';
import { IconFinanzen } from '../../shared/ui/icons/icon-finance';
import { IconHaushalt } from '../../shared/ui/icons/icon-household';
import { IconOrganisation } from '../../shared/ui/icons/icon-organization';

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
    { route: `/${BRAND.areas.finance.route}`, label: BRAND.areas.finance.label, accent: 'finance' },
    { route: `/${BRAND.areas.household.route}`, label: BRAND.areas.household.label, accent: 'household' },
    { route: `/${BRAND.areas.organization.route}`, label: BRAND.areas.organization.label, accent: 'organize' },
  ];
}
