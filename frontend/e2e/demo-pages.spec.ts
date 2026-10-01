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
  for (const tab of ['Übersicht', 'Buchungen', 'Budgets', 'Sparziele']) await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
  await expect(page.locator('.month-card')).toContainText('Verfügbares Monatsbudget');
  await expect(page.locator('.month-card')).not.toContainText('kein Budget'); // der laufende Monat hat ein Demo-Budget
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

test('the preview links to Organisation with demo data, never to the login screen', async ({ page }) => {
  await blockBackend(page);
  await page.goto('/demo');
  await page.getByRole('link', { name: 'Organisation' }).first().click();
  await expect(page).toHaveURL(/\/organisation$/);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /Heute,/ })).toBeVisible();
  await expect(page.getByText('Zahnarzttermin')).toBeVisible(); // Demo-Termin
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
  await expect(page.getByRole('heading', { name: 'Haushalt' })).toBeVisible();
});

test('the preview links to Reisen with demo data, never to the login screen', async ({ page }) => {
  await blockBackend(page);
  await page.goto('/demo');
  await page.getByRole('link', { name: 'Reisen' }).first().click();
  await expect(page).toHaveURL(/\/reisen$/);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Reisen', exact: true })).toBeVisible();
  // Demo-Reise: der Detail-Header zeigt das Reiseziel als Überschrift, den Titel darunter (siehe reisen.html).
  await expect(page.getByRole('heading', { name: 'Berlin, Deutschland' })).toBeVisible();
  await expect(page.locator('.trip-detail')).toContainText('Berlin Wochenende');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});
