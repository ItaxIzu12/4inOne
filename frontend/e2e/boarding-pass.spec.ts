import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import bwipjs from 'bwip-js/node';

/**
 * Bordkarte (Schritt 1, docs/BORDKARTE_KONZEPT.md) in der Demo: die Beispielkarte im Sommerurlaub öffnen (echter Code,
 * gezeichnet aus dem IATA-Inhalt), eine Karte per Screenshot hinzufügen (der Code im Bild wird im Browser gelesen) und
 * wieder löschen – plus WCAG-Prüfung der Vollbild-Ansicht hell und dunkel, am Handy und am Rechner.
 */
async function prepare(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((t) => localStorage.setItem('4io-darstellung', t), theme);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
  await page.route('http://localhost:8000/api/**', (r) => r.abort());
}

async function noViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const summary = results.violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }));
  expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
}

for (const width of [390, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`Beispiel-Bordkarte zeigt den echten Code (${width}px, ${theme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await prepare(page, theme);
      await page.goto('/demo/reisen?trip=2');
      const card = page.getByRole('region', { name: 'Bordkarten' });
      await card.getByRole('button', { name: /DUS → VRN/ }).click();
      const view = page.getByRole('dialog', { name: /DUS.*VRN/ });
      await expect(view).toBeVisible();
      await expect(view.getByText('Sophie Muster')).toBeVisible();
      await expect(view.getByText('K7••••')).toBeVisible();
      await expect(view.getByText('K7X2PQ')).toHaveCount(0); // Buchungscode nie im Klartext
      const canvas = view.getByRole('img', { name: /Code der Airline/ });
      await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(50);
      await noViolations(page);
      await page.keyboard.press('Escape');
      await expect(view).toHaveCount(0);
    });
  }
}

test('Bordkarte per Screenshot hinzufügen und löschen (ohne BarcodeDetector: Server, in der Demo ein Hinweis)', async ({ page }) => {
  await prepare(page, 'light');
  await page.goto('/demo/reisen?trip=2');
  const hasDetector = await page.evaluate(() => 'BarcodeDetector' in window);

  // Screenshot einer Bordkarte: QR-Code mit erfundenem IATA-Inhalt
  const buffer = await bwipjs.toBuffer({ bcid: 'qrcode', text: 'M1MUSTER/MAX          EZZ9YQ1 DUSVRNXY 1235 192Y015A00068100', scale: 6, paddingwidth: 10, paddingheight: 10, backgroundcolor: 'FFFFFF' });
  await page.getByLabel('Bordkarte hinzufügen').setInputFiles({ name: 'bordkarte.png', mimeType: 'image/png', buffer });
  if (!hasDetector) {
    // z. B. Safari: der Browser kann Codes in Bildern nicht lesen → in der echten App liest der Server, die Demo erklärt das
    await expect(page.getByRole('status').filter({ hasText: 'Demo' })).toContainText('liest erst die echte App');
    return;
  }

  const view = page.getByRole('dialog');
  await expect(view.getByText('Max Muster')).toBeVisible();
  await expect(view.getByText('15A')).toBeVisible();
  await view.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('button', { name: 'Löschen' })).toBeFocused();
  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('status')).toContainText('Bordkarte gelöscht.');
  await expect(page.getByRole('region', { name: 'Bordkarten' }).getByRole('listitem')).toHaveCount(1);
});

for (const file of [
  { name: 'karte.pkpass', mimeType: 'application/vnd.apple.pkpass' },
  { name: 'karte.pdf', mimeType: 'application/pdf' },
]) {
  test(`${file.name} in der Demo: verständlicher Hinweis statt Fehler`, async ({ page }) => {
    await prepare(page, 'light');
    await page.goto('/demo/reisen?trip=2');
    await page.getByLabel('Bordkarte hinzufügen').setInputFiles({ ...file, buffer: Buffer.from('x') });
    await expect(page.getByRole('status').filter({ hasText: 'Demo' })).toContainText('Die Demo hat keinen Server');
  });
}
