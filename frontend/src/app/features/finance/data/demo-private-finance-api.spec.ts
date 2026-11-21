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

describe('Demo own categories', () => {
  it('creates, renames and deletes categories, moving bookings to Sonstiges', async () => {
    const api = new DemoPrivateFinanceApi();
    const created = await firstValueFrom(api.createCategory({ name: 'Haustier', monthly_goal: '60.00' }));
    expect(created.monthly_goal).toBe('60.00');
    await expect(firstValueFrom(api.createCategory({ name: 'haustier', monthly_goal: null }))).rejects.toMatchObject({ status: 400 });
    await firstValueFrom(api.updateCategory(created.id, { name: 'Hund' }));
    expect((await firstValueFrom(api.categories())).map((c) => c.name)).toContain('Hund');

    const health = (await firstValueFrom(api.categories())).find((c) => c.name === 'Gesundheit')!;
    const fallback = (await firstValueFrom(api.categories())).find((c) => c.name === 'Sonstiges')!;
    const moved = (await firstValueFrom(api.transactions())).filter((t) => t.category === health.id).length;
    const before = (await firstValueFrom(api.transactions())).filter((t) => t.category === fallback.id).length;
    expect(moved).toBeGreaterThan(0);
    await firstValueFrom(api.deleteCategory(health.id));
    const rows = await firstValueFrom(api.transactions());
    expect(rows.some((t) => t.category === health.id)).toBe(false);
    expect(rows.filter((t) => t.category === fallback.id).length).toBe(before + moved);
  });
  it('keeps Sonstiges: no rename, no delete', async () => {
    const api = new DemoPrivateFinanceApi();
    const fallback = (await firstValueFrom(api.categories())).find((c) => c.name === 'Sonstiges')!;
    await expect(firstValueFrom(api.updateCategory(fallback.id, { name: 'Rest' }))).rejects.toMatchObject({ status: 400 });
    await expect(firstValueFrom(api.deleteCategory(fallback.id))).rejects.toMatchObject({ status: 400 });
  });
});
