import { TestBed } from '@angular/core/testing';

import { Brand } from './brand';

describe('Brand (Veyora-Orbit)', () => {
  function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(Brand);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('zeigt Zeichen mit vier Elementen und den Namen; das Zeichen ist dann dekorativ', () => {
    const el = render();
    expect(el.querySelectorAll('path.el')).toHaveLength(4);
    expect(el.querySelector('.name')?.textContent).toBe('Veyora');
    expect(el.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('global: kein Element ist leiser', () => {
    expect(render().querySelectorAll('.is-quiet')).toHaveLength(0);
  });

  it('im Bereich bleibt nur das passende Element voll, Form und Reihenfolge bleiben', () => {
    const el = render({ context: 'household' });
    const paths = [...el.querySelectorAll('path.el')];
    expect(paths.map((p) => p.classList.contains('is-quiet'))).toEqual([true, false, true, true]);
    expect(paths[1].classList).toContain('el--household');
    expect(el.getAttribute('data-context')).toBe('household');
  });

  it('nur Zeichen: trägt dann selbst den Namen für Bildschirmleser', () => {
    const el = render({ wordmark: false });
    const svg = el.querySelector('svg')!;
    expect(el.querySelector('.name')).toBeNull();
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Veyora');
  });
});
