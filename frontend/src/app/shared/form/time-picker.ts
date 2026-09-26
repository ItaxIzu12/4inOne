import { AfterViewInit, Component, ElementRef, HostListener, computed, effect, forwardRef, inject, input, model, signal, untracked, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { fieldLabel } from './label-link';
import { closeOnOutsideScroll, hidePanel, positionPanel, revealPanel, showPanel } from './popover';

type Group = 'hour' | 'minute';

const pad = (n: number) => String(n).padStart(2, '0');
let nextId = 0;

/**
 * Uhrzeitauswahl im App-Design (statt des Browser-Feldes). Wert wie beim nativen Feld: `HH:MM`
 * (`HH:MM:SS` aus der API wird akzeptiert). Erst die Stunde, dann die Minute (5er-Schritte); mit der Minute
 * schließt sich das Fenster. Tasten: Pfeile bewegen, Pos1/Ende springen, Enter/Leertaste wählt, Esc schließt.
 */
@Component({
  selector: 'app-time-picker',
  standalone: true,
  templateUrl: './time-picker.html',
  styleUrl: './time-picker.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AppTimePicker), multi: true }],
})
export class AppTimePicker implements ControlValueAccessor, AfterViewInit {
  readonly value = model('');
  readonly clearable = input(false);
  readonly placeholder = input('');
  readonly inputId = input<string | null>(null);
  readonly disabledInput = input(false, { alias: 'disabled' });
  readonly partLabel = input('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  protected readonly labelledBy = signal<string | null>(null);
  protected readonly ariaLabel = signal<string | null>(null);
  protected readonly open = signal(false);
  private readonly formDisabled = signal(false);
  protected readonly disabled = computed(() => this.formDisabled() || this.disabledInput());
  protected readonly hourFocus = signal(8);
  protected readonly minuteFocus = signal(0);
  protected readonly hours = Array.from({ length: 24 }, (_, i) => i);
  protected readonly minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  protected readonly titleId = `time-picker-${nextId++}`;

  private unwatchScroll?: () => void;
  private pressedInside = false;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  /** Stunde/Minute des Wertes; null, wenn leer oder ungültig. */
  protected readonly parts = computed(() => {
    const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(this.value() ?? '');
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    return h < 24 && m < 60 ? { h, m } : null;
  });
  protected readonly text = computed(() => {
    const p = this.parts();
    return p ? `${pad(p.h)}:${pad(p.m)}` : '';
  });

  ngAfterViewInit(): void {
    const label = fieldLabel(this.host.nativeElement);
    if (label && this.partLabel()) this.ariaLabel.set(`${label.text} – ${this.partLabel()}`);
    else this.labelledBy.set(label?.id ?? null);
  }

  constructor() {
    effect(() => {
      const open = this.open();
      untracked(() => {
        const panel = this.panel().nativeElement;
        if (open) {
          queueMicrotask(() => {
            showPanel(panel);
            positionPanel(this.trigger().nativeElement, panel, 264, false);
            revealPanel(panel);
            this.unwatchScroll = closeOnOutsideScroll(panel, () => this.close(false));
            this.focusCell('hour');
          });
        } else {
          this.unwatchScroll?.();
          this.unwatchScroll = undefined;
          hidePanel(panel);
        }
      });
    });
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
    if (this.open()) return this.close(true);
    if (this.disabled()) return;
    const p = this.parts();
    this.hourFocus.set(p ? p.h : 8);
    this.minuteFocus.set(p ? p.m - (p.m % 5) : 0);
    this.open.set(true);
  }

  protected close(refocus: boolean): void {
    if (!this.open()) return;
    this.open.set(false);
    this.onTouched();
    if (refocus) this.trigger().nativeElement.focus();
  }

  private commit(hour: number, minute: number): void {
    const value = `${pad(hour)}:${pad(minute)}`;
    this.value.set(value);
    this.onChange(value);
  }

  protected pickHour(hour: number): void {
    this.hourFocus.set(hour);
    this.commit(hour, this.parts()?.m ?? 0);
    this.focusCell('minute'); // weiter mit der Minute
  }

  protected pickMinute(minute: number): void {
    this.commit(this.parts()?.h ?? this.hourFocus(), minute);
    this.close(true);
  }

  protected clear(): void {
    this.value.set('');
    this.onChange('');
    this.close(true);
  }

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
    if (this.open()) positionPanel(this.trigger().nativeElement, this.panel().nativeElement, 264, false);
  }

  // ---------- Tastatur ----------
  protected onKeydown(event: KeyboardEvent, group: Group): void {
    const isHour = group === 'hour';
    const focus = isHour ? this.hourFocus : this.minuteFocus;
    const step = isHour ? 1 : 5;
    const last = isHour ? 23 : 55;
    const per = isHour ? 6 : 30; // eine Zeile
    let next: number;
    switch (event.key) {
      case 'ArrowLeft': next = focus() - step; break;
      case 'ArrowRight': next = focus() + step; break;
      case 'ArrowUp': next = focus() - per; break;
      case 'ArrowDown': next = focus() + per; break;
      case 'Home': next = 0; break;
      case 'End': next = last; break;
      case 'Escape':
        event.stopPropagation(); // schließt nur die Auswahl, nicht den umgebenden Dialog
        this.close(true);
        return;
      case 'Tab':
        event.preventDefault();
        this.close(true);
        return;
      default:
        return;
    }
    event.preventDefault();
    // Am Rand des Rasters bleibt der Fokus stehen, statt ans andere Ende zu springen.
    if (next >= 0 && next <= last) focus.set(next);
    this.focusCell(group);
  }

  @HostListener('keydown', ['$event'])
  protected onHostKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.open()) {
      event.stopPropagation();
      this.close(true);
    }
  }

  private focusCell(group: Group): void {
    setTimeout(() => this.panel().nativeElement.querySelector<HTMLElement>(`[data-group="${group}"][data-focus="true"]`)?.focus());
  }
}
