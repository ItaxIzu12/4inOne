import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Field } from './field';
import { AppDateTimePicker } from './date-time-picker';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, Field, AppDateTimePicker],
  template: `
    <app-field label="Beginn"><app-date-time-picker [formControl]="start" /></app-field>
    <app-field label="Ende" [optional]="true"><app-date-time-picker [formControl]="end" [clearable]="true" /></app-field>
    <app-date-time-picker [(value)]="plain" [disabled]="locked()" />
  `,
})
class Host {
  start = new FormControl('2026-09-25T09:00', { nonNullable: true });
  end = new FormControl('', { nonNullable: true });
  plain = signal('');
  locked = signal(false);
}

describe('AppDateTimePicker', () => {
  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const flush = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();
    };
    const [startDate, startTime, endDate, endTime] = Array.from(el.querySelectorAll('.dp__trigger, .tp__trigger')) as HTMLButtonElement[];
    return { fixture, host: fixture.componentInstance, el, flush, startDate, startTime, endDate, endTime };
  }

  it('shows both parts and names them "Feld – Teil" so a screen reader can tell them apart', () => {
    const { startDate, startTime, endDate } = setup();
    expect(startDate.textContent).toContain('25.09.2026');
    expect(startTime.textContent).toContain('09:00 Uhr');
    expect(startDate.getAttribute('aria-label')).toBe('Beginn – Datum');
    expect(startTime.getAttribute('aria-label')).toBe('Beginn – Uhrzeit');
    expect(endDate.getAttribute('aria-label')).toBe('Ende – Datum'); // ohne „(optional)“
  });

  it('picking a date keeps the time; the value stays in datetime-local format', async () => {
    const { host, el, startDate, flush } = setup();
    startDate.click();
    await flush();
    (el.querySelector('.dp__cell[data-iso="2026-09-30"]') as HTMLButtonElement).click();
    await flush();
    expect(host.start.value).toBe('2026-09-30T09:00');
  });

  it('picking a time keeps the date', async () => {
    const { host, el, startTime, flush } = setup();
    startTime.click();
    await flush();
    (el.querySelector('[data-group="hour"][aria-label="13 Uhr"]') as HTMLButtonElement).click();
    await flush();
    (el.querySelector('[data-group="minute"][aria-label="15 Minuten"]') as HTMLButtonElement).click();
    await flush();
    expect(host.start.value).toBe('2026-09-25T13:15');
  });

  it('an empty optional field: the time is disabled until a date is chosen; a date without time gets 09:00', async () => {
    const { host, el, endDate, endTime, flush } = setup();
    expect(endTime.disabled).toBe(true);
    endDate.click();
    await flush();
    (el.querySelector('.dp__cell[data-iso="2026-09-25"]') as HTMLButtonElement).click();
    await flush();
    expect(host.end.value).toBe('2026-09-25T09:00');
    expect(endTime.disabled).toBe(false);
  });

  it('"Entfernen" on the date empties the whole value and disables the time again', async () => {
    const { host, el, endDate, endTime, flush } = setup();
    host.end.setValue('2026-10-01T18:30');
    await flush();
    endDate.click();
    await flush();
    (el.querySelector('.dp__clear') as HTMLButtonElement).click();
    await flush();
    expect(host.end.value).toBe('');
    expect(endTime.disabled).toBe(true);
  });

  it('works without a form and can be disabled', async () => {
    const { host, el, flush } = setup();
    const [, , , , plainDate] = Array.from(el.querySelectorAll('.dp__trigger, .tp__trigger')) as HTMLButtonElement[];
    plainDate.click();
    await flush();
    (el.querySelector('.dp__cell.is-today') as HTMLButtonElement).click();
    await flush();
    expect(host.plain()).toMatch(/^\d{4}-\d{2}-\d{2}T09:00$/);
    host.locked.set(true);
    await flush();
    expect(plainDate.disabled).toBe(true);
  });
});
