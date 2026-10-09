import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Kontoauszug-Import in der Demo: Datei wählen → Vorschau → importieren. Die Datei ist wie ein Sparkassen-Export
// aufgebaut (Vorspann, Semikolon, Windows-1252 mit Umlauten).
function iso(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}
function de(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}
function windows1252(text: string): Buffer {
  return Buffer.from(text, 'latin1');
}

for (const width of [390, 1440]) {
  test(`bank statement import with preview at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('http://localhost:8000/api/**', (route) => route.abort());
    await page.goto('/demo/finanzen?tab=transactions');
    await page.getByRole('button', { name: 'Kontoauszug importieren' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Kontoauszug importieren' })).toBeVisible();

    const csv = [
      '"Umsätze Girokonto";"Kontostand"',
      '',
      '"Buchungstag";"Auftraggeber/Empfänger";"Verwendungszweck";"Betrag"',
      `"${de(iso(-2))}";"Bäckerei Müller";"Brötchen";"-4,20"`,
      `"${de(iso(-3))}";"Arbeitgeber";"Bonus";"250,00"`,
      `"${de(iso(-3))}";"Arbeitgeber";"Bonus";"250,00"`,
      `"31.02.2026";"Kaputt";"";"-1,00"`,
    ].join('\r\n');
    await page.locator('#import-file').setInputFiles({ name: 'umsaetze.csv', mimeType: 'text/csv', buffer: windows1252(csv) });

    await expect(dialog.locator('.imp-summary')).toContainText('2 Buchungen neu');
    await expect(dialog.locator('.imp-summary')).toContainText('1 schon vorhanden');
    await expect(dialog.locator('.imp-summary')).toContainText('1 nicht lesbar');
    await expect(dialog.locator('.imp-rows')).toContainText('Bäckerei Müller · Brötchen');
    await expect(dialog.locator('.imp-rows')).toContainText('+250,00 €');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    await dialog.getByRole('button', { name: '2 importieren' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('2 Buchungen importiert.')).toBeVisible();
    await expect(page.locator('main')).toContainText('Bäckerei Müller · Brötchen');

    // Dieselbe Datei noch einmal: alles schon vorhanden, nichts doppelt.
    await page.getByRole('button', { name: 'Kontoauszug importieren' }).click();
    await page.locator('#import-file').setInputFiles({ name: 'umsaetze.csv', mimeType: 'text/csv', buffer: windows1252(csv) });
    await expect(dialog.locator('.imp-summary')).toContainText('0 Buchungen neu');
    await expect(dialog.locator('.imp-summary')).toContainText('3 schon vorhanden');
  });
}

test('a file without date and amount columns gets a clear message', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/finanzen?tab=transactions');
  await page.getByRole('button', { name: 'Kontoauszug importieren' }).click();
  await page.locator('#import-file').setInputFiles({ name: 'liste.csv', mimeType: 'text/csv', buffer: Buffer.from('Name;Telefon\nAnna;123') });
  // Formularfehler erscheinen wie überall als Hinweis (app-error-notice); der Dialog bleibt offen.
  await expect(page.getByText('In der Datei fehlt eine Kopfzeile mit „Datum“ und „Betrag“')).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
});
