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
      const sticky = page.locator('.domain-sticky');
      await expect(sticky).toHaveCSS('box-shadow', 'none');
      await expect(sticky).toHaveCSS('border-radius', '20px');
      if (domain === 'finanzen') {
        const card = await sticky.boundingBox();
        // Die Kennzahlen beginnen unter dem Kopf (mit der Monatsauswahl), nie darüber oder darin
        const kpis = await page.locator('.finance-page > .kpis').boundingBox();
        expect(kpis!.y).toBeGreaterThanOrEqual(card!.y + card!.height);
      }
      // Die Bereichskarte scrollt mit (nicht mehr sticky); die globale Kopfzeile
      // bleibt, und „Nach oben“ bringt Titel und Reiter zurück.
      await expect(sticky).not.toHaveCSS('position', 'sticky');
      const scrollable = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      if (scrollable > 400) {
        await page.evaluate(() => window.scrollTo(0, 400));
        await expect(page.locator('.topbar')).toBeInViewport();
        await expect(page.locator('.domain-tabs')).not.toBeInViewport();
        const backToTop = page.getByRole('button', { name: 'Nach oben scrollen' });
        await expect(backToTop).toBeVisible();
        // über der unteren Navigation, nicht darauf
        const nav = await page.locator('.mobile-nav').boundingBox();
        const top = await backToTop.boundingBox();
        expect(top!.y + top!.height).toBeLessThanOrEqual(nav!.y);
        await backToTop.click();
        await expect(page.locator('.domain-tabs')).toBeInViewport();
        await expect(button).toBeInViewport();
      }
      await page.screenshot({ path: `test-results/mobile-controls-${domain}-${width}.png` });
    }
  });
}
