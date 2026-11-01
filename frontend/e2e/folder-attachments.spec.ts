import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Haushalt › Zuhause › Gerät: Fotos & PDF beim Anlegen und Bearbeiten (31.10.2026, Demo). Rechte (wer löschen darf),
// Typprüfung und das Entfernen der Fotodaten prüft das Backend: backend/haushalt/test_ordner_anhaenge.py.

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
});

async function openEdit(page: import('@playwright/test').Page, name: string) {
  if (!(await page.locator('.detail.is-open').count())) await page.getByText(name, { exact: true }).first().click();
  await page.locator('.detail').getByRole('button', { name: /^Bearbeiten/ }).first().click();
}

for (const width of [390, 1440]) {
  test(`a device gets photos when added and when edited (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/demo/haushalt?tab=zuhause');
    await page.getByRole('button', { name: /Gerät hinzufügen/ }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').first().fill('Trockner');
    const add = dialog.getByLabel('Foto oder PDF anhängen');
    await add.setInputFiles([
      { name: 'typenschild.png', mimeType: 'image/png', buffer: PNG },
      { name: 'rechnung.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') },
    ]);
    await expect(dialog.locator('.na__tile')).toHaveCount(2);
    await expect(dialog).toContainText('Alle Erwachsenen in deinem Haushalt sehen die Dateien.');
    // Haushaltsfarbe statt Organisationsfarbe
    const [accent, household] = await page.evaluate(() => [
      getComputedStyle(document.querySelector('.na__add')!).color,
      (() => { const probe = document.createElement('span'); probe.style.color = 'var(--household-accent)'; document.body.append(probe); const c = getComputedStyle(probe).color; probe.remove(); return c; })(),
    ]);
    expect(accent).toBe(household);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toHaveCount(0);

    // Bearbeiten: Rechnung entfernen, ein weiteres Foto anhängen
    await openEdit(page, 'Trockner');
    await expect(dialog.locator('.na__name')).toHaveText(['typenschild.png', 'rechnung.pdf']);
    await dialog.getByRole('button', { name: 'rechnung.pdf entfernen' }).click();
    await dialog.getByLabel('Foto oder PDF anhängen').setInputFiles([{ name: 'seite.png', mimeType: 'image/png', buffer: PNG }]);
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toHaveCount(0);
    await openEdit(page, 'Trockner');
    await expect(dialog.locator('.na__name')).toHaveText(['typenschild.png', 'seite.png']);
  });
}
