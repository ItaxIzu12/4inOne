import { TestBed } from '@angular/core/testing';
import { SpendCurveChart } from './spend-curve';
import { spendCurve } from './spend-curve-data';

describe('SpendCurveChart', () => {
  function render(compact: boolean) {
    const fixture = TestBed.createComponent(SpendCurveChart);
    const curve = spendCurve(
      [
        { type: 'EXPENSE', amount: '100.00', date: '2026-10-01' },
        { type: 'EXPENSE', amount: '50.00', date: '2026-10-03' },
      ],
      '2026-10',
      3100,
      new Date(2026, 9, 5, 12),
    );
    fixture.componentRef.setInput('curve', curve);
    fixture.componentRef.setInput('compact', compact);
    fixture.componentRef.setInput('label', 'Ausgaben im Oktober');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('compact: a described image with the curve, the pace line and a today point — nothing to operate', () => {
    const { el } = render(true);
    const plot = el.querySelector('.plot')!;
    expect(plot.getAttribute('role')).toBe('img');
    expect(plot.getAttribute('aria-label')).toBe('Ausgaben im Oktober');
    expect(plot.hasAttribute('tabindex')).toBe(false);
    expect(el.querySelector('path.line')).toBeTruthy();
    expect(el.querySelector('path.pace')).toBeTruthy();
    expect(el.querySelector('.dot--today')).toBeTruthy();
    expect(el.querySelector('.readout')).toBeNull();
    expect(el.querySelector('.legend')).toBeNull();
  });

  it('full: a keyboard slider over the days; the readout names the day, the amount so far and the plan', () => {
    const { fixture, el } = render(false);
    const plot = el.querySelector<HTMLElement>('.plot')!;
    expect(plot.getAttribute('role')).toBe('slider');
    expect(plot.getAttribute('aria-valuenow')).toBe('5');
    expect(el.querySelector('.legend')!.textContent).toContain('Budget für Ausgaben (ohne Sparbeiträge), gleichmäßig verteilt');
    plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    fixture.detectChanges();
    expect(plot.getAttribute('aria-valuenow')).toBe('1');
    expect(plot.getAttribute('aria-valuetext')!.replace(/\s/g, ' ')).toBe('Bis 1. Okt.: 100,00 € ausgegeben, Budget anteilig: 100 €');
    plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(el.querySelector('.readout')!.textContent!.replace(/\s/g, ' ')).toContain('150,00 € ausgegeben');
    plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    fixture.detectChanges();
    expect(plot.getAttribute('aria-valuetext')).toMatch(/^Bis heute im \p{L}+:/u); // laufender Monat: Summe bis heute
  });
});
