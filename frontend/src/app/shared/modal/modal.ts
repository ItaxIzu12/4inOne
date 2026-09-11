import { Component, ElementRef, DestroyRef, effect, inject, input, output, viewChild } from '@angular/core';
import { IconClose } from '../icons/icon-close';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Generische Modal-Basis (Backdrop, Fokus-Falle, Escape-Handling,
 * Body-Scroll-Sperre) — EINZIGER Ort für dieses Verhalten im Projekt, damit
 * künftige Dialoge (z. B. das Transaktions-Modal in features/finanzen)
 * dieselbe Komponente wiederverwenden statt eine eigene, später
 * auseinanderlaufende Implementierung zu bekommen.
 *
 * Der Inhalt (inkl. der Überschrift, auf die `labelledBy` zeigt) wird per
 * Content-Projection eingesetzt — die Komponente selbst kennt den Inhalt
 * nicht, nur das Rahmenverhalten.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [IconClose],
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal {
  readonly open = input.required<boolean>();
  readonly labelledBy = input.required<string>();
  readonly closeLabel = input('Schließen');
  readonly closed = output<void>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private previouslyFocused: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.previouslyFocused = document.activeElement as HTMLElement | null;
        // afterNextRender wäre hier eleganter, aber die Komponente muss
        // erst @if(open()) neu rendern (Zero-Frame-Verzögerung nötig) —
        // ein Mikrotask reicht dafür zuverlässig aus.
        queueMicrotask(() => this.focusFirstElement());
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
        this.previouslyFocused?.focus();
      }
    });

    inject(DestroyRef).onDestroy(() => {
      document.body.style.overflow = '';
    });
  }

  private focusableElements(): HTMLElement[] {
    const panelEl = this.panel()?.nativeElement;
    if (!panelEl) return [];
    return Array.from(panelEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }

  private focusFirstElement(): void {
    const [first] = this.focusableElements();
    first?.focus();
  }

  protected requestClose(): void {
    this.closed.emit();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.requestClose();
      return;
    }

    if (event.key !== 'Tab') return;

    // Fokus-Falle: Tab am letzten Element springt zum ersten (und
    // umgekehrt bei Shift+Tab am ersten), damit der Fokus nie in den
    // Hintergrund der Seite entkommt.
    const elements = this.focusableElements();
    if (elements.length === 0) return;

    const first = elements[0];
    const last = elements[elements.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
