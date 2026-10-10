import { test, expect } from '@playwright/test';

for (const width of [320, 360, 390]) {
  test(`mobile domain actions remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.route('http://localhost:8000/api/**', route => route.abort());
    let geometry: number[] | undefined;
    for (const [domain, tab, label] of [
      ['finanzen', 'expenses', 'Transaktion erfassen'], ['haushalt', 'aufgaben', 'Aufgabe hinzufügen'],
      ['organisation', 'calendar', 'Termin hinzufügen'],
    ]) {
      // Haushalt-Übersicht: bewusst kein Hauptknopf — weder im Kopf noch unten. Finanzen hat eine feste
      // Hauptaktion „+ Transaktion“ in allen Reitern (Design System V3). Organisation startet im Kalender.
      await page.goto(`/demo/${domain}`);
      await expect(page.locator('.domain-tabs')).toBeVisible();
      if (domain === 'haushalt') {
        await expect(page.locator('app-mobile-action')).toHaveCount(0);
        await expect(page.locator('.domain-heading button')).toHaveCount(0);
      }
      if (domain === 'finanzen') await expect(page.locator('app-mobile-action button')).toHaveText('Transaktion erfassen');
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
      const sticky = page.locator('.domain-sticky');
      await expect(sticky).toHaveCSS('box-shadow', 'none');
      await expect(sticky).toHaveCSS('border-radius', '16px') // Radius-Skala: --radius-lg;
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

// Reisen V1: Meine Reisen hat keine Reiter, nur „Reise erstellen“ (am Handy unten); in einer Reise vier Reiter in einer
// Zeile, „Bearbeiten“ bleibt im Kopf erreichbar und es gibt keinen schwebenden Knopf.
for (const width of [320, 360, 390]) {
  test(`Reisen: mobile actions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.route('http://localhost:8000/api/**', (route) => route.abort());
    await page.goto('/demo/reisen');
    const action = page.locator('app-mobile-action button');
    await expect(action).toHaveText('Reise erstellen');
    await expect(page.locator('.domain-heading > button')).toBeHidden();
    await expect(page.locator('nav.tabs')).toHaveCount(0);

    await page.goto('/demo/reisen?trip=1&tab=budget');
    const tabs = page.locator('nav.tabs button');
    await expect(tabs).toHaveCount(4);
    const tops = await tabs.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
    expect(new Set(tops).size).toBe(1);
    await expect(tabs.filter({ hasText: 'Budget' })).toHaveAttribute('aria-current');
    await expect(page.locator('app-mobile-action')).toHaveCount(0);
    const edit = page.getByRole('button', { name: 'Reise bearbeiten' });
    await expect(edit).toBeVisible();
    const box = await edit.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
