import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BudgetYearOverview } from './budget-timeline';
import { FinanceBudget } from './private-finance-api.service';

const budget = (id: number, month: string, end: string | null, amount = '1000.00', open = false) =>
  ({ id, month: month + '-01', end_month: end ? end + '-01' : null, open_ended: open, amount, currency: 'EUR' }) as FinanceBudget;
@Component({
  imports: [BudgetYearOverview],
  template: '<app-budget-year [budgets]="budgets()" [month]="month()" (monthPick)="month.set($event)" />',
})
class Host {
  budgets = signal<FinanceBudget[]>([]);
  month = signal('2026-05');
}
function setup(budgets: FinanceBudget[] = []) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.budgets.set(budgets);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, rows: () => Array.from(el.querySelectorAll<HTMLButtonElement>('.budget-month')) };
}
describe('Budget year overview', () => {
  it('shows all twelve months even without budgets', () => {
    const { rows } = setup();
    expect(rows()).toHaveLength(12);
    expect(rows().every(r => r.textContent?.includes('Nicht festgelegt'))).toBe(true);
  });
  it('distinguishes a zero budget from a missing budget', () => {
    const { rows } = setup([budget(1, '2026-03', null, '0.00')]);
    expect(rows()[2].textContent).toContain('0,00');
    expect(rows()[2].textContent).not.toContain('Nicht festgelegt');
    expect(rows()[3].textContent).toContain('Nicht festgelegt');
  });
  it('uses the later budget only in its covered months', () => {
    const { rows } = setup([budget(1, '2025-12', null, '1000.00', true), budget(2, '2026-08', '2026-08', '1500.00')]);
    expect(rows()[0].textContent).toContain('1.000,00');
    expect(rows()[7].textContent).toContain('1.500,00');
    expect(rows()[8].textContent).toContain('1.000,00');
  });
  it('selects months and announces selection without opening an editor', () => {
    const { fixture, rows } = setup();
    rows()[8].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.month()).toBe('2026-09');
    expect(rows()[8].getAttribute('aria-pressed')).toBe('true');
    expect(rows().filter(r => r.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
  });
  it('changing year keeps the selected month and updates the amounts', () => {
    const { fixture, el, rows } = setup([budget(1, '2027-05', null)]);
    const select = el.querySelector('select')!;
    select.value = '2027';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.month()).toBe('2027-05');
    expect(rows()[4].textContent).toContain('1.000,00');
  });
});
