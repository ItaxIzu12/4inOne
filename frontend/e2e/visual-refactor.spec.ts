import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 820, 1440]) {
  test(`domain screens and profile menu remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('http://localhost:8000/api/**', (route) => route.abort());
    for (const path of ['/', '/finanzen', '/haushalt', '/organisation', '/reisen']) {
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Kontomenü', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const nav = page.locator(width <= 760 ? '.mobile-nav' : '.sidebar nav');
      await expect(nav.locator('a.active').first()).toHaveAttribute('aria-current', 'page');
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
      ).toEqual([]);
      await page.getByRole('button', { name: 'Kontomenü', exact: true }).click();
      await expect(page.getByRole('menu', { name: 'Konto', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu', { name: 'Konto', exact: true })).not.toBeVisible();
      await page.screenshot({
        path: `test-results/visual-${width}-${path.replaceAll('/', '') || 'dashboard'}.png`,
        fullPage: true,
      });
    }
  });
}
