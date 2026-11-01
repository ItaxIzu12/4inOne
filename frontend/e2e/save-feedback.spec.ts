import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Rückmeldung nach dem Speichern (01.11.2026): helle Karte mit Symbol und ×, schließt nach ~5 s selbst, hält unter
// dem Zeiger an. Rechner oben in der Mitte, Handy oben über die volle Breite.

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
});

for (const width of [390, 1440]) {
  test(`the confirmation looks right, can be closed and goes away by itself (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/demo/haushalt?tab=aufgaben');
    await page.getByRole('button', { name: /als erledigt markieren/ }).first().click();
    const toast = page.locator('.toast.is-visible');
    await expect(toast).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'erledigt' })).toBeVisible();
    const box = (await toast.boundingBox())!;
    if (width < 500) {
      expect(box.y).toBeLessThan(40); // oben
      expect(Math.round(box.width)).toBe(width - 32); // volle Breite, 16 px Rand
    } else {
      expect(box.y).toBeLessThan(40); // oben
      expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(2); // in der Mitte
      expect(Math.round(box.width)).toBe(520);
    }
    expect((await new AxeBuilder({ page }).include('.toast').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'Meldung schließen' }).click();
    await expect(toast).toHaveCount(0);

    // Ohne Zutun nach einigen Sekunden weg
    await page.getByRole('button', { name: /als erledigt markieren/ }).first().click();
    await expect(toast).toBeVisible();
    await expect(toast).toHaveCount(0, { timeout: 9000 });
  });
}
