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
    { key: 'vorteile', label: 'Vorteile', href: '#vorteile' },
    { key: 'warum', label: 'Warum?', href: '#warum' },
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
