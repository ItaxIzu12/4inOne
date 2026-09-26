import { AfterViewInit, Component, ElementRef, HostListener, computed, effect, forwardRef, inject, input, model, signal, untracked, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MONTH_NAMES, MONTH_SHORT, WEEKDAYS, addDays, addMonths, daysInMonth, display, parse, todayIso, toDate, toMonth, weekdayMon0 } from './date-utils';
import { fieldLabel } from './label-link';
import { closeOnOutsideScroll, hidePanel, positionPanel, revealPanel, showPanel } from './popover';

type Mode = 'month' | 'date';

interface Cell {
  iso: string;
  label: string;
  aria: string;
  disabled: boolean;
  selected: boolean;
  today: boolean;
  outside: boolean;
}

/**
 * Monats- oder Datumsauswahl im App-Design (statt des Browser-Feldes, das je Browser anders aussieht).
 * Werte sind Texte wie bei den nativen Feldern: Monat `JJJJ-MM`, Datum `JJJJ-MM-TT`.
 *
 *   <app-field label="Datum"><app-date-picker mode="date" formControlName="date" /></app-field>
 *   <app-date-picker mode="month" [(value)]="month" />
 *
 * Tasten im geöffneten Kalender: Pfeile bewegen, Bild ↑/↓ wechselt den Monat bzw. das Jahr (mit Umschalt: Jahr),
 * Pos1/Ende springen an Wochen-/Zeilenrand, Enter oder Leertaste wählt, Esc schließt.
 */
@Component({
  selector: 'app-date-picker',
  standalone: true,
  templateUrl: './date-picker.html',
  styleUrl: './date-picker.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AppDatePicker), multi: true }],
})
export class AppDatePicker implements ControlValueAccessor, AfterViewInit {
  readonly mode = input<Mode>('date');
  readonly value = model('');
  /** Früheste/späteste wählbare Angabe im selben Format wie `value`. */
  readonly min = input('');
  readonly max = input('');
  readonly placeholder = input('');
  readonly inputId = input<string | null>(null);
  /** Zeigt „Entfernen“, damit ein optionales Feld wieder leer werden kann. */
  readonly clearable = input(false);
  /** Für die signalbasierten Formulare (ohne Reactive Forms): sperrt das Feld. */
  readonly disabledInput = input(false, { alias: 'disabled' });
  /** Bei Feldern aus mehreren Teilen: Name des Teils („Datum“), wird an die Feldbeschriftung gehängt. */
  readonly partLabel = input('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  protected readonly labelledBy = signal<string | null>(null);
  protected readonly ariaLabel = signal<string | null>(null);
  protected readonly open = signal(false);
  private readonly formDisabled = signal(false);
  protected readonly disabled = computed(() => this.formDisabled() || this.disabledInput());
  /** Angezeigtes Jahr und (im Datumsmodus) Monat, unabhängig vom gewählten Wert. */
  protected readonly viewYear = signal(new Date().getFullYear());
  protected readonly viewMonth0 = signal(new Date().getMonth());
  /** Die Zelle, die per Tab erreichbar ist und beim Öffnen den Fokus bekommt. */
  protected readonly focusIso = signal('');
  protected readonly weekdays = WEEKDAYS;
  protected readonly titleId = `date-picker-title-${nextId++}`;

  private unwatchScroll?: () => void;
  private pressedInside = false;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected readonly text = () => display(this.value(), this.mode());

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
            positionPanel(this.trigger().nativeElement, panel, 288, false);
            revealPanel(panel);
            this.unwatchScroll = closeOnOutsideScroll(panel, () => this.close(false));
            this.focusCell();
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
    const start = parse(this.value()) ?? parse(this.clampToday())!;
    this.viewYear.set(start.year);
    this.viewMonth0.set(start.month0);
    this.focusIso.set(this.mode() === 'month' ? toMonth(start.year, start.month0) : toDate(start.year, start.month0, start.day));
    this.open.set(true);
  }

  private clampToday(): string {
    const today = todayIso();
    const value = this.mode() === 'month' ? today.slice(0, 7) : today;
    return this.clamp(value);
  }

  protected close(refocus: boolean): void {
    if (!this.open()) return;
    this.open.set(false);
    this.onTouched();
    if (refocus) this.trigger().nativeElement.focus();
  }

  protected clear(): void {
    this.value.set('');
    this.onChange('');
    this.close(true);
  }

  protected pick(cell: Cell): void {
    if (cell.disabled) return;
    this.value.set(cell.iso);
    this.onChange(cell.iso);
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
    if (this.open()) positionPanel(this.trigger().nativeElement, this.panel().nativeElement, 288, false);
  }

  // ---------- Inhalt ----------
  protected readonly title = () =>
    this.mode() === 'month' ? String(this.viewYear()) : `${MONTH_NAMES[this.viewMonth0()]} ${this.viewYear()}`;

