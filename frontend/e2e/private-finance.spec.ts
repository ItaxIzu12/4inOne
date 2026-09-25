import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const width of [390, 1440]) {
  test(`private finance lifecycle ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 'test' } }));
    await page.route('**/api/v1/auth/refresh/', (r) =>
      r.fulfill({ json: { access: 'test', user: { name: 'Mira', email: 'mira@example.com' } } }),
    );
    await page.route('**/api/v1/onboarding/profile/', (r) =>
      r.fulfill({ json: { needs_onboarding: false, completed: true } }),
    );
    await page.route('**/api/v1/organisation/today/**', (r) =>
      r.fulfill({ json: { items: [], event_count: 0 } }),
    );
    const data: { [key: string]: any[] } = {
      transactions: [],
      budgets: [],
      goals: [],
      categories: [],
    };
    let next = 1;
    await page.route('**/api/v1/finanzen/private/**', async (r) => {
      const url = new URL(r.request().url()),
        parts = url.pathname.split('/').filter(Boolean),
        resource = parts[4],
        method = r.request().method();
      if (resource === 'summary') {
        const month = url.searchParams.get('month');
        const rows = data['transactions'].filter((t) => t.date.startsWith(month));
        const expense = rows
          .filter((t) => t.type === 'EXPENSE')
          .reduce((a, t) => a + Number(t.amount), 0);
        const income = rows
          .filter((t) => t.type === 'INCOME')
          .reduce((a, t) => a + Number(t.amount), 0);
        const budget = data['budgets'].find((b) => b.month.startsWith(month));
        return r.fulfill({
          json: {
            month,
            currency: 'EUR',
            budget: budget?.amount || null,
            available: budget ? (Number(budget.amount) - expense).toFixed(2) : null,
            income: income.toFixed(2),
            expenses: expense.toFixed(2),
            savings_target: data['goals']
              .reduce((a, g) => a + Number(g.target_amount), 0)
              .toFixed(2),
            savings_current: data['goals']
              .reduce((a, g) => a + Number(g.current_amount), 0)
              .toFixed(2),
            has_data: !!(budget || rows.length || data['goals'].length),
            categories: expense ? [{ name: 'Lebensmittel', amount: expense.toFixed(2) }] : [],
            recent: rows.slice(0, 5),
          },
        });
      }
      if (parts.at(-1) === 'setup') {
        data['categories'] = [
          { id: 1, name: 'Lebensmittel' },
          { id: 2, name: 'Sonstiges' },
        ];
        return r.fulfill({ json: data['categories'] });
      }
      const rows = data[resource],
        id = Number(parts[5]);
      if (method === 'POST') {
        const entry = { id: next++, ...r.request().postDataJSON() };
        rows.push(entry);
        return r.fulfill({ status: 201, json: entry });
      }
      if (method === 'PATCH') {
        const entry = rows.find((x) => x.id === id);
        Object.assign(entry, r.request().postDataJSON());
        return r.fulfill({ json: entry });
      }
      if (method === 'DELETE') {
        rows.splice(
          rows.findIndex((x) => x.id === id),
          1,
        );
        return r.fulfill({ status: 204 });
      }
      return r.fulfill({ json: rows });
    });
    await page.goto('/app/finanzen');
    await expect(page.getByRole('heading', { name: 'Finanzen', exact: true })).toBeVisible();
    await expect(page.getByText('Lege dein erstes Monatsbudget fest.')).toBeVisible();
    await page.getByRole('button', { name: 'Budget erstellen', exact: true }).click();
    await page.getByLabel('Budgetbetrag in EUR').fill('3000,00');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.month-card')).toContainText('3.000,00 €');
    await page.getByRole('button', { name: 'Neue Buchung', exact: true }).click();
    await page.getByLabel('Betrag in EUR', { exact: true }).fill('48,32');
    await page.getByRole('button', { name: 'Standardkategorien anlegen' }).click();
    await page.getByLabel('Notiz (optional)').fill('Supermarkt');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.locator('.month-card')).toContainText('2.951,68 €');
    await page.getByRole('button', { name: /Supermarkt/ }).click();
    await page.getByLabel('Betrag in EUR', { exact: true }).fill('50,00');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await page.getByRole('button', { name: 'Neue Buchung', exact: true }).click();
    await page.getByRole('combobox', { name: 'Typ', exact: true }).selectOption('INCOME');
    await page.getByLabel('Betrag in EUR', { exact: true }).fill('3100');
    await page.getByLabel('Notiz (optional)').fill('Gehalt');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await page.getByRole('button', { name: 'Sparziele', exact: true }).click();
    await page.getByRole('button', { name: 'Sparziel erstellen', exact: true }).click();
    await page.getByLabel('Titel', { exact: true }).fill('Neue Waschmaschine');
    await page.getByLabel('Zielbetrag in EUR').fill('700');
    await page.getByLabel('Bereits gespart in EUR').fill('480');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.locator('.goal')).toContainText('69 % erreicht');
    await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `test-results/finance-${width}.png`, fullPage: true });
    await page.goto('/app');
    await expect(page.locator('.domain.finance')).toContainText('2.950,00 € verfügbar');
    await page.locator('.domain.finance').click();
    await page.getByRole('button', { name: /Supermarkt/ }).click();
    await page.getByRole('button', { name: 'Eintrag löschen', exact: true }).click();
    await page.getByRole('button', { name: 'Löschen bestätigen', exact: true }).click();
    await expect(page.locator('.month-card')).toContainText('3.000,00 €');
  });
}
