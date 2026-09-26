import { AfterViewInit, Component, ElementRef, HostListener, computed, effect, forwardRef, inject, input, model, signal, untracked, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { fieldLabelId } from './label-link';
import { closeOnOutsideScroll, hidePanel, positionPanel, revealPanel, showPanel } from './popover';

export interface SelectOption {
  value: string;
  label: string;
  /** Farbe, die als Punkt vor dem Eintrag steht (z. B. die Farbe einer Kategorie). */
  color?: string | null;
}

let nextId = 0;

/**
 * Dropdown im App-Design. Ersetzt das Browser-`<select>`, weil dessen Einträge keine Farben zeigen können:
 * jeder Eintrag darf einen farbigen Punkt tragen. Bedienung wie ein Combobox-Feld: Tasten ↑ ↓ Pos1 Ende,
 * Enter/Leertaste wählt, Esc schließt, ein Buchstabe springt zum passenden Eintrag.
 *
 *   <app-field label="Kategorie"><app-select formControlName="category" [options]="options()" /></app-field>
 *
 * Mit Reactive Forms (Werte sind Texte) oder ohne: `[(value)]="filter"`.
 */
@Component({
  selector: 'app-select',
  standalone: true,
  templateUrl: './select.html',
  styleUrl: './select.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AppSelect), multi: true }],
})
export class AppSelect implements ControlValueAccessor, AfterViewInit {
  readonly options = input.required<SelectOption[]>();
  readonly placeholder = input('Auswählen …');
  readonly inputId = input<string | null>(null);
  readonly disabledInput = input(false, { alias: 'disabled' });
  readonly value = model('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  protected readonly labelledBy = signal<string | null>(null);
  protected readonly open = signal(false);
  protected readonly active = signal(0);
  private readonly formDisabled = signal(false);
  protected readonly disabled = computed(() => this.formDisabled() || this.disabledInput());
  protected readonly listId = `select-list-${nextId++}`;
  private typed = '';
  private typedTimer?: ReturnType<typeof setTimeout>;
  private unwatchScroll?: () => void;
  private pressedInside = false;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected readonly selected = () => this.options().find((o) => o.value === this.value()) ?? null;

  ngAfterViewInit(): void {
    this.labelledBy.set(fieldLabelId(this.host.nativeElement));
  }

  constructor() {
    effect(() => {
      const open = this.open();
      untracked(() => {
        const panel = this.panel().nativeElement;
        if (open) {
          // erst nach dem Rendern der Einträge platzieren
          queueMicrotask(() => {
            showPanel(panel);
            positionPanel(this.trigger().nativeElement, panel);
            revealPanel(panel);
            this.unwatchScroll = closeOnOutsideScroll(panel, () => this.close(false));
            panel.querySelector<HTMLElement>('.is-active')?.scrollIntoView?.({ block: 'nearest' });
          });
        } else {
          this.unwatchScroll?.();
          this.unwatchScroll = undefined;
          hidePanel(panel);
        }
      });
    });
  }

  protected optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  // ---------- ControlValueAccessor ----------
  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
    if (disabled) this.close(false);
  }

  // ---------- Öffnen / Schließen ----------
  protected toggle(): void {
    if (this.open()) this.close(true);
    else this.openList();
  }

  private openList(): void {
    if (this.disabled()) return;
    const index = this.options().findIndex((o) => o.value === this.value());
    this.active.set(Math.max(index, 0));
    this.open.set(true);
  }

  private close(refocus: boolean): void {
    if (!this.open()) return;
    this.open.set(false);
    this.onTouched();
    if (refocus) this.trigger().nativeElement.focus();
  }

  protected choose(option: SelectOption): void {
    this.value.set(option.value);
    this.onChange(option.value);
    this.close(true);
  }

  /** Klicks im Panel bleiben im Panel. `preventDefault` verhindert, dass ein umgebendes <label> den Auslöser erneut „anklickt“
   * (Standardaktion eines Labels) und das gerade geschlossene Panel sofort wieder öffnet. */
  protected swallow(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  /** Merkt, wo ein Klick begann. Beginnt er im Feld/Panel und endet (durch leichtes Verrutschen) daneben, ist das
   * kein Klick „daneben“ — sonst schließt sich das Fenster, obwohl man es gar nicht verlassen wollte. */
  @HostListener('document:pointerdown', ['$event'])
  protected onPointerDown(event: Event): void {
    this.pressedInside = this.host.nativeElement.contains(event.target as Node);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: Event): void {
    const startedInside = this.pressedInside;
    this.pressedInside = false;
    if (this.open() && !startedInside && !this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }

  @HostListener('window:resize')
  protected onResize(): void {
    if (this.open()) positionPanel(this.trigger().nativeElement, this.panel().nativeElement);
  }

  // ---------- Tastatur ----------
  protected onKeydown(event: KeyboardEvent): void {
    const list = this.options();
    const last = list.length - 1;
    const isOpen = this.open();
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!isOpen) return this.openList();
        this.active.update((i) => Math.min(last, Math.max(0, i + (event.key === 'ArrowDown' ? 1 : -1))));
        return this.reveal();
      }
      case 'Home':
      case 'End':
        if (!isOpen) return;
        event.preventDefault();
        this.active.set(event.key === 'Home' ? 0 : last);
        return this.reveal();
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!isOpen) return this.openList();
        if (list[this.active()]) this.choose(list[this.active()]);
        return;
      case 'Escape':
        if (isOpen) {
          // schließt nur das Dropdown, nicht den umgebenden Dialog
          event.stopPropagation();
          this.close(true);
        }
        return;
      case 'Tab':
        this.close(false);
        return;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) this.typeahead(event.key);
    }
  }

  private typeahead(char: string): void {
    clearTimeout(this.typedTimer);
    this.typed += char.toLocaleLowerCase('de');
    this.typedTimer = setTimeout(() => (this.typed = ''), 700);
    const list = this.options();
    const found = list.findIndex((o) => o.label.toLocaleLowerCase('de').startsWith(this.typed));
    if (found < 0) return;
    if (!this.open()) this.openList();
    this.active.set(found);
    this.reveal();
  }

  private reveal(): void {
    queueMicrotask(() => this.panel().nativeElement.querySelector<HTMLElement>('.is-active')?.scrollIntoView?.({ block: 'nearest' }));
  }
}
