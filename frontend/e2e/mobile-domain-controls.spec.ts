import { test, expect } from '@playwright/test';

for (const width of [320, 360, 390]) {
  test(`mobile domain actions remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.route('http://localhost:8000/api/**', route => route.abort());
    let geometry: number[] | undefined;
    for (const [domain, label] of [
      ['finanzen', 'Neue Buchung'], ['haushalt', 'Neue Aufgabe'],
      ['organisation', 'Neuer Eintrag'], ['reisen', 'Neue Reise'],
    ]) {
      await page.goto(`/demo/${domain}`);
      const button = page.getByRole('button', { name: label, exact: true }).first();
      await expect(button).toBeVisible();
      const span = button.locator('span');
      await expect(span).toBeHidden();
      const box = await button.boundingBox();
      expect(box?.width).toBe(44);
      expect(box?.height).toBe(44);
      const current = await page.locator('.domain-heading, .domain-tabs').evaluateAll(els =>
        els.flatMap(el => {
          const rect = el.getBoundingClientRect();
          return [rect.x, rect.y, rect.width, rect.height];
        }),
      );
      if (geometry) expect(current).toEqual(geometry);
      geometry = current;
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (domain === 'reisen') {
        const tabs = page.locator('nav.tabs button');
        await expect(tabs).toHaveCount(5);
        const tops = await tabs.evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
        expect(new Set(tops).size).toBe(1);
        await tabs.filter({ hasText: 'Budget' }).click();
        await expect(tabs.filter({ hasText: 'Budget' })).toHaveAttribute('aria-current');
      }
      await page.screenshot({ path: `test-results/mobile-controls-${domain}-${width}.png` });
    }
  });
}
