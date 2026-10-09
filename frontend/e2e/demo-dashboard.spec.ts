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
    // Minimal: Begrüßung, die vier Bereiche und Heute — sonst nichts.
    await expect(page.getByRole('heading', { name: 'Heute', exact: true })).toBeVisible();
    await expect(page.locator('.domain')).toHaveCount(4);
    await expect(page.locator('.tasks, .month, .transactions, .next-trip, main img')).toHaveCount(0);
    // am Handy kurz „Demo“ (neben dem Datum), sonst ausgeschrieben
    if (width < 761) await expect(page.locator('.demo-badge__short')).toBeVisible();
    else await expect(page.getByText('Demo-Modus · Beispieldaten', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/new-demo-${width}.png`, fullPage: true });
    // Die Suche oben findet weiterhin Aufgaben, auch wenn die Startseite sie nicht auflistet.
    await page.getByRole('searchbox', { name: 'Demo-Überblick durchsuchen' }).fill('Geschenk');
    await expect(page.locator('.search-results')).toContainText('Geschenk kaufen');
    await page.locator('.search-results a', { hasText: 'Geschenk kaufen' }).click();
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
  await page.locator('.today-row').first().click();
  await expect(page).toHaveURL(/\/demo\/organisation/);
  expect(calls).toEqual([]);
});
