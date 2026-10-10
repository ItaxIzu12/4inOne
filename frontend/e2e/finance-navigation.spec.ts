import { test, expect } from '@playwright/test';

/** Finanzen: Übersicht · Transaktionen · Budgets · Sparziele. Ausgaben und Einnahmen sind Ansichten unter
 * „Transaktionen“ — dieselben Daten wie vorher, nur anders gruppiert. */
test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (r) => r.abort());
});

test('four main tabs; Ausgaben and Einnahmen live under Transaktionen', async ({ page }) => {
  await page.goto('/demo/finanzen');
  await expect(page.locator('nav.tabs button')).toHaveText(['Übersicht', 'Transaktionen', 'Budgets', 'Sparziele']);

  await page.getByRole('button', { name: 'Transaktionen', exact: true }).click();
  const kinds = page.locator('.tx-switch button');
  await expect(kinds).toHaveText(['Alle', 'Ausgaben', 'Einnahmen']);
  await expect(page.locator('.tx-switch [aria-pressed="true"]')).toHaveText('Alle');
  // Alle: Einnahmen und Ausgaben in einer Liste; Sparbeiträge sind keine Buchungen
  const rows = page.locator('#all-rows .transaction');
  await expect(page.locator('#all-rows-h')).toContainText('Alle Transaktionen');
  await expect(rows.filter({ hasText: '−' }).first()).toBeVisible();
  // die Einnahme „Gehalt“ steht in derselben Liste
  await page.getByPlaceholder('Buchung suchen …').fill('Gehalt');
  await expect(rows.filter({ hasText: '+' }).first()).toContainText('Gehalt');
  await page.getByPlaceholder('Buchung suchen …').fill('');
  await expect(page.getByRole('button', { name: 'Transaktion erfassen', exact: true })).toBeVisible();

  await kinds.filter({ hasText: 'Einnahmen' }).click();
  await expect(page.locator('#all-rows-h')).toContainText('Alle Einnahmen');
  await expect(rows.filter({ hasText: '−' })).toHaveCount(0);
  // Eine feste Hauptaktion im ganzen Bereich: „+ Transaktion“ (auf „Einnahmen“ mit vorausgewählter Einnahme).
  await expect(page.getByRole('button', { name: 'Transaktion erfassen', exact: true })).toBeVisible();

  await kinds.filter({ hasText: 'Ausgaben' }).click();
  await expect(page.locator('#all-rows-h')).toContainText('Alle Ausgaben');
  await expect(rows.filter({ hasText: '+' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Transaktion erfassen', exact: true })).toBeVisible();
});

test('old links to the former tabs still land in the right place', async ({ page }) => {
  await page.goto('/demo/finanzen?tab=income');
  await expect(page.locator('nav.tabs [aria-current]')).toHaveText('Transaktionen');
  await expect(page.locator('.tx-switch [aria-pressed="true"]')).toHaveText('Einnahmen');

  await page.goto('/demo/finanzen?tab=transactions&art=expenses');
  await expect(page.locator('.tx-switch [aria-pressed="true"]')).toHaveText('Ausgaben');

  // „Alle anzeigen“ in der Übersicht führt zu Transaktionen › Ausgaben
  await page.goto('/demo/finanzen');
  await page.locator('#tx-h').locator('..').getByRole('button', { name: /Alle anzeigen/ }).click();
  await expect(page.locator('.tx-switch [aria-pressed="true"]')).toHaveText('Ausgaben');
});
