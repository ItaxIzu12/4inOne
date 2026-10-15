import { afterNextRender, Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';

/**
 * Startseite › „Was zusammengehört, bleibt zusammen“: Eine Karte, vier Felder. Dieselbe Karte aus der App steht in
 * vier Farbfeldern (die vier Farben des Zeichens), jedes Mal einen Schritt weiter — Sparziel öffnen, Art wählen,
 * Eintrag suchen, verknüpft. Beschriftungen wie in der App („Verknüpft mit“, „Was möchtest du verbinden?“,
 * „Gerät auswählen“, „Verknüpfung bestätigen“). Ein Beispiel ohne Daten; nichts wird gespeichert.
 *
 * Am Rechner stehen die Felder nebeneinander, am Tablet 2 × 2, am Handy untereinander.
 */
@Component({
  selector: 'app-link-steps',
  standalone: true,
  imports: [AppIcon],
  templateUrl: './link-steps.html',
  styleUrl: './link-steps.scss',
})
export class LinkSteps {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.host.nativeElement;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') return;
      // Ohne Bewegung (oder ohne JS) stehen die Felder sofort da. Sonst gehen sie nacheinander auf, wie das Zeichen
      // im Hero — sobald der Anfang der Reihe im Bild ist (Schwelle 0, auch wenn die Reihe am Handy hoch ist).
      el.classList.add('motion-ready');
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          el.classList.add('is-in');
          observer.disconnect();
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0 },
      );
      observer.observe(el);
      destroy.onDestroy(() => observer.disconnect());
    });
  }
}
