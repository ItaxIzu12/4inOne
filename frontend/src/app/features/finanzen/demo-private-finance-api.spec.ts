import { firstValueFrom } from 'rxjs';
import { DemoPrivateFinanceApi } from './demo-private-finance-api';
import { financeMonth } from './private-finance-api.service';

describe('Demo spending limit', () => {
  it('income leaves the budget unchanged while existing savings reduce it', async () => {
    const api = new DemoPrivateFinanceApi();
    const before = await firstValueFrom(api.summary());
    expect(Number(before.available)).toBeCloseTo(Number(before.budget) - Number(before.expenses) - Number(before.saved));
    expect(before.total).toBe(before.budget);
    await firstValueFrom(api.save('transactions', { amount: '100.00', type: 'INCOME', date: financeMonth() + '-01', category: 1, currency: 'EUR' }));
    await firstValueFrom(api.save('goals', { title: 'Test', target_amount: '100', current_amount: '50', status: 'ACTIVE', plan_month: financeMonth() + '-01', plan_open_ended: true }));
    const after = await firstValueFrom(api.summary());
    expect(Number(after.available)).toBeCloseTo(Number(before.available) - 50);
    expect(Number(after.income)).toBeCloseTo(Number(before.income) + 100);
    await firstValueFrom(api.save('transactions', { amount: '25.30', type: 'EXPENSE', date: financeMonth() + '-01', category: 1, currency: 'EUR' }));
    expect(Number((await firstValueFrom(api.summary())).available)).toBeCloseTo(Number(before.available) - 50 - 25.3);
  });
});
