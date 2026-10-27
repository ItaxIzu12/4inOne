import { Component, ElementRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AnimatedBeam } from './animated-beam';

@Component({
  standalone: true,
  imports: [AnimatedBeam],
  template: `
    <div #box style="position:relative;width:300px;height:200px">
      <span #a></span><span #b></span>
      <app-animated-beam [container]="box" [from]="a" [to]="b" color="#17694f" />
    </div>
  `,
})
class Host {
  readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
}

@Component({
  standalone: true,
  imports: [AnimatedBeam],
  template: `
    <div #box style="position:relative;width:300px;height:200px">
      <span #a></span><span #b></span>
      <app-animated-beam [container]="box" [from]="a" [to]="b" [iterations]="3" />
    </div>
  `,
})
class FiniteHost {}

describe('AnimatedBeam', () => {
  it('draws a quiet base line and a coloured pulse between the two elements, hidden from screen readers', async () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('app-animated-beam svg') as SVGElement;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelectorAll('path')).toHaveLength(2);
    expect(svg.querySelector('.beam__pulse')?.getAttribute('d')).toMatch(/^M .+ Q .+/);
    expect((svg.querySelector('.beam__pulse') as SVGPathElement).style.stroke).toBeTruthy();
  });
  it('can run a fixed number of pulses and then rest (app surfaces)', async () => {
    TestBed.configureTestingModule({ imports: [FiniteHost] });
    const fixture = TestBed.createComponent(FiniteHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const pulse = (fixture.nativeElement as HTMLElement).querySelector('.beam__pulse') as SVGPathElement;
    expect(pulse.classList).toContain('is-finite');
    expect(pulse.style.animationIterationCount).toBe('3');
  });
});
