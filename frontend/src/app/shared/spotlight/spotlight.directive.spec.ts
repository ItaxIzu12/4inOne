import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Spotlight } from './spotlight.directive';

@Component({ standalone: true, imports: [Spotlight], template: `<div appSpotlight style="width:200px;height:100px"></div>` })
class Host {}

describe('Spotlight', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('[appSpotlight]') as HTMLElement;
  }
  const pointer = (type: string, init: { clientX?: number; clientY?: number; pointerType?: string }) => {
    const event = new MouseEvent(type, { bubbles: true, clientX: init.clientX ?? 0, clientY: init.clientY ?? 0 });
    Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'mouse' });
    return event;
  };

  it('follows the mouse with CSS variables and hides on leave', () => {
    const el = setup();
    el.dispatchEvent(pointer('pointermove', { clientX: 40, clientY: 20 }));
    expect(el.style.getPropertyValue('--spot-o')).toBe('1');
    expect(el.style.getPropertyValue('--spot-x')).toMatch(/px$/);
    el.dispatchEvent(pointer('pointerleave', {}));
    expect(el.style.getPropertyValue('--spot-o')).toBe('0');
  });

  it('stays off for touch', () => {
    const el = setup();
    el.dispatchEvent(pointer('pointermove', { pointerType: 'touch' }));
    expect(el.style.getPropertyValue('--spot-o')).toBe('');
  });
});
