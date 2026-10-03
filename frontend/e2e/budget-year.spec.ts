import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440]) {
  test(`budget year accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/demo/finanzen');
    await page.getByRole('button', { name: 'Budgets', exact: true }).click();
    const overview = page.locator('app-budget-year');
    await expect(overview.locator('.budget-month')).toHaveCount(12);
    const year = overview.getByLabel('Jahr', { exact: true });
    await year.focus();
    await year.selectOption(String(new Date().getFullYear() + 1));
    await expect(year).toBeFocused();
    await overview.locator('.budget-month').nth(2).click();
    await expect(overview.locator('.budget-month').nth(2)).toHaveAttribute('aria-pressed', 'true');
    await expect(overview.locator('.budget-month').nth(2)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(overview.locator('.budget-month').nth(3)).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await overview.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/budget-year-${width}.png`, fullPage: true });
  });
}
