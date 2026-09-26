import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BudgetTimeline } from './budget-timeline';
import { FinanceBudget } from './private-finance-api.service';

const budget = (id: number, month: string, end: string | null, amount = '1000.00', open = false): FinanceBudget =>
  ({ id, month: `${month}-01`, end_month: end ? `${end}-01` : null, open_ended: open, amount, currency: 'EUR' }) as FinanceBudget;

@Component({
  imports: [BudgetTimeline],
  template: `<app-budget-timeline [budgets]="budgets()" [month]="month()" (monthPick)="monthPicked = $event" />`,
})
class Host {
  budgets = signal<FinanceBudget[]>([]);
  month = signal('2026-05');
  monthPicked = '';
}

function setup(budgets: FinanceBudget[], month = '2026-05') {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.budgets.set(budgets);
  fixture.componentInstance.month.set(month);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, bars: () => Array.from(el.querySelectorAll<HTMLButtonElement>('.tl__bar')) };
}

describe('BudgetTimeline', () => {
  it('spannt jedes Budget über seine Monate', () => {
    const { bars } = setup([budget(1, '2026-03', '2026-06')]);
    expect(bars()[0].style.gridColumn).toBe('3 / 7');
  });

  it('zeigt nie zwei Beträge übereinander: ein später beginnendes Budget übernimmt seine Monate', () => {
    const { bars } = setup([budget(1, '2026-01', '2026-06'), budget(2, '2026-04', '2026-08')]);
    expect(bars().map((b) => [b.style.gridColumn, b.style.gridRow])).toEqual([['1 / 4', '2'], ['4 / 9', '2']]);
  });

  it('teilt ein Budget in zwei Strecken, wenn ein kurzes späteres Budget mittendrin gilt', () => {
    const { bars } = setup([budget(1, '2026-03', null, '1000.00', true), budget(2, '2026-08', '2026-08', '1500.00')]);
    expect(bars().map((b) => b.style.gridColumn)).toEqual(['3 / 8', '8 / 9', '9 / 13']);
  });

  it('getrennte Budgets liegen nebeneinander in einer Zeile', () => {
    const { bars } = setup([budget(1, '2026-01', '2026-02'), budget(3, '2026-09', '2026-10')]);
    expect(new Set(bars().map((b) => b.style.gridRow)).size).toBe(1);
  });

  it('hebt nur das Budget hervor, das im gewählten Monat gilt (später beginnendes gewinnt)', () => {
    const { bars } = setup([budget(1, '2026-01', null, '1000.00', true), budget(2, '2026-05', '2026-06', '1500.00')]);
    const active = bars().filter((b) => b.classList.contains('is-active'));
    expect(active.length).toBe(1);
    expect(active[0].textContent).toContain('gilt im gewählten Monat');
    expect(active[0].style.gridColumn).toBe('5 / 7');
  });

  it('markiert „bis auf Weiteres“ und kürzt am Jahresrand', () => {
    const { bars } = setup([budget(1, '2025-11', null, '1000.00', true)]);
    expect(bars()[0].classList.contains('is-open-end')).toBe(true);
    expect(bars()[0].classList.contains('is-cut-start')).toBe(true);
    expect(bars()[0].style.gridColumn).toBe('1 / 13');
  });

  it('zeigt keine Budgets anderer Jahre und blättert per Jahrespfeil', () => {
    const { fixture, el, bars } = setup([budget(1, '2027-02', '2027-03')]);
    expect(bars().length).toBe(0);
    expect(el.textContent).toContain('keine Budgets');
    (el.querySelector('[aria-label="Nächstes Jahr"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(bars().length).toBe(1);
  });

  it('nur Monate sind anklickbar, Balken sind reine Anzeige', () => {
    const { fixture, el } = setup([budget(1, '2026-03', '2026-06')]);
    expect(el.querySelectorAll('.tl__bar button, button.tl__bar').length).toBe(0);
    (el.querySelectorAll('.tl__month')[8] as HTMLButtonElement).click();
    expect(fixture.componentInstance.monthPicked).toBe('2026-09');
  });
});
