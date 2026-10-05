import { Component, input, output } from '@angular/core';
import { AppIcon, IconName } from '../icons/app-icon';

/**
 * Hauptaktion eines Bereichs auf dem Handy: ein fester Knopf unten über der Navigationsleiste, mit Daumen erreichbar
 * und mit Text („Neue Reise“, „Ausgabe erfassen“ …). Am Rechner unsichtbar — dort steht derselbe Knopf oben im Kopf.
 *
 * Ein Platzhalter im Seitenfluss sorgt dafür, dass der Knopf nie den letzten Inhalt verdeckt. Offene Dialoge und
 * Blätter von unten blenden ihn aus (globale Regel in styles.css). Die Farbe kommt aus `--accent` des Bereichs.
 */
@Component({
  selector: 'app-mobile-action',
  imports: [AppIcon],
  template: `
    <div class="mobile-action-spacer" aria-hidden="true"></div>
    <div class="mobile-action">
      <button type="button" class="mobile-action__btn" (click)="pressed.emit()">
        <app-icon [name]="icon()" aria-hidden="true" />{{ label() }}
      </button>
    </div>
  `,
  styles: `
    :host {
      display: none;
    }
    @media (max-width: 760px) {
      :host {
        display: block;
      }
      .mobile-action-spacer {
        height: 72px;
      }
      .mobile-action {
        position: fixed;
        right: 16px;
        bottom: calc(80px + env(safe-area-inset-bottom, 0px));
        left: 16px;
        z-index: 40;
      }
      .mobile-action__btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        min-height: 50px;
        padding: 0 18px;
        border: 0;
        border-radius: 14px;
        background: var(--accent, #2563eb);
        box-shadow: 0 8px 24px color-mix(in srgb, var(--accent, #2563eb) 35%, transparent);
        color: #fff;
        font: inherit;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
      }
      .mobile-action__btn:active {
        transform: translateY(1px);
      }
      .mobile-action__btn:focus-visible {
        outline: 3px solid #16233a;
        outline-offset: 3px;
      }
      .mobile-action__btn app-icon {
        width: 20px;
        height: 20px;
      }
    }
  `,
})
export class MobileAction {
  readonly label = input.required<string>();
  readonly icon = input<IconName>('plus');
  readonly pressed = output<void>();
}