  protected months(): Cell[] {
    const year = this.viewYear();
    const selected = this.value();
    const thisMonth = todayIso().slice(0, 7);
    return MONTH_SHORT.map((label, month0) => {
      const iso = toMonth(year, month0);
      return { iso, label, aria: `${MONTH_NAMES[month0]} ${year}`, disabled: !this.allowed(iso), selected: iso === selected, today: iso === thisMonth, outside: false };
    });
  }

  protected days(): Cell[] {
    const year = this.viewYear();
    const month0 = this.viewMonth0();
    const lead = weekdayMon0(year, month0, 1);
    const selected = this.value();
    const today = todayIso();
    return Array.from({ length: 42 }, (_, i) => {
      const iso = toDate(year, month0, i - lead + 1);
      const p = parse(iso)!;
      return {
        iso,
        label: String(p.day),
        aria: `${p.day}. ${MONTH_NAMES[p.month0]} ${p.year}`,
        disabled: !this.allowed(iso),
        selected: iso === selected,
        today: iso === today,
        outside: p.month0 !== month0,
      };
    });
  }

  private allowed(iso: string): boolean {
    return (!this.min() || iso >= this.min()) && (!this.max() || iso <= this.max());
  }

  private clamp(iso: string): string {
    if (this.min() && iso < this.min()) return this.min();
    if (this.max() && iso > this.max()) return this.max();
    return iso;
  }

  // ---------- Navigation ----------
  protected shiftYear(delta: number): void {
    this.viewYear.update((y) => y + delta);
    this.syncFocusToView();
  }

  protected shiftMonth(delta: number): void {
    const target = toMonth(this.viewYear(), this.viewMonth0() + delta);
    const p = parse(target)!;
    this.viewYear.set(p.year);
    this.viewMonth0.set(p.month0);
    this.syncFocusToView();
  }

  /** Nach Blättern zeigt die Fokuszelle auf denselben Tag bzw. Monat in der neuen Ansicht. */
  private syncFocusToView(): void {
    const current = parse(this.focusIso()) ?? { year: this.viewYear(), month0: this.viewMonth0(), day: 1 };
    if (this.mode() === 'month') {
      this.focusIso.set(this.clamp(toMonth(this.viewYear(), current.month0)));
    } else {
      const day = Math.min(current.day, daysInMonth(this.viewYear(), this.viewMonth0()));
      this.focusIso.set(this.clamp(toDate(this.viewYear(), this.viewMonth0(), day)));
    }
  }

  protected onGridKeydown(event: KeyboardEvent): void {
    const isMonth = this.mode() === 'month';
    const current = this.focusIso();
    let next: string | null = null;
    switch (event.key) {
      case 'ArrowLeft': next = isMonth ? addMonths(current + '-01', -1).slice(0, 7) : addDays(current, -1); break;
      case 'ArrowRight': next = isMonth ? addMonths(current + '-01', 1).slice(0, 7) : addDays(current, 1); break;
      case 'ArrowUp': next = isMonth ? addMonths(current + '-01', -3).slice(0, 7) : addDays(current, -7); break;
      case 'ArrowDown': next = isMonth ? addMonths(current + '-01', 3).slice(0, 7) : addDays(current, 7); break;
      case 'PageUp': next = isMonth || event.shiftKey ? this.moveYears(current, -1) : addMonths(current, -1); break;
      case 'PageDown': next = isMonth || event.shiftKey ? this.moveYears(current, 1) : addMonths(current, 1); break;
      case 'Home': next = isMonth ? toMonth(parse(current)!.year, Math.floor(parse(current)!.month0 / 3) * 3) : addDays(current, -weekdayMon0(...this.ymd(current))); break;
      case 'End': next = isMonth ? toMonth(parse(current)!.year, Math.floor(parse(current)!.month0 / 3) * 3 + 2) : addDays(current, 6 - weekdayMon0(...this.ymd(current))); break;
      case 'Escape':
        event.stopPropagation(); // schließt nur den Kalender, nicht den umgebenden Dialog
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
    this.moveFocusTo(this.clamp(next));
  }

  private ymd(iso: string): [number, number, number] {
    const p = parse(iso)!;
    return [p.year, p.month0, p.day];
  }

  private moveYears(iso: string, years: number): string {
    return this.mode() === 'month' ? addMonths(iso + '-01', years * 12).slice(0, 7) : addMonths(iso, years * 12);
  }

  private moveFocusTo(iso: string): void {
    const p = parse(iso)!;
    this.viewYear.set(p.year);
    if (this.mode() === 'date') this.viewMonth0.set(p.month0);
    this.focusIso.set(iso);
    this.focusCell();
  }

  private focusCell(): void {
    // nach dem Rendern: die Zelle mit Fokus-Datum bekommt den Fokus
    setTimeout(() => this.panel().nativeElement.querySelector<HTMLElement>('[data-focus="true"]')?.focus());
  }

  @HostListener('keydown', ['$event'])
  protected onHostKeydown(event: KeyboardEvent): void {
    // Ein geschlossener Kalender lässt Esc an den umgebenden Dialog durch; ein offener fängt es ab.
    if (event.key === 'Escape' && this.open()) {
      event.stopPropagation();
      this.close(true);
    }
  }
}

let nextId = 0;
