import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Die öffentliche Vorschau (ohne Anmeldung, siehe app.routes.ts, Demo-Gruppe): Finanzen im aktuellen Design,
 * Organisation und Haushalt jeweils nur mit Demo-Daten, nie mit einem echten Backend-Aufruf — jede Anfrage an die
 * API würde hier mit 401 scheitern und (siehe auth.interceptor.ts) zur Login-Seite umleiten. Das Abbrechen aller
 * API-Aufrufe deckt das zuverlässig auf: bräuchte eine Seite doch das Backend, bliebe sie leer oder würde umleiten. */
async function blockBackend(page: import('@playwright/test').Page) {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
}

test('the preview links to the new Finanzen design (not the older one) with demo data for the current month', async ({ page }) => {
  await blockBackend(page);
  await page.goto('/demo');
  await page.getByRole('link', { name: 'Finanzen' }).first().click();
  await expect(page).toHaveURL(/\/finanzen$/);
  // Reiter des AKTUELLEN Designs (private-finance.html) — die ältere Demo-Seite hatte andere Bezeichner.
  for (const tab of ['Übersicht', 'Transaktionen', 'Budgets', 'Sparziele']) await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
  await expect(page.locator('.kpis')).toContainText('Vom Monatsbudget übrig');
  await expect(page.locator('.budget-empty')).toHaveCount(0); // der laufende Monat hat ein Demo-Budget
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

test('the preview links to Organisation with demo data, never to the login screen', async ({ page }) => {
  await blockBackend(page);
  await page.goto('/demo');
  await page.getByRole('link', { name: 'Organisation' }).first().click();
  await expect(page).toHaveURL(/\/organisation$/);
  await expect(page).not.toHaveURL(/\/login/);
  // Organisation startet im Kalender (keine eigene Übersicht) — mit Demo-Terminen
  await expect(page.locator('#org-tab-calendar')).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Tag', exact: true }).click();
  await expect(page.locator('.agenda__row').getByText('Zahnarzt').first()).toBeVisible(); // Demo-Termin
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

test('visiting the organisation preview directly (no navigation) also works without a login', async ({ page }) => {
  await blockBackend(page);
  await page.goto('/demo/organisation');
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Organisation' })).toBeVisible();
});

test('the preview links to Haushalt with demo data, never to the login screen', async ({ page }) => {
  await blockBackend(page);
  await page.goto('/demo');
  await page.getByRole('link', { name: 'Haushalt' }).first().click();
  await expect(page).toHaveURL(/\/haushalt$/);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Haushalt', exact: true })).toBeVisible();
});

test('the preview links to Reisen with demo data, never to the login screen', async ({ page }) => {
  await blockBackend(page);
  await page.goto('/demo');
  await page.getByRole('link', { name: 'Reisen' }).first().click();
  await expect(page).toHaveURL(/\/reisen$/);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Reisen', exact: true })).toBeVisible();
  // Demo: Meine Reisen zeigt die Berlin-Reise als Karte.
  await expect(page.locator('app-trip-list .trip', { hasText: 'Berlin Wochenende' })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});
