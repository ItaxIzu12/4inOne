import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
// Grundgerüst des Demo-Dashboards in allen Breiten; die Inhalte selbst prüft demo-dashboard.spec.ts.
for (const width of [360, 390, 768, 1440]) {
  test(`phase 1 dashboard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('http://localhost:8000/api/**', (route) => route.abort());
    await page.goto('/demo');
    // Die Begrüßung folgt der Tageszeit (Guten Morgen / Hallo / Guten Abend).
    await expect(page.getByRole('heading', { name: /^(Guten Morgen|Guten Tag|Guten Abend),? Sophie!$/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width < 761) await expect(page.locator('.mobile-nav')).toBeVisible();
    for (const area of ['Finanzen', 'Haushalt', 'Organisation', 'Reisen']) {
      await expect(page.locator('main').getByRole('link', { name: new RegExp(area) }).first()).toBeVisible();
    }
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}
for (const path of ['/login', '/registrieren']) {
  test(`${path} mobile form`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.screenshot({ path: `test-results/${path.slice(1)}-390.png`, fullPage: true });
  });
}
test('protected dashboard redirects without a session', async ({ page }) => {
  await page.goto('/finanzen');
  await expect(page).toHaveURL(/\/login$/);
});
