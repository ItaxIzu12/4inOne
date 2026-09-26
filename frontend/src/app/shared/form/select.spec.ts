import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Field } from './field';
import { AppSelect, SelectOption } from './select';

const OPTIONS: SelectOption[] = [
  { value: '1', label: 'Wohnen', color: '#a8452f' },
  { value: '2', label: 'Lebensmittel', color: '#1f5c41' },
  { value: '3', label: 'Sonstiges' },
];

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, Field, AppSelect],
  template: `
    <div (keydown)="outerKeys = outerKeys + 1">
      <app-field label="Kategorie"><app-select [formControl]="control" [options]="options" /></app-field>
    </div>
    <app-select [(value)]="plain" [options]="options" />
  `,
})
class Host {
  control = new FormControl('1', { nonNullable: true });
  plain = signal('');
  options = OPTIONS;
  outerKeys = 0;
}

describe('AppSelect', () => {
  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const trigger = el.querySelector('app-field .select__trigger') as HTMLButtonElement;
    const flush = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const key = async (target: Element, k: string) => {
      const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      await flush();
      return event;
    };
    return { fixture, host: fixture.componentInstance, el, trigger, flush, key };
  }

  it('shows the selected entry with its colour dot and is a labelled combobox', () => {
    const { el, trigger } = setup();
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.textContent).toContain('Wohnen');
    expect((trigger.querySelector('.select__dot') as HTMLElement).style.background).toContain('rgb(168, 69, 47)');
    // Name kommt von der Feldbeschriftung — nicht vom Text im Auslöser („Wohnen“)
    const labelledBy = trigger.getAttribute('aria-labelledby')!;
    expect(el.querySelector(`#${labelledBy}`)?.textContent?.trim()).toBe('Kategorie');
  });

  it('lists all options with colours and marks the current one', async () => {
    const { el, trigger, flush } = setup();
    trigger.click();
    await flush();
    const options = Array.from(el.querySelectorAll('app-field [role="option"]'));
    expect(options.map((o) => o.textContent?.trim())).toEqual(['Wohnen', 'Lebensmittel', 'Sonstiges']);
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    expect(options[1].getAttribute('aria-selected')).toBe('false');
    expect(options[0].querySelector('.select__dot')).not.toBeNull();
    expect(options[2].querySelector('.select__dot')).toBeNull(); // ohne Farbe kein Punkt
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(el.querySelector('app-field [role="listbox"]')?.id);
  });

  it('selecting with the mouse writes to the form control and closes the list', async () => {
    const { el, host, trigger, flush } = setup();
    trigger.click();
    await flush();
    (el.querySelectorAll('app-field [role="option"]')[1] as HTMLElement).click();
    await flush();
    expect(host.control.value).toBe('2');
    expect(trigger.textContent).toContain('Lebensmittel');
    expect(el.querySelector('app-field [role="listbox"]')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not reopen after choosing when the select sits inside a <label> (label default action)', async () => {
    const { el, trigger, flush } = setup();
    trigger.click();
    await flush();
    const option = el.querySelectorAll('app-field [role="option"]')[2] as HTMLElement;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    option.dispatchEvent(event);
    await flush();
    expect(event.defaultPrevented).toBe(true); // sonst würde das Label den Auslöser erneut anklicken
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('works with the keyboard: arrows move, Enter selects, Home/End jump', async () => {
    const { host, trigger, key, el } = setup();
    await key(trigger, 'ArrowDown'); // öffnet
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await key(trigger, 'ArrowDown');
    expect(trigger.getAttribute('aria-activedescendant')).toBe(el.querySelectorAll('app-field [role="option"]')[1].id);
    await key(trigger, 'End');
    expect(el.querySelectorAll('app-field [role="option"]')[2].classList).toContain('is-active');
    await key(trigger, 'Home');
    await key(trigger, 'ArrowDown');
    await key(trigger, 'Enter');
    expect(host.control.value).toBe('2');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('typing a letter jumps to the matching entry', async () => {
    const { trigger, key, el } = setup();
    await key(trigger, 'S');
    expect(el.querySelectorAll('app-field [role="option"]')[2].classList).toContain('is-active');
    await key(trigger, 'Enter');
    expect(trigger.textContent).toContain('Sonstiges');
  });

  it('Escape closes only the list and does not reach the surrounding dialog; when closed it passes through', async () => {
    const { host, trigger, key } = setup();
    await key(trigger, 'ArrowDown');
    await key(trigger, 'Escape');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(host.outerKeys).toBe(1); // nur das ArrowDown, Escape wurde abgefangen
    await key(trigger, 'Escape');
    expect(host.outerKeys).toBe(2); // geschlossen: Escape darf durch (z. B. um den Dialog zu schließen)
  });

  it('closes on outside click and keeps the value', async () => {
    const { fixture, trigger, host, flush } = setup();
    trigger.click();
    await flush();
    document.body.click();
    await flush();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(host.control.value).toBe('1');
    void fixture;
  });

  it('supports two-way binding without a form and shows a placeholder when empty', async () => {
    const { el, host, flush } = setup();
    const plainTrigger = el.querySelectorAll('.select__trigger')[1] as HTMLButtonElement;
    expect(plainTrigger.textContent).toContain('Auswählen');
    plainTrigger.click();
    await flush();
    (el.querySelectorAll('[role="option"]')[0] as HTMLElement).click();
    await flush();
    expect(host.plain()).toBe('1');
  });

  it('a press that starts inside and ends outside keeps the list open; scrolling outside closes it', async () => {
    const { el, trigger, flush } = setup();
    trigger.click();
    await flush();
    (el.querySelector('app-field [role="option"]') as HTMLElement).dispatchEvent(new Event('pointerdown', { bubbles: true }));
    document.body.click();
    await flush();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await new Promise((r) => setTimeout(r, 300));
    (el.querySelector('app-field .select__panel') as HTMLElement).dispatchEvent(new Event('scroll'));
    await flush();
    expect(trigger.getAttribute('aria-expanded')).toBe('true'); // Scrollen in der Liste zählt nicht
    document.dispatchEvent(new Event('scroll'));
    await flush();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('respects a disabled form control', async () => {
    const { host, trigger, flush } = setup();
    host.control.disable();
    await flush();
    expect(trigger.disabled).toBe(true);
    trigger.click();
    await flush();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
