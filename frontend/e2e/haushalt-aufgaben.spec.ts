import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Haushalt › Aufgaben nach Entwurf: Filterleiste, Gruppen-Tabellen, Überblick, schnelles Erfassen.
// Läuft gegen die Demo (keine Backend-Aufrufe).

for (const width of [390, 820, 1280, 1440]) {
  test(`tasks tab is accessible and fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('http://localhost:8000/api/**', (route) => route.abort());
    await page.goto('/demo/haushalt?tab=aufgaben');

    await expect(page.getByRole('heading', { name: 'Aufgaben im Überblick' })).toBeVisible();
    await expect(page.locator('.group--overdue')).toContainText('Pflanzen gießen');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Keine Zeile ragt aus ihrer Gruppe heraus
    expect(
      await page.locator('.group').evaluateAll((groups) =>
        groups.every((g) => g.scrollWidth <= g.clientWidth + 1),
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).include('app-aufgaben-tab').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/haushalt-aufgaben-${width}.png`, fullPage: true });
  });
}

test('filters by room and adds a task quickly for today', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/haushalt?tab=aufgaben');

  await page.locator('.filter').nth(1).locator('.select__trigger').click();
  await page.getByRole('option', { name: 'Küche', exact: true }).click();
  await expect(page.locator('.main .title-text')).toHaveText(['Küche sauber halten', 'Kühlschrank reinigen']);
  await page.getByRole('button', { name: 'Filter zurücksetzen' }).first().click();

  await page.getByPlaceholder('Was soll erledigt werden?').fill('Fenster putzen');
  await page.locator('.quick__when').getByRole('button', { name: 'Heute' }).click();
  await expect(page.locator('#grp-today').locator('..').locator('..')).toContainText('Fenster putzen');
});
