import { expect, test } from '@playwright/test';
import bwipjs from 'bwip-js/node';

/**
 * Bordkarte gegen das echte Backend (Schritt 1, docs/BORDKARTE_KONZEPT.md): Ein Browser OHNE BarcodeDetector (wie
 * Safari am iPhone) schickt den Screenshot an den Server, der liest den Code (zxing-cpp), speichert nur ihn
 * verschlüsselt und zeigt die Karte. Danach eine PDF-Bordkarte. Offline-Kopie und Abmelden wie bei der Einkaufsliste.
 */
const PASSWORT = 'Testlauf-2026!';
const run = Date.now().toString(36);
const API = 'http://localhost:8010/api/v1';
const CODE = 'M1MUSTER/LENA         EK7X2PQ DUSLISXY 1234 338Y014C00067100';

test('Screenshot ohne BarcodeDetector und PDF: der Server liest den Code', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => delete (window as { BarcodeDetector?: unknown }).BarcodeDetector);
  const page = await context.newPage();
  await page.goto('/registrieren');
  await page.getByLabel('Vorname').fill('Lena');
  await page.getByLabel('E-Mail-Adresse').fill(`lena-bordkarte-${run}@example.test`);
  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORT);
  await page.getByLabel('Passwort wiederholen').fill(PASSWORT);
  await page.getByRole('checkbox').check();
  const registered = page.waitForResponse((r) => r.url().endsWith('/auth/register/') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  const { access } = await (await registered).json();
  await expect(page).not.toHaveURL(/registrieren/, { timeout: 15_000 });

  // Reise direkt über die API anlegen (der Reise-Dialog hat eigene Tests)
  const start = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const trip = await page.request.post(`${API}/reisen/trips/`, {
    headers: { Authorization: `Bearer ${access}` },
    data: { title: 'Lissabon', destination: 'Lissabon', start_date: start, end_date: end, transport_type: 'FLIGHT', status: 'CONFIRMED' },
  });
  expect(trip.status(), await trip.text()).toBe(201);
  const tripId = (await trip.json()).id;

  await page.goto(`/reisen?trip=${tripId}`);
  const card = page.getByRole('region', { name: 'Bordkarten' });
  await expect(card).toBeVisible();

  // Screenshot (PNG mit QR-Code) → Server
  const png = await bwipjs.toBuffer({ bcid: 'qrcode', text: CODE, scale: 6, paddingwidth: 10, paddingheight: 10, backgroundcolor: 'FFFFFF' });
  const uploaded = page.waitForResponse((r) => r.url().includes('/reisen/boarding-passes/') && r.request().method() === 'POST');
  await card.getByLabel('Bordkarte hinzufügen').setInputFiles({ name: 'screenshot.png', mimeType: 'image/png', buffer: png });
  expect((await uploaded).status()).toBe(201);
  const view = page.getByRole('dialog', { name: /DUS.*LIS/ });
  await expect(view.getByText('Lena Muster')).toBeVisible();
  await expect(view.getByText('14C')).toBeVisible();
  await expect(view.getByText('K7••••')).toBeVisible();
  await expect.poll(() => view.getByRole('img', { name: /Code der Airline/ }).evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(50);
  await page.keyboard.press('Escape');

  // PDF-Bordkarte (nur ein Bild des Codes im PDF): ebenfalls über den Server
  const aztec = await bwipjs.toBuffer({ bcid: 'azteccode', text: CODE.replace('LENA   ', 'MAX    '), scale: 4, paddingwidth: 8, paddingheight: 8, backgroundcolor: 'FFFFFF' });
  // PNG im Browser in Graustufen-Pixel zerlegen (kein PNG-Paket nötig)
  const raster = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const rgba = ctx.getImageData(0, 0, c.width, c.height).data;
    const gray: number[] = [];
    for (let i = 0; i < rgba.length; i += 4) gray.push(rgba[i]);
    return { width: c.width, height: c.height, gray };
  }, aztec.toString('base64'));
  const pdfBytes = buildPdfWithImage(raster.width, raster.height, Buffer.from(raster.gray));
  await card.getByLabel('Bordkarte hinzufügen').setInputFiles({ name: 'bordkarte.pdf', mimeType: 'application/pdf', buffer: pdfBytes });
  await expect(page.getByRole('dialog').getByText('Max Muster')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card.getByRole('listitem')).toHaveCount(2);

  // Offline-Kopie auf dem Gerät; Abmelden löscht sie
  await expect.poll(() => page.evaluate(() => localStorage.getItem('4io-offline-bordkarten')?.includes('Lissabon') ?? false)).toBe(true);
  await page.getByRole('button', { name: 'Kontomenü' }).click();
  await page.getByRole('menuitem', { name: 'Abmelden' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('4io-offline-bordkarten'))).toBeNull();
});

/** Minimales einseitiges PDF, das nur ein Bild zeigt (wie ein gescannter Ausdruck), unkomprimiert in Graustufen. */
function buildPdfWithImage(width: number, height: number, gray: Buffer): Buffer {
  const img = { width, height };
  const w = 300;
  const h = Math.round((img.height / img.width) * w);
  const content = `q ${w} 0 0 ${h} 150 400 cm /Im1 Do Q`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n')];
  const offsets: number[] = [];
  let length = parts[0].length;
  const push = (b: Buffer) => {
    parts.push(b);
    length += b.length;
  };
  objects.forEach((body, i) => {
    offsets.push(length);
    push(Buffer.from(`${i + 1} 0 obj\n${body}\nendobj\n`));
  });
  offsets.push(length);
  push(Buffer.from(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${gray.length} >>\nstream\n`));
  push(gray);
  push(Buffer.from('\nendstream\nendobj\n'));
  const xref = length;
  push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  return Buffer.concat(parts);
}
