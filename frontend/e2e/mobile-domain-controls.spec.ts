import { test, expect } from '@playwright/test';

for (const width of [320, 360, 390]) {
  test(`mobile domain actions remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.route('http://localhost:8000/api/**', route => route.abort());
    let geometry: number[] | undefined;
    for (const [domain, tab, label] of [
      ['finanzen', 'expenses', 'Ausgabe erfassen'], ['haushalt', 'aufgaben', 'Neue Aufgabe'],
      ['organisation', 'calendar', 'Termin erstellen'], ['reisen', 'reisen', 'Neue Reise'],
    ]) {
      // Übersicht: bewusst kein Hauptknopf — weder im Kopf noch unten.
      await page.goto(`/demo/${domain}`);
      await expect(page.locator('.domain-tabs')).toBeVisible();
      await expect(page.locator('app-mobile-action')).toHaveCount(0);
      await expect(page.locator('.domain-heading button')).toHaveCount(0);
      if (domain === 'finanzen') {
        // Die Kennzahlen beginnen unter dem Kopf (mit der Monatsauswahl), nie darüber oder darin
        const card = await page.locator('.domain-sticky').boundingBox();
        const kpis = await page.locator('.finance-page > .kpis').boundingBox();
        expect(kpis!.y).toBeGreaterThanOrEqual(card!.y + card!.height);
      }
      await page.goto(`/demo/${domain}?tab=${tab}`);
      // Hauptaktion: am Handy fest unten über der Navigation, mit Text; im Kopf kein zweiter Knopf.
      const button = page.locator('app-mobile-action button');
      await expect(button).toBeVisible();
      await expect(button).toHaveText(label);
      await expect(page.locator('.domain-heading button')).toBeHidden();
      const box = await button.boundingBox();
      const navBox = await page.locator('.mobile-nav').boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(48);
      expect(box!.y + box!.height).toBeLessThanOrEqual(navBox!.y);
      expect(box!.width).toBeGreaterThan(width - 40);
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
        // der Hauptknopf folgt dem Reiter
        await expect(button).toHaveText('Ausgabe erfassen');
        await tabs.filter({ hasText: 'Reisen' }).click();
        // der Reiterwechsel schreibt die Adresse um; erst danach scrollen
        await expect(page).toHaveURL(/tab=reisen/);
        await expect(button).toHaveText('Neue Reise');
      }
      const sticky = page.locator('.domain-sticky');
      await expect(sticky).toHaveCSS('box-shadow', 'none');
      await expect(sticky).toHaveCSS('border-radius', '20px');
      // Die Bereichskarte scrollt mit (nicht mehr sticky); die globale Kopfzeile
      // bleibt, und „Nach oben“ bringt Titel und Reiter zurück.
      await expect(sticky).not.toHaveCSS('position', 'sticky');
      const scrollable = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      if (scrollable > 400) {
        // Nach einem Reiterwechsel stellt der Router die Scrollposition kurz danach zurück — bis dahin wiederholen.
        await expect(async () => {
          await page.evaluate(() => window.scrollTo(0, 400));
          await expect(page.locator('.domain-tabs')).not.toBeInViewport({ timeout: 300 });
        }).toPass();
        await expect(page.locator('.topbar')).toBeInViewport();
        const backToTop = page.getByRole('button', { name: 'Nach oben scrollen' });
        await expect(backToTop).toBeVisible();
        // über dem festen Hauptknopf und der unteren Navigation, nicht darauf
        const action = await button.boundingBox();
        const top = await backToTop.boundingBox();
        expect(top!.y + top!.height).toBeLessThanOrEqual(action!.y);
        await backToTop.click();
        await expect(page.locator('.domain-tabs')).toBeInViewport();
      }
      await page.screenshot({ path: `test-results/mobile-controls-${domain}-${width}.png` });
    }
  });
}
