import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AmountInput } from './amount-input';

@Component({ imports: [AmountInput, ReactiveFormsModule], template: '<input inputmode="decimal" [formControl]="amount" />' })
class Host { amount = new FormControl('12,50'); }

describe('AmountInput', () => {
  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    return { fixture, input };
  }
  it('rejects letters before editing but preserves shortcuts', () => {
    const { input } = setup();
    for (const key of ['a', 'e', 'E', '+', '-']) {
      const event = new KeyboardEvent('keydown', { key, cancelable: true });
      input.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    const selectAll = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, cancelable: true });
    input.dispatchEvent(selectAll);
    expect(selectAll.defaultPrevented).toBe(false);
  });
  it('restores invalid input before reactive forms read it', () => {
    const { fixture, input } = setup();
    for (const value of ['abc', '1e3', '100 Euro', '12,3.4']) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(input.value).toBe('12,50');
      expect(fixture.componentInstance.amount.value).toBe('12,50');
    }
  });
  it('allows decimal commas, points, intermediate edits and clearing', () => {
    const { fixture, input } = setup();
    for (const value of ['25', '25,', '25,75', '25.75', '']) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(fixture.componentInstance.amount.value).toBe(value);
    }
  });
  it('rejects pasted text rather than changing its numeric meaning', () => {
    const { input } = setup();
    for (const text of ['1e3', '100 EUR', '1.234,56']) {
      const event = new Event('paste', { cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
      input.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
  });
});
