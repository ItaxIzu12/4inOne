import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Field } from './field';
import { AppTimePicker } from './time-picker';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, Field, AppTimePicker],
  template: `
    <div (keydown)="outerKeys = outerKeys + 1">
      <app-field label="Uhrzeit" [optional]="true"><app-time-picker [formControl]="time" [clearable]="true" /></app-field>
    </div>
  `,
})
class Host {
  time = new FormControl('08:30:00', { nonNullable: true });
  outerKeys = 0;
}

describe('AppTimePicker', () => {
  function setup(initial?: string) {
    const fixture = TestBed.createComponent(Host);
    if (initial !== undefined) fixture.componentInstance.time.setValue(initial);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const trigger = el.querySelector('.tp__trigger') as HTMLButtonElement;
    const flush = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 0));
      fixture.detectChanges();
    };
    const hour = (h: number) => el.querySelector(`[data-group="hour"][aria-label="${h} Uhr"]`) as HTMLButtonElement;
    const minute = (m: number) => el.querySelector(`[data-group="minute"][aria-label="${m} Minuten"]`) as HTMLButtonElement;
    return { fixture, host: fixture.componentInstance, el, trigger, flush, hour, minute };
  }

  it('shows HH:MM (accepting HH:MM:SS from the API) and is named by the field label without "(optional)"', () => {
    const { el, trigger } = setup();
    expect(trigger.textContent).toContain('08:30 Uhr');
    expect(el.querySelector(`#${trigger.getAttribute('aria-labelledby')}`)?.textContent).toContain('Uhrzeit');
  });

  it('shows a placeholder for an empty or invalid value', () => {
    expect(setup('').trigger.textContent).toContain('Uhrzeit wählen');
    expect(setup('25:99').trigger.textContent).toContain('Uhrzeit wählen');
  });

  it('offers 24 hours and minutes in 5-minute steps, marking the current time', async () => {
    const { el, trigger, flush, hour, minute } = setup();
    trigger.click();
    await flush();
    expect(el.querySelectorAll('[data-group="hour"]').length).toBe(24);
    expect(Array.from(el.querySelectorAll('[data-group="minute"]')).map((b) => b.textContent?.trim())).toEqual(
      ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'],
    );
    expect(hour(8).getAttribute('aria-pressed')).toBe('true');
    expect(minute(30).getAttribute('aria-pressed')).toBe('true');
  });

  it('choosing the hour keeps the panel open and moves on to the minutes; the minute closes it', async () => {
    const { host, el, trigger, flush, hour, minute } = setup('');
    trigger.click();
    await flush();
    hour(14).click();
    await flush();
    expect(host.time.value).toBe('14:00'); // Minute noch offen → 00
    expect(el.querySelector('.tp__grid')).not.toBeNull(); // Fenster bleibt offen
    minute(45).click();
    await flush();
    expect(host.time.value).toBe('14:45');
    expect(trigger.textContent).toContain('14:45 Uhr');
    expect(el.querySelector('.tp__grid')).toBeNull();
  });

  it('a new hour keeps the chosen minute', async () => {
    const { host, trigger, flush, hour } = setup('08:30');
    trigger.click();
    await flush();
    hour(17).click();
    await flush();
    expect(host.time.value).toBe('17:30');
  });

  it('"Entfernen" empties an optional field', async () => {
    const { host, el, trigger, flush } = setup();
    trigger.click();
    await flush();
    (el.querySelector('.tp__clear') as HTMLButtonElement).click();
    await flush();
    expect(host.time.value).toBe('');
    expect(trigger.textContent).toContain('Uhrzeit wählen');
  });

  it('keyboard: arrows move within the hour grid, Enter moves on to the minutes, Esc closes only the panel', async () => {
    const { host, el, trigger, flush } = setup('08:30');
    trigger.click();
    await flush();
    const press = async (k: string, group: string) => {
      const target = el.querySelector(`[data-group="${group}"][data-focus="true"]`) as HTMLElement;
      target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      await flush();
    };
    const focused = (group: string) => (el.querySelector(`[data-group="${group}"][data-focus="true"]`) as HTMLElement).getAttribute('aria-label');
    expect(focused('hour')).toBe('8 Uhr');
    await press('ArrowRight', 'hour');
    await press('ArrowDown', 'hour');
    expect(focused('hour')).toBe('15 Uhr'); // 8 + 1 + 6
    await press('End', 'hour');
    expect(focused('hour')).toBe('23 Uhr');
    await press('Home', 'hour');
    expect(focused('hour')).toBe('0 Uhr');
    await press('ArrowUp', 'hour');
    expect(focused('hour')).toBe('0 Uhr'); // bleibt am Rand
    await press('ArrowDown', 'minute');
    expect(focused('minute')).toBe('30 Minuten'); // letzte Reihe: „runter“ bleibt stehen
    const before = host.outerKeys;
    await press('Escape', 'hour');
    expect(el.querySelector('.tp__grid')).toBeNull();
    expect(host.outerKeys).toBe(before);
  });

  it('does not reopen after picking inside a <label> (default action prevented)', async () => {
    const { el, trigger, flush, hour } = setup('');
    trigger.click();
    await flush();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    hour(9).dispatchEvent(event);
    await flush();
    expect(event.defaultPrevented).toBe(true);
    void el;
    expect(trigger.getAttribute('aria-expanded')).toBe('true'); // Stunde gewählt, wartet auf Minute
  });

  it('a press that slips outside does not close it; scrolling outside does', async () => {
    const { el, trigger, flush, hour } = setup();
    trigger.click();
    await flush();
    hour(9).dispatchEvent(new Event('pointerdown', { bubbles: true }));
    document.body.click();
    await flush();
    expect(el.querySelector('.tp__grid')).not.toBeNull();
    await new Promise((r) => setTimeout(r, 300));
    document.dispatchEvent(new Event('scroll'));
    await flush();
    expect(el.querySelector('.tp__grid')).toBeNull();
  });

  it('respects a disabled control', async () => {
    const { host, el, trigger, flush } = setup();
    host.time.disable();
    await flush();
    expect(trigger.disabled).toBe(true);
    trigger.click();
    await flush();
    expect(el.querySelector('.tp__grid')).toBeNull();
  });
});
