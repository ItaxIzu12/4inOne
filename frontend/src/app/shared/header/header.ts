import { Component, inject } from '@angular/core';
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

  protected goHome(): void {
    this.scroll.toTop();
  }
}
