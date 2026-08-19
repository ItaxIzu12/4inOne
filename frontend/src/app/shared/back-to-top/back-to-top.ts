import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ScrollService } from '../../core/scroll/scroll.service';

const VISIBILITY_THRESHOLD = 480;

@Component({
  selector: 'app-back-to-top',
  standalone: true,
  templateUrl: './back-to-top.html',
  styleUrl: './back-to-top.css',
})
export class BackToTop {
  private readonly scroll = inject(ScrollService);
  protected readonly visible = signal(false);

  constructor() {
    const onScroll = () => this.visible.set(window.scrollY > VISIBILITY_THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    inject(DestroyRef).onDestroy(() => window.removeEventListener('scroll', onScroll));
  }

  protected scrollToTop(): void {
    this.scroll.toTop();
  }
}
