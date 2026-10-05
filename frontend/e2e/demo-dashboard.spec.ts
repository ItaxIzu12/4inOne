import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 820, 1536]) {
  test(`new demo dashboard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1050 });
    const privateCalls: string[] = [];
    await page.route('**/api/**', route => {
      if (/\/(organisation|finanzen|reisen|today)\//.test(route.request().url())) privateCalls.push(route.request().url());
      return route.abort();
    });
    await page.goto('/demo');
    await expect(page.getByRole('heading', { name: 'Aktuelle Aufgaben' })).toBeVisible();
    await expect(page.locator('.domain')).toHaveCount(4);
    // am Handy kurz „Demo“ (neben dem Datum), sonst ausgeschrieben
    if (width < 761) await expect(page.locator('.demo-badge__short')).toBeVisible();
    else await expect(page.getByText('Demo-Modus · Beispieldaten', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/new-demo-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Nächster Monat', exact: true }).click();
    await expect(page.locator('.transactions')).toContainText('Keine Buchungen');
    await page.getByRole('button', { name: 'Vorheriger Monat', exact: true }).click();
    await expect(page.locator('.transaction').first()).toBeVisible();
    await page.getByRole('button', { name: 'Neue Aufgabe', exact: true }).click();
    await page.getByLabel('Neue Aufgabe', { exact: true }).fill('Test: Wochenplan vorbereiten');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    const task = page.getByRole('checkbox', { name: 'Test: Wochenplan vorbereiten' });
    await task.click();
    await expect(task).toHaveAttribute('aria-checked', 'true');
    await expect(task).toBeFocused();
    await task.click();
    await expect(task).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('searchbox', { name: 'Demo-Überblick durchsuchen' }).fill('Wochenplan');
    await expect(page.locator('.search-results')).toContainText('Test: Wochenplan vorbereiten');
    await page.locator('.search-results a').click();
    await expect(page).toHaveURL(/\/demo\/organisation/);
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(privateCalls).toEqual([]);
  });
}

test('authenticated visitors still get isolated demo data', async ({ page }) => {
  const calls: string[] = [];
  await page.route('**/api/**', route => {
    if (/\/(organisation|finanzen|reisen|today)\//.test(route.request().url())) calls.push(route.request().url());
    return route.abort();
  });
  await page.route('**/auth/csrf/', route => route.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/auth/refresh/', route => route.fulfill({ json: { access: 't', user: { name: 'Mira', email: 'mira@example.com' } } }));
  await page.goto('/demo');
  await expect(page.locator('h1')).toContainText('Sophie');
  await page.getByRole('checkbox').first().click();
  await expect(page.getByRole('checkbox').first()).toHaveAttribute('aria-checked', 'true');
  expect(calls).toEqual([]);
});
