import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Field } from './field';
import { AppDatePicker } from './date-picker';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, Field, AppDatePicker],
  template: `
    <div (keydown)="outerKeys = outerKeys + 1">
      <app-field label="Monat"><app-date-picker mode="month" [formControl]="month" [min]="min" /></app-field>
      <app-field label="Datum"><app-date-picker mode="date" [formControl]="date" /></app-field>
    </div>
  `,
})
class Host {
  month = new FormControl('2026-09', { nonNullable: true });
  date = new FormControl('2026-09-25', { nonNullable: true });
  min = '';
  outerKeys = 0;
}

describe('AppDatePicker', () => {
  function setup(min = '') {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.min = min;
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const [monthTrigger, dateTrigger] = Array.from(el.querySelectorAll('.dp__trigger')) as HTMLButtonElement[];
    const flush = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();
    };
    const cell = (iso: string) => el.querySelector(`.dp__cell[data-iso="${iso}"]`) as HTMLButtonElement | null;
    const key = async (k: string, opts: KeyboardEventInit = {}) => {
      const grid = el.querySelector('.dp__grid') as HTMLElement;
      const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts });
      grid.dispatchEvent(event);
      await flush();
      return event;
    };
    return { fixture, host: fixture.componentInstance, el, monthTrigger, dateTrigger, flush, cell, key };
  }

  it('shows the value in German and is named by its field label', () => {
    const { el, monthTrigger, dateTrigger } = setup();
    expect(monthTrigger.textContent).toContain('September 2026');
    expect(dateTrigger.textContent).toContain('25.09.2026');
    const name = el.querySelector(`#${dateTrigger.getAttribute('aria-labelledby')}`);
    expect(name?.textContent?.trim()).toBe('Datum');
  });

  it('month picker: shows 12 months, marks the selected, picks a month as JJJJ-MM', async () => {
    const { host, el, monthTrigger, flush, cell } = setup();
    monthTrigger.click();
    await flush();
    expect(el.querySelectorAll('.dp__grid--months .dp__cell').length).toBe(12);
    expect(el.querySelector('.dp__title')?.textContent).toBe('2026');
    expect(cell('2026-09')!.getAttribute('aria-pressed')).toBe('true');
    expect(cell('2026-09')!.getAttribute('aria-label')).toBe('September 2026');
    cell('2026-12')!.click();
    await flush();
    expect(host.month.value).toBe('2026-12');
    expect(monthTrigger.textContent).toContain('Dezember 2026');
    expect(el.querySelector('.dp__grid')).toBeNull(); // geschlossen
  });

  it('month picker: year arrows change the year', async () => {
    const { el, monthTrigger, flush, cell, host } = setup();
    monthTrigger.click();
    await flush();
    (el.querySelector('[aria-label="Nächstes Jahr"]') as HTMLElement).click();
    (el.querySelector('[aria-label="Nächstes Jahr"]') as HTMLElement).click();
    await flush();
    expect(el.querySelector('.dp__title')?.textContent).toBe('2028');
    cell('2028-03')!.click();
    await flush();
    expect(host.month.value).toBe('2028-03');
    monthTrigger.click();
    await flush();
    (el.querySelector('[aria-label="Vorheriges Jahr"]') as HTMLElement).click();
    await flush();
    expect(el.querySelector('.dp__title')?.textContent).toBe('2027');
  });

  it('month picker: months before min are disabled and cannot be picked', async () => {
    const { host, monthTrigger, flush, cell } = setup('2026-07');
    monthTrigger.click();
    await flush();
    expect(cell('2026-06')!.disabled).toBe(true);
    expect(cell('2026-07')!.disabled).toBe(false);
    cell('2026-06')!.click();
    await flush();
    expect(host.month.value).toBe('2026-09');
  });

  it('date picker: 6 weeks starting on Monday, today/selected marked, picks JJJJ-MM-TT', async () => {
    const { host, el, dateTrigger, flush, cell } = setup();
    dateTrigger.click();
    await flush();
    const days = el.querySelectorAll('.dp__grid--days .dp__cell');
    expect(days.length).toBe(42);
    expect(Array.from(el.querySelectorAll('.dp__weekdays span')).map((s) => s.textContent)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
    expect((days[0] as HTMLElement).dataset['iso']).toBe('2026-08-31'); // 1.9.2026 ist ein Dienstag
    expect(cell('2026-09-25')!.classList).toContain('is-selected');
    expect(cell('2026-08-31')!.classList).toContain('is-outside');
    expect(el.querySelector('.dp__title')?.textContent).toBe('September 2026');
    cell('2026-09-30')!.click();
    await flush();
    expect(host.date.value).toBe('2026-09-30');
    expect(dateTrigger.textContent).toContain('30.09.2026');
  });

  it('date picker: month arrows page through months and across the year boundary', async () => {
    const { el, dateTrigger, flush } = setup();
    dateTrigger.click();
    await flush();
    for (let i = 0; i < 4; i++) (el.querySelector('[aria-label="Nächster Monat"]') as HTMLElement).click();
    await flush();
    expect(el.querySelector('.dp__title')?.textContent).toBe('Januar 2027');
    (el.querySelector('[aria-label="Vorheriges Jahr"]') as HTMLElement).click();
    await flush();
    expect(el.querySelector('.dp__title')?.textContent).toBe('Januar 2026');
  });

  it('keyboard in the day grid: arrows, Page Up/Down, Home/End move the focus date', async () => {
    const { el, dateTrigger, flush, key } = setup();
    dateTrigger.click();
    await flush();
    const focused = () => (el.querySelector('.dp__cell[data-focus="true"]') as HTMLElement).dataset['iso'];
    expect(focused()).toBe('2026-09-25');
    await key('ArrowRight');
    expect(focused()).toBe('2026-09-26');
    await key('ArrowDown');
    expect(focused()).toBe('2026-10-03'); // wechselt in den nächsten Monat, Ansicht folgt
    expect(el.querySelector('.dp__title')?.textContent).toBe('Oktober 2026');
    await key('PageUp');
    expect(focused()).toBe('2026-09-03');
    await key('PageDown', { shiftKey: true });
    expect(focused()).toBe('2027-09-03');
    await key('Home'); // Montag dieser Woche
    expect(focused()).toBe('2027-08-30');
    await key('End');
    expect(focused()).toBe('2027-09-05');
  });

  it('keyboard: Enter/Space on the focused cell selects; Escape closes only the calendar', async () => {
    const { el, host, dateTrigger, flush, key } = setup();
    dateTrigger.click();
    await flush();
    await key('ArrowLeft');
    const beforeEsc = host.outerKeys;
    await key('Escape');
    expect(el.querySelector('.dp__grid')).toBeNull();
    expect(host.outerKeys).toBe(beforeEsc); // erreicht den umgebenden Dialog nicht
    expect(host.date.value).toBe('2026-09-25'); // Escape wählt nichts
    dateTrigger.click();
    await flush();
    await key('ArrowLeft');
    (el.querySelector('.dp__cell[data-focus="true"]') as HTMLButtonElement).click(); // Enter/Space lösen auf Buttons einen Klick aus
    await flush();
    expect(host.date.value).toBe('2026-09-24');
  });

  it('keyboard: focus never enters months outside min/max', async () => {
    const { el, monthTrigger, flush, key } = setup('2026-08');
    monthTrigger.click();
    await flush();
    await key('ArrowLeft'); // 08 ist noch erlaubt
    await key('ArrowLeft'); // 07 ist gesperrt → bleibt auf 08
    expect((el.querySelector('.dp__cell[data-focus="true"]') as HTMLElement).dataset['iso']).toBe('2026-08');
  });

  it('does not reopen after picking when inside a <label> (default action prevented)', async () => {
    const { el, dateTrigger, flush, cell } = setup();
    dateTrigger.click();
    await flush();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    cell('2026-09-10')!.dispatchEvent(event);
    await flush();
    expect(event.defaultPrevented).toBe(true);
    expect(dateTrigger.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('.dp__grid')).toBeNull();
  });

  it('"Entfernen" only appears for clearable pickers with a value', async () => {
    const { el, dateTrigger, flush } = setup();
    dateTrigger.click();
    await flush();
    expect(el.querySelector('.dp__clear')).toBeNull(); // in diesem Host nicht löschbar
  });

  it('a press that starts inside and is released outside does not count as a click outside', async () => {
    const { el, dateTrigger, flush, cell } = setup();
    dateTrigger.click();
    await flush();
    cell('2026-09-10')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    document.body.click(); // losgelassen daneben: Klick landet auf dem gemeinsamen Elternelement
    await flush();
    expect(el.querySelector('.dp__grid')).not.toBeNull();
    // ein echter Klick daneben (Druck UND Klick außen) schließt weiterhin
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    document.body.click();
    await flush();
    expect(el.querySelector('.dp__grid')).toBeNull();
  });

  it('scrolling outside closes it after a short grace period; scrolling inside does not', async () => {
    const { el, dateTrigger, flush } = setup();
    dateTrigger.click();
    await flush();
    document.dispatchEvent(new Event('scroll')); // sofort nach dem Öffnen: ignoriert
    await flush();
    expect(el.querySelector('.dp__grid')).not.toBeNull();
    await new Promise((r) => setTimeout(r, 300));
    (dateTrigger.parentElement!.querySelector('.dp__panel') as HTMLElement).dispatchEvent(new Event('scroll')); // im Panel dieses Feldes
    await flush();
    expect(el.querySelector('.dp__grid')).not.toBeNull();
    document.dispatchEvent(new Event('scroll')); // Seite scrollt
    await flush();
    expect(el.querySelector('.dp__grid')).toBeNull();
    expect(dateTrigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('respects a disabled control', async () => {
    const { host, dateTrigger, flush, el } = setup();
    host.date.disable();
    await flush();
    expect(dateTrigger.disabled).toBe(true);
    dateTrigger.click();
    await flush();
    expect(el.querySelector('.dp__grid')).toBeNull();
  });
});
