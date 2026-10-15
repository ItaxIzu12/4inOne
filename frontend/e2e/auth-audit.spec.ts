import { test, expect, Page } from '@playwright/test';

// Authentication-Audit (Beta): Formular-Fehler erst nach dem Absenden, geschützte Routen, verständliche Meldung bei
// zu vielen Versuchen. Backend-Seite: backend/core/test_auth_audit.py.

async function signedOut(page: Page) {
  await page.route('**/api/v1/**', (r) => r.fulfill({ status: 401, json: { detail: 'nicht angemeldet' } }));
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
}

test('Registrierung: keine roten Fehler beim Öffnen oder Verlassen eines Feldes — erst nach dem Absenden, dann live', async ({ page }) => {
  await signedOut(page);
  await page.goto('/registrieren');
  const name = page.getByLabel('Vorname');
  await name.click();
  await page.getByLabel('E-Mail-Adresse').click();
  await page.getByLabel('Passwort', { exact: true }).click();
  await page.getByLabel('Vorname').click();
  await expect(page.locator('.field-error')).toHaveCount(0);

  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page.locator('.field-error').first()).toBeVisible();
  const before = await page.locator('.field-error').count();
  expect(before).toBeGreaterThan(1);
  await expect(name).toHaveAttribute('aria-invalid', 'true');

  // danach live: ein gültiger Name nimmt seinen Fehler sofort weg
  await name.fill('Alex');
  await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  expect(await page.locator('.field-error').count()).toBeLessThan(before);
});

test('Login: Fehler erst nach dem Absenden; zu viele Versuche werden verständlich gemeldet', async ({ page }) => {
  await signedOut(page);
  await page.route('**/api/v1/auth/login/', (r) => r.fulfill({ status: 429, json: { detail: 'Request was throttled.' } }));
  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse').click();
  await page.getByLabel('Passwort', { exact: true }).click();
  await page.getByLabel('E-Mail-Adresse').click();
  await expect(page.locator('.field-error')).toHaveCount(0);

  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.locator('.field-error').first()).toBeVisible();

  await page.getByLabel('E-Mail-Adresse').fill('alex@example.com');
  await page.getByLabel('Passwort', { exact: true }).fill('Falsch123!x');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Zu viele Anmeldeversuche. Bitte warte einen Moment');
});

test('Passwort anzeigen: echter Knopf mit wechselnder Beschriftung', async ({ page }) => {
  await signedOut(page);
  await page.goto('/login');
  const field = page.getByLabel('Passwort', { exact: true });
  await field.fill('geheim');
  await expect(field).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Passwort anzeigen' }).click();
  await expect(field).toHaveAttribute('type', 'text');
  await expect(page.getByRole('button', { name: 'Passwort verbergen' })).toBeVisible();
});

for (const path of ['/finanzen', '/haushalt', '/organisation', '/reisen', '/familie', '/einstellungen', '/einstellungen/profil', '/einstellungen/sitzungen', '/einstellungen/zwei-faktor']) {
  test(`ohne Anmeldung: ${path} führt zur Anmeldung, ohne Daten zu laden`, async ({ page }) => {
    const dataCalls: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/v1/') && !url.includes('/auth/')) dataCalls.push(url);
    });
    await signedOut(page);
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    expect(dataCalls).toEqual([]);
  });
}
