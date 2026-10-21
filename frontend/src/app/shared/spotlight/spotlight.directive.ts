import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Lichtkegel, der dem Mauszeiger über einem Element folgt (Muster „Magic Card“ aus Magic UI, nach Angular übertragen).
 * Setzt nur CSS-Variablen — das Aussehen bestimmt das Element selbst:
 *   --spot-x, --spot-y  Position relativ zum Element (px)
 *   --spot-o            0 oder 1 (sichtbar)
 * Nur mit Maus: auf Touch-Geräten gibt es keinen Zeiger, der Effekt bleibt aus. Kein Einfluss auf Bedienung oder Inhalt.
 */
@Directive({
  selector: '[appSpotlight]',
  standalone: true,
  host: {
    '(pointermove)': 'move($event)',
    '(pointerleave)': 'leave()',
  },
})
export class Spotlight {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  move(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;
    const host = this.el.nativeElement;
    const rect = host.getBoundingClientRect();
    host.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
    host.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
    host.style.setProperty('--spot-o', '1');
  }

  leave(): void {
    this.el.nativeElement.style.setProperty('--spot-o', '0');
  }
}
