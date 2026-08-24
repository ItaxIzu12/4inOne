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
  protected readonly items: NavItem[] = [
    { route: '/', label: 'Start' },
    { route: '/finanzen', label: 'Finanzen', accent: 'finance' },
    { route: '/haushalt', label: 'Haushalt', accent: 'household' },
    { route: '/organisation', label: 'Organisation', accent: 'organize' },
  ];
}
