import { TestBed } from '@angular/core/testing';

import { Brand } from './brand';

describe('Brand (Lumiknot-Orbit)', () => {
  function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(Brand);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('zeigt Zeichen mit vier Elementen und den Namen; das Zeichen ist dann dekorativ', () => {
    const el = render();
    expect(el.querySelectorAll('path.el')).toHaveLength(4);
    expect(el.querySelector('.name')?.textContent).toBe('Lumiknot');
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
    expect(svg.getAttribute('aria-label')).toBe('Lumiknot');
  });
});

describe('Brand – Varianten (Logo-Zustände)', () => {
  function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(Brand);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('layout: symbol, wordmark, vertical mit Claim', () => {
    expect(render({ layout: 'symbol' }).querySelector('.name')).toBeNull();
    const word = render({ layout: 'wordmark' });
    expect(word.querySelector('svg')).toBeNull();
    expect(word.querySelector('.name')?.textContent).toBe('Lumiknot');
    const vertical = render({ layout: 'vertical', claim: true });
    expect(vertical.getAttribute('data-layout')).toBe('vertical');
    expect(vertical.querySelector('.claim')?.textContent).toBe('Life, connected.');
  });

  it('einfarbig: Schriftfarbe statt Bereichsfarben, Lücken über Masken mit eindeutigen IDs je Instanz', () => {
    const a = render({ tone: 'mono' });
    const b = render({ tone: 'mono' });
    const paths = [...a.querySelectorAll<SVGPathElement>('path.el')];
    expect(paths.every((p) => p.style.stroke === 'currentcolor' || p.style.stroke === 'currentColor')).toBe(true);
    expect(a.querySelectorAll('mask')).toHaveLength(4);
    const idsA = [...a.querySelectorAll('mask')].map((m) => m.id);
    const idsB = [...b.querySelectorAll('mask')].map((m) => m.id);
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });

  it('size: setzt die Größe; unter 24 px die Kleinvariante (Strich 84)', () => {
    const small = render({ size: 16, layout: 'symbol' });
    expect(parseFloat(small.style.fontSize)).toBeCloseTo(16 / 1.3, 3);
    expect(small.querySelector('path.el')?.getAttribute('stroke-width')).toBe('84');
    expect(render({ size: 40, layout: 'symbol' }).querySelector('path.el')?.getAttribute('stroke-width')).toBe('68');
  });

  it('surface und motion als Klassen; ohne Angabe statisch', () => {
    expect(render({ surface: 'dark' }).classList).toContain('on-dark');
    expect(render({ motion: 'animated' }).classList).toContain('is-animated');
    expect(render().classList).not.toContain('is-animated');
  });
});
