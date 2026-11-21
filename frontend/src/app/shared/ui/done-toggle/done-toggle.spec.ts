import { TestBed } from '@angular/core/testing';
import { DoneToggle } from './done-toggle';

describe('DoneToggle (runder Abhak-Knopf)', () => {
  function render(inputs: { done?: boolean; disabled?: boolean; hint?: string | null } = {}) {
    const f = TestBed.createComponent(DoneToggle);
    f.componentRef.setInput('label', 'Bad putzen als erledigt markieren');
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    return { f, button: f.nativeElement.querySelector('button') as HTMLButtonElement };
  }

  it('ist ein echter Knopf mit verständlicher Beschriftung und meldet den Klick', () => {
    const { f, button } = render();
    let clicks = 0;
    f.componentInstance.toggle.subscribe(() => clicks++);
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Bad putzen als erledigt markieren');
    expect(button.classList).not.toContain('is-done');
    button.click();
    expect(clicks).toBe(1);
  });

  it('zeigt „erledigt“ gefüllt; gesperrt löst keinen Klick aus und zeigt den Hinweis', () => {
    const { f, button } = render({ done: true, disabled: true, hint: 'Erst morgen fällig' });
    let clicks = 0;
    f.componentInstance.toggle.subscribe(() => clicks++);
    expect(button.classList).toContain('is-done');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('title')).toBe('Erst morgen fällig');
    button.click();
    expect(clicks).toBe(0);
  });
});
