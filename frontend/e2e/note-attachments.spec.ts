import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Notizen › Fotos & PDF (Test 31.10.2026) in der Demo: anhängen, ungültige Typen abweisen, Vorschau auf der Karte,
// wieder entfernen. Typprüfung am Inhalt, Entfernen der Fotodaten und Rechte: backend/organisation/test_notizen_dateien.py.

// Kleinstes gültiges PNG (1 × 1 px)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
});

for (const width of [390, 1440]) {
  test(`a note takes photos and PDFs, shows a preview and can drop them again (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/demo/organisation?tab=notes');
    await page.getByRole('button', { name: /Notiz erstellen/ }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#note-title').fill('Waschmaschine');
    await dialog.getByLabel('Foto oder PDF anhängen').setInputFiles([
      { name: 'typenschild.png', mimeType: 'image/png', buffer: PNG },
      { name: 'anleitung.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') },
      { name: 'notiz.txt', mimeType: 'text/plain', buffer: Buffer.from('x') },
    ]);
    await expect(dialog.locator('.na__tile')).toHaveCount(2);
    await expect(dialog.getByRole('alert')).toContainText('„notiz.txt“: nur Fotos (JPG, PNG, WebP) und PDF.');
    await expect(dialog).toContainText('Wird beim Speichern übernommen.');
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toHaveCount(0);

    const card = page.locator('.note', { hasText: 'Waschmaschine' });
    await expect(card).toContainText('2 Anhänge');
    await expect(card.locator('img')).toHaveCount(1);

    // Entfernen wirkt erst beim Speichern; „Abbrechen“ verwirft
    await card.locator('.note__main').click();
    await dialog.getByRole('button', { name: 'anleitung.pdf entfernen' }).click();
    await dialog.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(card).toContainText('2 Anhänge');
    await card.locator('.note__main').click();
    await dialog.getByRole('button', { name: 'anleitung.pdf entfernen' }).click();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(card).toContainText('1 Anhang');
  });
}
