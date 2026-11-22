import { expect, test } from '@playwright/test';

/**
 * Offline-Einkaufsliste gegen das echte Backend: Liste einmal mit Netz öffnen → Netz weg → abhaken wird gemerkt →
 * Netz wieder da → die Änderung landet in der Datenbank. Beim Abmelden verschwindet der gespeicherte Stand vom Gerät.
 */
const PASSWORT = 'Testlauf-2026!';
const run = Date.now().toString(36);

test('Einkaufsliste: ohne Netz abhaken, mit Netz übertragen, beim Abmelden vom Gerät löschen', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/registrieren');
  await page.getByLabel('Vorname').fill('Lena');
  await page.getByLabel('E-Mail-Adresse').fill(`lena-offline-${run}@example.test`);
  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORT);
  await page.getByLabel('Passwort wiederholen').fill(PASSWORT);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).not.toHaveURL(/registrieren/, { timeout: 15_000 });

  await page.goto('/haushalt?tab=einkaufen');
  if (/onboarding/.test(page.url())) await page.goto('/haushalt?tab=einkaufen');
  await page.locator('#new-item-name').fill('Hafermilch');
  const added = page.waitForResponse((r) => r.url().includes('/api/v1/haushalt/') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  expect((await added).status()).toBeLessThan(300);
  // Gespeicherter Stand liegt jetzt auf dem Gerät
  await expect.poll(() => page.evaluate(() => localStorage.getItem('4io-offline-einkauf')?.includes('Hafermilch') ?? false)).toBe(true);

  await context.setOffline(true);
  await page.getByRole('button', { name: /Hafermilch abhaken/ }).first().click();
  await expect(page.getByText('Du bist offline.')).toBeVisible();
  await expect(page.getByText('1 Änderung wartet')).toBeVisible();

  const synced = page.waitForResponse((r) => r.url().includes('/api/v1/haushalt/') && r.request().method() === 'PATCH');
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  expect((await synced).status()).toBe(200);
  await expect(page.getByText('1 Änderung von unterwegs übertragen.')).toBeVisible();
  await expect(page.getByText('Du bist offline.')).toHaveCount(0);

  // Mit Netz neu laden: Hafermilch ist auch in der Datenbank abgehakt
  await page.reload();
  await expect(page.getByRole('button', { name: /Hafermilch zurück auf die Liste/ }).first()).toBeVisible();

  // Abmelden löscht den gespeicherten Stand vom Gerät
  await page.getByRole('button', { name: 'Kontomenü' }).click();
  await page.getByRole('menuitem', { name: 'Abmelden' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('4io-offline-einkauf'))).toBeNull();
});
