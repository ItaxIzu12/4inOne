import { Component, DestroyRef, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { closeOnOutsideScroll, hidePanel, positionPanel, revealPanel, showPanel } from '../../shared/form/popover';

export interface RowMenuItem {
  key: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
  danger?: boolean;
}

/**
 * „…“-Knopf mit kleinem Aktionsmenü für Zeilen der Haushalt-Reiter (Routinen,
 * Verträge, Einkaufslisten). Das Panel liegt per Popover-API in der Top Layer
 * (shared/form/popover.ts) und wird weder von Tabellen noch von Karten
 * abgeschnitten. Pfeiltasten wandern durch die Einträge, Escape schließt und
 * gibt den Fokus an den Knopf zurück.
 */
@Component({
  selector: 'app-row-menu',
  standalone: true,
  imports: [AppIcon],
  template: `
    <button
      #trigger
      type="button"
      class="trigger"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="label()"
      (click)="toggle()"
    >
      <app-icon name="more" />
    </button>
    <div
      #panel
      class="panel"
      popover="manual"
      role="menu"
      [attr.aria-label]="label()"
      [hidden]="!open()"
      (keydown)="onKeydown($event)"
      (focusout)="onFocusOut($event)"
    >
      @for (item of items(); track item.key) {
        <button
          type="button"
          role="menuitem"
          class="item"
          [class.item--danger]="item.danger"
          [disabled]="item.disabled"
          (click)="choose(item)"
        >
          @if (item.icon) {
            <app-icon [name]="item.icon" />
          }
          {{ item.label }}
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .trigger {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border: 0;
      border-radius: 10px;
      background: none;
      color: var(--text-muted);
      cursor: pointer;
    }
    .trigger:hover,
    .trigger[aria-expanded='true'] {
      background: var(--surface-muted, #f3f4f6);
      color: var(--text);
    }
    .trigger app-icon {
      width: 20px;
      height: 20px;
    }
    .panel {
      position: fixed;
      inset: auto;
      margin: 0;
      min-width: 200px;
      padding: 6px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--surface);
      box-shadow: 0 12px 32px #1a1d2b24;
      color: var(--text);
    }
    .panel[hidden] {
      display: none;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      min-height: 40px;
      padding: 8px 12px;
      border: 0;
      border-radius: 10px;
      background: none;
      color: inherit;
      font: inherit;
      font-size: 14px;
      text-align: left;
      cursor: pointer;
    }
    .item:hover:not(:disabled),
    .item:focus-visible {
      background: var(--accent-soft);
      outline: none;
    }
    .item:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .item app-icon {
      width: 18px;
      height: 18px;
      color: var(--text-muted);
    }
    .item--danger,
    .item--danger app-icon {
      color: var(--danger);
    }
    .trigger:focus-visible {
      outline: 3px solid var(--accent);
      outline-offset: 2px;
    }
  `,
})
export class RowMenu {
  readonly items = input.required<RowMenuItem[]>();
  /** Zugänglicher Name, z. B. „Aktionen für Waschmaschine“. */
  readonly label = input.required<string>();
  readonly selected = output<string>();

  protected readonly open = signal(false);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private stopScrollWatch: (() => void) | null = null;

  constructor() {
    const onDocClick = (event: MouseEvent) => {
      if (!this.open()) return;
      const target = event.target as Node;
      if (this.trigger().nativeElement.contains(target) || this.panel().nativeElement.contains(target)) return;
      this.close(false);
    };
    document.addEventListener('click', onDocClick, true);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('click', onDocClick, true);
      this.stopScrollWatch?.();
    });
  }

  protected toggle(): void {
    if (this.open()) this.close(true);
    else this.show();
  }

  private show(): void {
    const panel = this.panel().nativeElement;
    this.open.set(true);
    // Erst sichtbar machen, dann messen und platzieren.
    queueMicrotask(() => {
      panel.hidden = false;
      showPanel(panel);
      positionPanel(this.trigger().nativeElement, panel, 200);
      revealPanel(panel);
      this.items$()[0]?.focus();
      this.stopScrollWatch = closeOnOutsideScroll(panel, () => this.close(false));
    });
  }

  private close(focusTrigger: boolean): void {
    this.open.set(false);
    hidePanel(this.panel().nativeElement);
    this.stopScrollWatch?.();
    this.stopScrollWatch = null;
    if (focusTrigger) this.trigger().nativeElement.focus();
  }

  protected choose(item: RowMenuItem): void {
    if (item.disabled) return;
    this.close(true);
    this.selected.emit(item.key);
  }

  private items$(): HTMLButtonElement[] {
    return Array.from(this.panel().nativeElement.querySelectorAll<HTMLButtonElement>('.item:not(:disabled)'));
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close(true);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const items = this.items$();
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? (index + 1) % items.length
      : (index - 1 + items.length) % items.length;
    items[next].focus();
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && (this.panel().nativeElement.contains(next) || this.trigger().nativeElement.contains(next))) return;
    if (next) this.close(false);
  }
}
