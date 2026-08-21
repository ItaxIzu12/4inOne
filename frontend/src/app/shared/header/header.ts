import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/theme/theme.service';
import { ScrollService } from '../../core/scroll/scroll.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  protected readonly theme = inject(ThemeService);
  private readonly scroll = inject(ScrollService);
  protected readonly menuOpen = signal(false);

  protected readonly sections = [
    { key: 'finance', label: 'Finanzen', href: '#finanzen' },
    { key: 'household', label: 'Haushalt', href: '#haushalt' },
    { key: 'organize', label: 'Organisation', href: '#organisation' },
  ];

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected goHome(): void {
    this.closeMenu();
    this.scroll.toTop();
  }
}
