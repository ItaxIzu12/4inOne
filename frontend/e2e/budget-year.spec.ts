import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [360, 390, 430, 1440]) {
  test(`budgets: compact screen, year overview in a dialog at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/demo/finanzen?tab=budgets');
    // Eine Kopfkarte mit zwei Teilen: Budget und Rest. Die Aufschlüsselung erklärt den Rest — ausgegeben und
    // Sparbeiträge getrennt benannt
    await expect(page.locator('.fin-hero--budget .fin-hero__top > .kpi')).toHaveCount(2);
    const calc = page.locator('.kpi--left .breakdown');
    await expect(calc).toContainText('Bereits ausgegeben');
    await expect(calc).toContainText('Sparbeiträge');
    await expect(calc).toContainText('Verfügbar');
    await expect(page.getByRole('progressbar', { name: 'Monatsbudget verbraucht' })).toBeVisible();
    await expect(page.getByText('Bereits verbraucht')).toHaveCount(0);
    // Kategorie-Budgets: Name und Beträge liegen nie übereinander
    const overlap = await page.locator('.budget-row').evaluateAll((rows) =>
      rows.some((row) => {
        const n = row.querySelector('.budget-row__head')!.getBoundingClientRect();
        const m = row.querySelector('.budget-row__nums')!.getBoundingClientRect();
        return n.width < 60 || !(n.bottom <= m.top + 1 || m.right <= n.left || n.right <= m.left);
      }),
    );
    expect(overlap).toBe(false);
    // Kein Donut „Budget-Nutzung“, keine dauerhafte Jahresliste
    await expect(page.getByText('Budget-Nutzung')).toHaveCount(0);
    await expect(page.locator('app-budget-year')).toHaveCount(0);
    // Kategorie-Status in Worten
    await expect(page.locator('.budget-row__status').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    await page.getByRole('button', { name: 'Budgets je Monat', exact: true }).click();
    const overview = page.locator('app-budget-year');
    await expect(overview.locator('.budget-month')).toHaveCount(12);
    // Erst nach dem Einblenden prüfen (während der Animation sind die Farben noch gedimmt)
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    const year = overview.getByLabel('Jahr', { exact: true });
    await year.focus();
    await year.selectOption(String(new Date().getFullYear() + 1));
    // Jahreswechsel: der Dialog bleibt offen, der Fokus bei der Jahresauswahl
    await expect(year).toBeFocused();
    await expect(overview.locator('h2')).toContainText(String(new Date().getFullYear() + 1));
    expect((await new AxeBuilder({ page }).include('app-budget-year').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    // Monat wählen: Dialog zu, der Monat wird angezeigt
    await overview.locator('.budget-month').nth(2).click();
    await expect(overview).toHaveCount(0);
    await expect(page.locator('.kpi__hint').first()).toContainText(`für März ${new Date().getFullYear() + 1}`);
  });
}

test('a month without budget shows no artificial numbers, only a way to set one', async ({ page }) => {
  await page.goto('/demo/finanzen?tab=budgets');
  await page.getByRole('button', { name: 'Budgets je Monat', exact: true }).click();
  await page.locator('app-budget-year .budget-month').first().click();
  await expect(page.getByRole('heading', { name: /Noch kein Budget für Januar/ })).toBeVisible();
  await expect(page.getByText('Vom Monatsbudget übrig')).toHaveCount(0);
  await expect(page.getByText('Budget gebunden')).toHaveCount(0);
  await expect(page.getByText(/über (dem )?Budget/)).toHaveCount(0);
  // Genau ein Einstieg, kein zweiter Knopf im Kopf oder unten
  await expect(page.getByRole('button', { name: 'Budget festlegen' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Budget festlegen' }).click();
  await expect(page.getByRole('dialog')).toContainText('Budget erstellen');
});

// „Dein Jahr“: zwölf Säulen (Budget als Umriss, Ausgaben als Füllung), Antippen zeigt den Monat
for (const width of [320, 360, 390, 1440]) {
  test(`budgets: „Dein Jahr“ shows spending against budget per month at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/demo/finanzen?tab=budgets');
    const year = new Date().getFullYear();
    const card = page.locator('app-budget-year-card');
    await expect(card.getByRole('heading', { level: 2 })).toHaveText(`Dein Jahr ${year}`);
    await expect(card.locator('.year__total b')).toHaveText(/^[\d.]+\s€$/);
    await expect(card.locator('.year__total')).toContainText('ausgegeben');
    await expect(card.locator('.year__verdict')).toHaveText(/^(In \d+ von \d+ Monaten? im Budget geblieben|Noch kein abgeschlossener Monat mit Budget)$/);
    const bars = card.locator('.bar');
    await expect(bars).toHaveCount(12);
    await expect(card.locator('.bar[aria-current="true"]')).toHaveClass(/bar--current/);
    // Jede Säule erklärt sich in Worten (nicht nur über Farbe)
    expect(await bars.first().getAttribute('aria-label')).toMatch(new RegExp(`^Januar ${year}, .+\\. Monat anzeigen$`));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Eine Reihe, eine Zeitachse: alle Säulen auf derselben Höhe. Trefferfläche hoch genug und ab 360 px mindestens
    // 24 px breit (WCAG 2.2 Zielgröße); darunter gilt die Ausnahme „gleichwertige Bedienung“ (Monatsauswahl, Dialog).
    const tops = new Set<number>();
    for (const bar of await bars.all()) {
      const box = (await bar.boundingBox())!;
      tops.add(Math.round(box.y));
      expect(box.height).toBeGreaterThanOrEqual(44);
      if (width >= 360) expect(box.width).toBeGreaterThanOrEqual(24);
    }
    expect(tops.size).toBe(1);
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    expect((await new AxeBuilder({ page }).include('app-budget-year-card').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    // Ein abgeschlossener Monat: angezeigt wird er oben, die Säule bleibt markiert und fokussiert
    const held = card.locator('.bar--held').first();
    const name = (await held.getAttribute('aria-label'))!.split(',')[0];
    await held.click();
    await expect(page.locator('.fin-hero--budget .kpi__hint').first()).toContainText(`für ${name}`);
    await expect(held).toHaveAttribute('aria-current', 'true');
    await expect(held).toBeFocused();
    await expect(page.locator('.fin-hero--budget')).toBeInViewport();

    // Bearbeiten bleibt im Dialog
    await card.getByRole('button', { name: 'Budgets je Monat', exact: true }).click();
    await expect(page.getByRole('dialog', { name: /Budgets je Monat/ })).toBeVisible();
  });
}

// „Budgets je Monat“ am Handy und in niedrigen Fenstern: Kopf bleibt stehen, die Monatsliste scrollt —
// alle zwölf Monate sind erreichbar, der angezeigte Monat ist beim Öffnen sichtbar
for (const [width, height] of [[320, 568], [375, 667], [1280, 560]]) {
  test(`budgets: „Budgets je Monat“ reaches every month at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/demo/finanzen?tab=budgets');
    await page.locator('app-budget-year-card').getByRole('button', { name: 'Budgets je Monat', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: /Budgets je Monat/ });
    await expect(dialog).toBeVisible();
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    const box = (await dialog.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    expect(box.width).toBeLessThanOrEqual(width);
    await expect(dialog.locator('.budget-month.is-selected')).toBeInViewport({ ratio: 1 });
    const december = dialog.locator('.budget-month').last();
    await december.scrollIntoViewIfNeeded();
    await expect(december).toBeInViewport({ ratio: 1 });
    await expect(dialog.getByLabel('Jahr', { exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
