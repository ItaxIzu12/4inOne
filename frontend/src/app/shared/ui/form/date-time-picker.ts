import { Component, computed, forwardRef, input, model, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { AppDatePicker } from './date-picker';
import { AppTimePicker } from './time-picker';

/** Uhrzeit, die beim Wählen eines Datums ohne Zeit vorgeschlagen wird. */
const DEFAULT_TIME = '09:00';

/**
 * Datum + Uhrzeit nebeneinander, als ein Wert im Format des nativen `datetime-local`-Feldes
 * (`JJJJ-MM-TTTHH:MM`). Ohne Datum ist der Wert leer; wählt man nur ein Datum, gilt 09:00 Uhr.
 *
 *   <app-field label="Beginn"><app-date-time-picker formControlName="starts_at" /></app-field>
 */
@Component({
  selector: 'app-date-time-picker',
  standalone: true,
  imports: [AppDatePicker, AppTimePicker],
  template: `
    <div class="dtp">
      <app-date-picker mode="date" partLabel="Datum" [clearable]="clearable()" [disabled]="disabled()" [value]="datePart()" (valueChange)="setDate($event)" />
      <app-time-picker partLabel="Uhrzeit" [disabled]="disabled() || !datePart()" [value]="timePart()" (valueChange)="setTime($event)" />
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .dtp {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
      gap: 8px;
    }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AppDateTimePicker), multi: true }],
})
export class AppDateTimePicker implements ControlValueAccessor {
  readonly value = model('');
  readonly clearable = input(false);
  readonly disabledInput = input(false, { alias: 'disabled' });
  private readonly formDisabled = signal(false);
  protected readonly disabled = computed(() => this.formDisabled() || this.disabledInput());

  private onChange: (value: string) => void = () => undefined;

  protected readonly datePart = computed(() => this.value().slice(0, 10));
  protected readonly timePart = computed(() => this.value().slice(11, 16));

  protected setDate(date: string): void {
    this.emit(date, date ? this.timePart() || DEFAULT_TIME : '');
  }

  protected setTime(time: string): void {
    this.emit(this.datePart(), time || DEFAULT_TIME);
  }

  private emit(date: string, time: string): void {
    const value = date ? `${date}T${time}` : '';
    this.value.set(value);
    this.onChange(value);
  }

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(): void {
    // Die Teile melden „berührt“ selbst; hier gibt es nichts zusammenzuführen.
  }
  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
  }
}
