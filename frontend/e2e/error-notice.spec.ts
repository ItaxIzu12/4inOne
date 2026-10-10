import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440]) {
  test(`global errors outside modal at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/demo/finanzen?tab=expenses');
    await page.getByRole('button', { name: 'Transaktion erfassen', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    const popup = page.locator('app-error-notice aside');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('Bitte Betrag');
    expect(await popup.evaluate(el => el.closest('[role="dialog"]') === null)).toBe(true);
    await expect(dialog.locator('.modal-form__error')).toHaveCount(0);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await dialog.locator('.modal-close').focus();
    await page.keyboard.press('Tab');
    await expect(popup.getByRole('button')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(popup).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(popup).toBeVisible();
    await page.mouse.move(0, 850);
    await expect(popup).toHaveCount(0, { timeout: 7000 });
    const amount = dialog.locator('#booking-amount');
    await expect(amount).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.locator('.field__error')).toContainText('Bitte Betrag in EUR angeben.');
    await amount.fill('25');
    await expect(amount).not.toHaveAttribute('aria-invalid', 'true');
    await expect(dialog).toBeVisible();
  });
}
