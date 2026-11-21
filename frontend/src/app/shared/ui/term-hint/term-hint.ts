import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, input, signal } from '@angular/core';
import { AppIcon } from '../icons/app-icon';

/**
 * Begriff erklären, wo er steht: ein kleines (i) neben dem Wort, das per Tippen/Klick einen Satz aufklappt
 * (Toggletip, kein Hover-Tooltip — funktioniert am Handy und mit Tastatur). Escape oder ein Klick daneben schließt.
 *
 *   Geplant <app-term-hint term="Geplant" text="Ausgaben mit Datum nach heute …" />
 *
 * Der Knopf heißt „Was bedeutet „Geplant“?“; der Text wird als Statusmeldung angesagt, sobald er erscheint.
 * Optisch 18 px, Klickfläche 44 px (unsichtbares ::before).
 */
@Component({
  selector: 'app-term-hint',
  standalone: true,
  imports: [AppIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="hint-btn"
      [attr.aria-label]="'Was bedeutet „' + term() + '“?'"
      [attr.aria-expanded]="open()"
      (click)="toggle($event)"
    >
      <app-icon name="info" aria-hidden="true" />
    </button>
    <span class="bubble" role="status">
      @if (open()) {
        <span class="bubble__text" [style.margin-left.px]="shift()"><b>{{ term() }}:</b> {{ text() }}</span>
      }
    </span>
  `,
  styles: `
    :host {
      position: relative;
      display: inline-flex;
      vertical-align: middle;
    }
    .hint-btn {
      position: relative;
      display: inline-grid;
      place-items: center;
      width: 18px;
      height: 18px;
      margin-left: 4px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--text-secondary, #52615b);
      cursor: pointer;
    }
    .hint-btn::before {
      content: '';
      position: absolute;
      inset: -13px;
    }
    .hint-btn app-icon {
      width: 16px;
      height: 16px;
    }
    .hint-btn[aria-expanded='true'] {
      color: var(--text-primary, #172523);
    }
    .hint-btn:focus-visible {
      outline: 2px solid var(--brand-primary, #172523);
      outline-offset: 2px;
    }
    .bubble__text {
      position: absolute;
      top: calc(100% + 8px);
      left: -12px; /* links am (i) ausgerichtet: steht der Begriff am linken Rand, ragt nichts aus dem Bild */
      z-index: 20;
      width: max-content;
      max-width: min(280px, calc(100vw - 48px));
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--text-primary, #172523);
      color: #fff;
      font-size: 13px;
      font-weight: 400;
      line-height: 1.45;
      letter-spacing: 0;
      text-align: left;
      white-space: normal;
      box-shadow: 0 8px 24px -12px rgb(23 37 35 / 0.45);
    }
    .bubble__text b {
      font-weight: 600;
    }
  `,
})
export class TermHint {
  readonly term = input.required<string>();
  readonly text = input.required<string>();
  readonly open = signal(false);
  /** Verschiebung in px, damit die Blase ganz im Bild bleibt (16 px Abstand zum Rand) — beim Öffnen gemessen. */
  readonly shift = signal(0);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  toggle(event: Event): void {
    event.stopPropagation(); // nicht das Element darunter auslösen (z. B. eine Zeile)
    this.shift.set(0);
    this.open.update((v) => !v);
    if (this.open()) {
      setTimeout(() => {
        const bubble = this.host.nativeElement.querySelector<HTMLElement>('.bubble__text');
        if (!bubble) return;
        const box = bubble.getBoundingClientRect();
        const room = document.documentElement.clientWidth - 16;
        if (box.right > room) this.shift.set(Math.round(room - box.right));
        else if (box.left < 16) this.shift.set(Math.round(16 - box.left));
      });
    }
  }
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open.set(false);
  }
}
