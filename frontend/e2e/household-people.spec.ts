import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Haushalt › wer ist dabei (01.11.2026, Demo: Sophie und Max): Avatare im Seitenkopf, Übersicht „Wer ist dabei?“ und der
// Satz mit Namen in den Dialogen. Wer was sehen darf, prüft das Backend (haushalt/test_ordner*.py, core/test_permission_matrix.py).

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
});

for (const width of [390, 1440]) {
  test(`who is in the household: header avatars, overview and dialog hints (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/demo/haushalt?tab=aufgaben');
    await page.getByRole('button', { name: 'Haushalt: du, Max – wer was sieht' }).click();
    const overview = page.getByRole('dialog', { name: 'Wer ist dabei?' });
    await expect(overview.locator('.hp-members li')).toHaveText([/Sophie \(du\)\s*Admin/, /Max\s*Mitglied/]);
    await expect(overview).toContainText('Sehen alle im Haushalt');
    await expect(overview).toContainText('Beträge bei Verträgen, die du einträgst');
    await expect(overview.getByRole('link', { name: /Verwalten in Personen & Gruppen/ })).toHaveAttribute('href', /\/demo\/familie$/);
    await expect(overview.getByRole('button', { name: 'Person einladen' })).toHaveCount(0); // Demo lädt niemanden ein
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /Aufgabe hinzufügen/ }).first().click();
    await expect(page.getByRole('dialog')).toContainText('Sehen alle im Haushalt: du und Max.');
    await page.keyboard.press('Escape');

    await page.getByRole('tab', { name: /Zuhause/ }).click();
    await page.getByRole('button', { name: /Gerät hinzufügen/ }).first().click();
    await expect(page.getByRole('dialog')).toContainText('Sehen alle Erwachsenen im Haushalt: du und Max.');
  });
}
