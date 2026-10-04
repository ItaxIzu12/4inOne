import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440]) {
  test(`finance overview and shared header at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 1000});
    await page.route('**/api/**', route => route.abort());
    await page.goto('/demo/finanzen');
    await expect(page.locator('.kpis .kpi')).toHaveCount(4);
    await expect(page.locator('.kpi').filter({hasText: 'Einnahmen'})).toBeVisible();
    await expect(page.locator('.statement')).toBeVisible();
    await expect(page.locator('.goals-card')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
    await page.screenshot({path: `test-results/finance-overview-${width}.png`, fullPage: true});
    // Der Bereichskopf scrollt mit (nicht mehr sticky); die globale Kopfzeile bleibt oben.
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect(page.locator('.topbar')).toBeInViewport();
    await page.getByRole('button', {name:'Budgets', exact:true}).click();
    await expect(page.locator('.finance-overview')).toHaveCount(0);
    await page.getByRole('searchbox').fill('Berlin');
    await page.getByRole('searchbox').press('Enter');
    await expect(page).toHaveURL(/\/demo\?q=Berlin/);
    await expect(page.locator('.search-results')).toContainText('Berlin Wochenende');
    await expect(page.getByRole('searchbox')).toHaveValue('Berlin');
    for (const area of ['haushalt', 'organisation', 'reisen']) {
      await page.goto(`/demo/${area}`);
      await expect(page.locator('.topbar--dashboard')).toBeVisible();
      await expect(page.getByRole('searchbox')).toBeVisible();
    }
  });
}
