import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { choose } from './helpers';

/** Eigene Kategorien im Reiter Budgets und direkt im Buchungsformular — mit den Demo-Daten (kein Backend). */
for (const width of [390, 1440]) {
  test(`own categories can be managed ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('http://localhost:8000/api/**', (route) => route.abort());
    await page.goto('/demo');
    await page.getByRole('link', { name: 'Finanzen' }).first().click();
    await page.getByRole('button', { name: 'Budgets', exact: true }).click();
    await page.getByRole('button', { name: 'Kategorien verwalten', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Kategorien verwalten' })).toBeVisible();

    // „Sonstiges“ bleibt: Name fest, kein Löschen
    await expect(dialog.getByLabel('Name Sonstiges')).toHaveAttribute('readonly', '');
    await expect(dialog.getByRole('button', { name: 'Sonstiges löschen' })).toHaveCount(0);

    // doppelter Name wird vor dem Speichern abgefangen
    await dialog.getByRole('button', { name: 'Eigene Kategorie hinzufügen' }).click();
    await expect(dialog.getByLabel('Name Neue Kategorie')).toBeFocused();
    await dialog.getByLabel('Name Neue Kategorie').fill('wohnen');
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.locator('app-error-notice')).toContainText('gibt es doppelt');

    await dialog.getByLabel('Name Neue Kategorie').fill('Haustier');
    await dialog.getByLabel('Limit Neue Kategorie in EUR').fill('60');
    await dialog.getByLabel('Name Freizeit').fill('Freizeit & Hobby');
    await dialog.getByRole('button', { name: 'Gesundheit löschen' }).click();
    await expect(dialog.locator('.is-removed')).toContainText(/Buchungen? wander(t|n) zu „Sonstiges“/);
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Kategorien gespeichert' })).toContainText(
      'Kategorien gespeichert: 1 neu angelegt, 1 umbenannt, 1 gelöscht.',
    );
    const budgets = page.locator('section[aria-labelledby="catbudget-h"]');
    await expect(budgets).toContainText('Haustier');
    await expect(budgets).toContainText('Freizeit & Hobby');
    await expect(budgets).not.toContainText('Gesundheit');

    // Neue Kategorie direkt beim Buchen anlegen und gleich auswählen
    await page.getByRole('button', { name: 'Neue Buchung', exact: true }).first().click();
    await page.getByRole('button', { name: 'Neue Kategorie', exact: true }).click();
    await expect(page.getByLabel('Name der neuen Kategorie')).toBeFocused();
    await page.getByLabel('Name der neuen Kategorie').fill('Geschenke');
    await page.getByLabel('Name der neuen Kategorie').press('Enter');
    await expect(page.getByLabel('Name der neuen Kategorie')).toHaveCount(0);
    await expect(page.getByRole('dialog').getByLabel('Kategorie', { exact: true })).toContainText('Geschenke');
    // Vorhandener Name wird einfach ausgewählt statt doppelt angelegt
    await page.getByRole('button', { name: 'Neue Kategorie', exact: true }).click();
    await page.getByLabel('Name der neuen Kategorie').fill('haustier');
    await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
    await expect(page.getByRole('dialog').getByLabel('Kategorie', { exact: true })).toContainText('Haustier');
    await choose(page, 'Kategorie', 'Geschenke');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
