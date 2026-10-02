import { Directive, ElementRef, OnDestroy, inject } from '@angular/core';

/** Guards user-entered money without silently turning e.g. "1e3" into "13".
 * Capture listeners run before Angular form accessors and template handlers.
 * Precision, ranges and required values remain the responsibility of validators.
 */
@Directive({ selector: 'input[inputmode="decimal"]', standalone: true })
export class AmountInput implements OnDestroy {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private previous = '';
  private readonly valid = (value: string) => /^\d*(?:[.,]\d*)?$/.test(value);
  private remember = () => {
    if (this.valid(this.input.value)) this.previous = this.input.value;
  };
  private beforeInput = (event: Event) => {
    this.remember();
    const data = (event as InputEvent).data;
    if (data && /[^\d.,]/.test(data)) event.preventDefault();
  };
  private paste = (event: ClipboardEvent) => {
    this.remember();
    const text = event.clipboardData?.getData('text');
    if (text && !this.valid(text)) event.preventDefault();
  };
  private keydown = (event: KeyboardEvent) => {
    // Native number inputs otherwise accept scientific notation and signs.
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1 && /[^\d.,]/.test(event.key)) {
      event.preventDefault();
    }
  };
  private onInput = () => {
    if (!this.valid(this.input.value)) this.input.value = this.previous;
    else this.previous = this.input.value;
  };
  constructor() {
    this.input.addEventListener('focus', this.remember);
    this.input.addEventListener('beforeinput', this.beforeInput, true);
    this.input.addEventListener('paste', this.paste, true);
    this.input.addEventListener('keydown', this.keydown, true);
    this.input.addEventListener('input', this.onInput, true);
  }
  ngOnDestroy() {
    this.input.removeEventListener('focus', this.remember);
    this.input.removeEventListener('beforeinput', this.beforeInput, true);
    this.input.removeEventListener('paste', this.paste, true);
    this.input.removeEventListener('keydown', this.keydown, true);
    this.input.removeEventListener('input', this.onInput, true);
  }
}
