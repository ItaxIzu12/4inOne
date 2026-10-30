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
    // Suche in der Kopfzeile vorerst aus (searchEnabled); die Logik bleibt über ?q= erreichbar.
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    await page.goto('/demo?q=Berlin');
    await expect(page.locator('.search-results')).toContainText('Berlin Wochenende');
    for (const area of ['haushalt', 'organisation', 'reisen']) {
      await page.goto(`/demo/${area}`);
      await expect(page.locator('.topbar--dashboard')).toBeVisible();
      await expect(page.getByRole('searchbox')).toHaveCount(0);
    }
  });
}

// Die große Zahl erklärt sich selbst: aufklappbare Rechnung und (i)-Erklärungen für Fachbegriffe
for (const width of [390, 1440]) {
  test(`„Wie entsteht diese Zahl?“ rechnet vor und erklärt Begriffe at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/**', (route) => route.abort());
    await page.goto('/demo/finanzen');
    const hero = page.locator('.fin-hero').first();
    await hero.getByText('Wie entsteht diese Zahl?').click();
    const calc = hero.locator('.calc .breakdown');
    await expect(calc).toContainText('Monatsbudget');
    await expect(calc).toContainText('Bereits ausgegeben');
    await expect(calc).toContainText('Noch verfügbar');
    const hint = hero.getByRole('button', { name: 'Was bedeutet „Sparbeiträge“?' });
    await hint.click();
    await expect(hint).toHaveAttribute('aria-expanded', 'true');
    await expect(hero.getByRole('status').filter({ hasText: 'Sparbeiträge:' })).toContainText('keine Ausgabe');
    const box = (await hero.locator('.bubble__text').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).include('.fin-hero').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(hint).toHaveAttribute('aria-expanded', 'false');
  });
}

// Anfang des Monats: Rückblick auf den Vormonat (ausblendbar) — und in „Ausgaben“ die Fixkosten mit Jahressumme
for (const width of [390, 1440]) {
  test(`Monatsrückblick und Fixkosten at ${width}px`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-03T10:00:00'));
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/**', (route) => route.abort());
    await page.goto('/demo/finanzen');
    const review = page.locator('section.review');
    await expect(review.getByRole('heading', { level: 2 })).toHaveText('Dein Oktober im Rückblick');
    await expect(review.locator('.review__lead')).toContainText('ausgegeben');
    await expect(review.locator('.review__top li')).toHaveCount(3);
    expect((await new AxeBuilder({ page }).include('section.review').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await review.getByRole('button', { name: 'Ausblenden' }).click();
    await expect(review).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.fin-hero').first()).toBeVisible();
    await expect(page.locator('section.review')).toHaveCount(0);

    await page.getByRole('button', { name: 'Transaktionen', exact: true }).click();
    await page.getByRole('group', { name: 'Transaktionen anzeigen' }).getByRole('button', { name: 'Ausgaben', exact: true }).click();
    const fixed = page.locator('section.fixed-costs');
    await expect(fixed.getByRole('heading', { name: /Fixkosten/ })).toBeVisible();
    await expect(fixed.locator('.fixed-costs__sum')).toContainText(/€\s*pro Monat/);
    await expect(fixed.locator('.fixed-costs__year')).toContainText('Aufs Jahr gerechnet');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
