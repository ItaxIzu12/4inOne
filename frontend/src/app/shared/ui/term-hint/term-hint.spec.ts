import { TestBed } from '@angular/core/testing';
import { TermHint } from './term-hint';

describe('TermHint', () => {
  function render() {
    const fixture = TestBed.createComponent(TermHint);
    fixture.componentRef.setInput('term', 'Geplant');
    fixture.componentRef.setInput('text', 'Ausgaben, die noch kommen.');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('is a named button that opens one explaining sentence and closes with Escape or a click elsewhere', () => {
    const { fixture, el } = render();
    const button = el.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Was bedeutet „Geplant“?');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('[role="status"]')!.textContent!.trim()).toBe('');
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('[role="status"]')!.textContent).toContain('Geplant: Ausgaben, die noch kommen.');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});
