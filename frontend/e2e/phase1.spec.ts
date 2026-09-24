import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const width of [360, 390, 768, 1440]) {
  test(`phase 1 dashboard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Hallo Sophie!' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width < 761) {
      await expect(page.getByRole('button', { name: /Yoga/ })).toBeVisible();
      await expect(page.locator('.mobile-nav')).toBeVisible();
      await expect(page.locator('.time')).toHaveCount(4);
      await expect(page.locator('.domain p')).toHaveCount(4);
      await expect(page.locator('.trip-progress')).toBeVisible();
    }
    await page.getByRole('button', { name: 'Zur Packliste' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Ausweis & Tickets').check();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Zur Packliste' })).toBeFocused();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.getByRole('heading', { name: 'Hallo Sophie!' }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results/dashboard-${width}.png`, fullPage: true });
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
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login$/);
});
