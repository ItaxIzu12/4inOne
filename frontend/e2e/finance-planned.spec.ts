import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Geplante Ausgaben nachvollziehbar: Aus „Geplant“ im Budget kommt man mit einem Klick zu den konkreten Posten. */
async function nextMonthBudgets(page: import('@playwright/test').Page, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto('/demo/finanzen?tab=budgets');
  await page.getByRole('button', { name: /nächster Monat/i }).first().click();
}

for (const width of [360, 390, 430, 768, 1440]) {
  test(`planned amount explains itself in one click at ${width}px`, async ({ page }) => {
    await nextMonthBudgets(page, width);
    const breakdown = page.locator('.kpi--left .breakdown');
    await expect(breakdown).toContainText('Monatsbudget');
    await expect(breakdown).toContainText('Bereits ausgegeben');
    await expect(breakdown).toContainText('Verfügbar');
    const plannedLink = breakdown.getByRole('button', { name: /geplante Ausgaben im .* anzeigen/ });
    const label = (await plannedLink.getAttribute('aria-label'))!;
    const total = label.split(' geplante')[0];
    // Kategorie-Budgets: ausgegeben · geplant · Budget — in Worten, kein horizontales Überlaufen
    await expect(page.locator('.budget-row__nums').filter({ hasText: 'geplant' }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    await plannedLink.click(); // ein Klick
    await expect(page.locator('.tx-switch [aria-pressed="true"]')).toHaveText('Geplant');
    await expect(page.locator('#all-rows-h')).toContainText('Geplante Ausgaben');
    await expect(page.locator('#all-rows-h')).toContainText(total);
    const rows = page.locator('#all-rows .transaction');
    await expect(rows.first()).toContainText('Geplant');
    expect(await rows.count()).toBeGreaterThan(0);
    // Jede Zeile nennt Datum und Kategorie und ist als „Geplant“ gekennzeichnet (Text, nicht nur Farbe)
    for (const text of await rows.allInnerTexts()) expect(text).toMatch(/\d\d\.\d\d\.\d{4} • .+Geplant/s);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('a category budget opens its transactions; a planned recurring row can be booked from the form', async ({ page }) => {
  await nextMonthBudgets(page, 1440);
  const wohnen = page.locator('.budget-row', { hasText: 'Wohnen' });
  await expect(wohnen).toHaveAttribute('aria-label', /Wohnen: Budget .* ausgegeben, .* geplante Ausgaben, .* verfügbar/);
  await wohnen.click();
  await expect(page.locator('.tx-switch [aria-pressed="true"]')).toHaveText('Ausgaben');
  const rows = page.locator('#all-rows .transaction');
  await expect(rows.filter({ hasText: 'Miete' })).toContainText('Geplant');

  await rows.filter({ hasText: 'Miete' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Transaktion erstellen' })).toBeVisible();
  await expect(dialog.locator('.planned-note')).toContainText('Geplante wiederkehrende Ausgabe „Miete“');
  await expect(dialog.getByLabel('Notiz (optional)')).toHaveValue('Miete');
});
