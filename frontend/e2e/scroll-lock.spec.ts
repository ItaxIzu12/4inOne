import { test, expect, Page } from '@playwright/test';

/** Am Handy: Solange ein Dialog oder ein Blatt von unten offen ist, scrollt die Seite dahinter nicht mit. */
async function scrollY(page: Page) {
  return page.evaluate(() => Math.round(window.scrollY));
}
async function trySwipe(page: Page) {
  await page.mouse.move(195, 300);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(300);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('http://localhost:8000/api/**', (r) => r.abort());
});

test('a dialog locks the page behind it, closing unlocks it again', async ({ page }) => {
  await page.goto('/demo/reisen?trip=1&tab=budget');
  await page.locator('app-trip-budget').getByRole('button', { name: 'Ausgabe erfassen' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const before = await scrollY(page);
  await trySwipe(page);
  expect(await scrollY(page)).toBe(before);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');

  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await trySwipe(page);
  expect(await scrollY(page)).toBeGreaterThan(before);
});

test('the lock stays during the delete question and is released after deleting', async ({ page }) => {
  await page.goto('/demo/reisen?trip=1&tab=budget');
  await page.locator('.exp__row').first().click();
  await page.getByRole('button', { name: 'Ausgabe löschen' }).click();
  await expect(page.getByText('Wirklich löschen?')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  await page.getByRole('button', { name: 'Ja, löschen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
});
