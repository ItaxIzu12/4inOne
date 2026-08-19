import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  route: string;
  label: string;
  accent?: 'fitness' | 'finance' | 'organize' | 'household';
}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.css',
})
export class BottomNav {
  protected readonly items: NavItem[] = [
    { route: '/', label: 'Start' },
    { route: '/fitness', label: 'Fitness', accent: 'fitness' },
    { route: '/finanzen', label: 'Finanzen', accent: 'finance' },
    { route: '/organisation', label: 'Organisation', accent: 'organize' },
    { route: '/haushalt', label: 'Haushalt', accent: 'household' },
  ];
}
