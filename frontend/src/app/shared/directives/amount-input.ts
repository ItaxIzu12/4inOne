import { Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import { formatMoneyInput, normalizeMoneyInput } from '../currency/money-input';

/** Betragsfelder (`input[inputmode="decimal"]`): nur Ziffern, Punkt und Komma — Tausenderpunkte erlaubt („1.500,50“).
 * Beim Verlassen wird der Betrag lesbar formatiert („250000“ → „250.000“); Eingefügtes wie „700 €“ wird bereinigt
 * übernommen statt still verworfen. Was gültig ist, entscheidet `normalizeMoneyInput` (shared/currency/money-input.ts);
 * Pflicht, Grenzen und „größer als 0“ bleiben Sache der Validierung im Formular.
 * Capture-Listener laufen vor Angulars Form-Accessors und Template-Handlern. */
@Directive({ selector: 'input[inputmode="decimal"]', standalone: true })
export class AmountInput implements OnDestroy {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private previous = '';
  /** Während des Tippens: Ziffern, Punkte als Gruppierung, höchstens ein Komma — Zwischenstände wie „1.“ sind erlaubt. */
  private readonly valid = (value: string) => /^\d*(?:\.\d*)*(?:,\d*)?$/.test(value);
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
    const text = event.clipboardData?.getData('text') ?? '';
    if (this.valid(text)) return;
    event.preventDefault();
    // „700 €“ oder „2 000,50 EUR“: bereinigt übernehmen, wenn eindeutig lesbar — sonst nichts einfügen.
    if (normalizeMoneyInput(text) !== null) this.write(formatMoneyInput(text));
  };
  private keydown = (event: KeyboardEvent) => {
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1 && /[^\d.,]/.test(event.key)) {
      event.preventDefault();
    }
  };
  private onInput = () => {
    if (!this.valid(this.input.value)) this.input.value = this.previous;
    else this.previous = this.input.value;
  };
  private blur = () => {
    const formatted = formatMoneyInput(this.input.value);
    if (formatted !== this.input.value) this.write(formatted);
  };
  private write(value: string): void {
    this.input.value = value;
    this.previous = value;
    // Formulare und (input)-Handler sollen den neuen Wert mitbekommen.
    this.input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  constructor() {
    this.input.addEventListener('focus', this.remember);
    this.input.addEventListener('blur', this.blur);
    this.input.addEventListener('beforeinput', this.beforeInput, true);
    this.input.addEventListener('paste', this.paste, true);
    this.input.addEventListener('keydown', this.keydown, true);
    this.input.addEventListener('input', this.onInput, true);
  }
  ngOnDestroy() {
    this.input.removeEventListener('focus', this.remember);
    this.input.removeEventListener('blur', this.blur);
    this.input.removeEventListener('beforeinput', this.beforeInput, true);
    this.input.removeEventListener('paste', this.paste, true);
    this.input.removeEventListener('keydown', this.keydown, true);
    this.input.removeEventListener('input', this.onInput, true);
  }
}
