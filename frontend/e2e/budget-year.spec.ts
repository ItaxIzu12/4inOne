import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [360, 390, 430, 1440]) {
  test(`budgets: compact screen, year overview in a dialog at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/demo/finanzen?tab=budgets');
    // Zwei Karten: Budget und Rest. Die Rechnung erklärt den Rest — ausgegeben und gespart getrennt benannt
    await expect(page.locator('.kpis--budget .kpi')).toHaveCount(2);
    const calc = page.locator('.kpi--left .kpi__calc');
    await expect(calc).toContainText('ausgegeben');
    await expect(calc).toContainText('gespart');
    await expect(page.getByRole('progressbar', { name: 'Monatsbudget verbraucht' })).toBeVisible();
    await expect(page.getByText('Bereits verbraucht')).toHaveCount(0);
    // Kategorie-Budgets: Name und Beträge liegen nie übereinander
    const overlap = await page.locator('.budget-row').evaluateAll((rows) =>
      rows.some((row) => {
        const n = row.querySelector('.budget-row__name')!.getBoundingClientRect();
        const m = row.querySelector('.budget-row__nums')!.getBoundingClientRect();
        return n.width < 60 || !(n.bottom <= m.top + 1 || m.right <= n.left || n.right <= m.left);
      }),
    );
    expect(overlap).toBe(false);
    // Kein Donut „Budget-Nutzung“, keine dauerhafte Jahresliste
    await expect(page.getByText('Budget-Nutzung')).toHaveCount(0);
    await expect(page.locator('app-budget-year')).toHaveCount(0);
    // Kategorie-Status in Worten
    await expect(page.locator('.budget-row__status').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    await page.getByRole('button', { name: 'Jahresübersicht ansehen' }).click();
    const overview = page.locator('app-budget-year');
    await expect(overview.locator('.budget-month')).toHaveCount(12);
    // Erst nach dem Einblenden prüfen (während der Animation sind die Farben noch gedimmt)
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    const year = overview.getByLabel('Jahr', { exact: true });
    await year.focus();
    await year.selectOption(String(new Date().getFullYear() + 1));
    // Jahreswechsel: der Dialog bleibt offen, der Fokus bei der Jahresauswahl
    await expect(year).toBeFocused();
    await expect(overview.locator('h2')).toContainText(String(new Date().getFullYear() + 1));
    expect((await new AxeBuilder({ page }).include('app-budget-year').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    // Monat wählen: Dialog zu, der Monat wird angezeigt
    await overview.locator('.budget-month').nth(2).click();
    await expect(overview).toHaveCount(0);
    await expect(page.locator('.kpi__hint').first()).toContainText(`für März ${new Date().getFullYear() + 1}`);
  });
}

test('a month without budget shows no artificial numbers, only a way to set one', async ({ page }) => {
  await page.goto('/demo/finanzen?tab=budgets');
  await page.getByRole('button', { name: 'Jahresübersicht ansehen' }).click();
  await page.locator('app-budget-year .budget-month').first().click();
  await expect(page.getByRole('heading', { name: /Noch kein Budget für Januar/ })).toBeVisible();
  await expect(page.getByText('Vom Monatsbudget übrig')).toHaveCount(0);
  await expect(page.getByText('Budget gebunden')).toHaveCount(0);
  await expect(page.getByText(/über (dem )?Budget/)).toHaveCount(0);
  // Genau ein Einstieg, kein zweiter Knopf im Kopf oder unten
  await expect(page.getByRole('button', { name: 'Budget festlegen' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Budget festlegen' }).click();
  await expect(page.getByRole('dialog')).toContainText('Budget erstellen');
});
