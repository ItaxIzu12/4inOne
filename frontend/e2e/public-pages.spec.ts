import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Öffentliche Seiten ohne Anmeldung: 404, Titel/Beschreibung, Teilen-Vorschau, robots.txt. */
async function visitor(page: Page) {
  await page.route('**/api/v1/**', async (r) => {
    const url = new URL(r.request().url()).pathname;
    if (url.endsWith('/auth/csrf/')) return r.fulfill({ json: { csrfToken: 'test' } });
    if (url.endsWith('/auth/refresh/')) return r.fulfill({ status: 401, json: {} });
    return r.fulfill({ status: 204 });
  });
}

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((v) => v.id);

test('the contact page no longer exists: /kontakt shows the 404 page', async ({ page }) => {
  await visitor(page);
  await page.goto('/kontakt');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Diese Seite gibt es nicht.');
  await expect(page.locator('a[href="/kontakt"]')).toHaveCount(0);
});

test('unknown addresses show a 404 page that search engines do not index', async ({ page }) => {
  await visitor(page);
  await page.goto('/gibt-es-nicht');
  await expect(page).toHaveURL(/\/gibt-es-nicht$/);
  await expect(page).toHaveTitle('Seite nicht gefunden | 4inOne');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Diese Seite gibt es nicht.');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  expect(await axe(page)).toEqual([]);
  await page.getByRole('link', { name: 'Zur Startseite' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test('legal pages have their own title and no app navigation; footer links are large enough to tap', async ({ page }) => {
  await visitor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, title] of [
    ['/impressum', 'Impressum | 4inOne'],
    ['/datenschutz', 'Datenschutzerklärung | 4inOne'],
    ['/nutzungsbedingungen', 'Nutzungsbedingungen | 4inOne'],
    ['/barrierefreiheit', 'Barrierefreiheit | 4inOne'],
  ]) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('app-bottom-nav, app-header')).toHaveCount(0);
  }
  const links = page.getByRole('navigation', { name: 'Rechtliches' }).getByRole('link');
  await expect(links).toHaveCount(4);
  // Rechtsseiten im Stil der Startseite: Hausschrift, keine Kursive, warmweißer Grund
  expect(await page.locator('h1').evaluate((h) => getComputedStyle(h).fontFamily)).toContain('Schibsted Grotesk');
  expect(await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).fontStyle === 'italic').length)).toBe(0);
  expect(await page.locator('app-public-shell').evaluate((h) => getComputedStyle(h).backgroundColor)).toBe('rgb(247, 247, 244)'); // Porcelain (Soft Editorial)
  for (const box of await links.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
    expect(box).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('share preview, touch icon and robots.txt are in place', async ({ page, request }) => {
  await visitor(page);
  await page.goto('/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-image\.png$/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /^apple-touch-icon\.png(\?v=\d+)?$/); // ?v= erzwingt das Neuladen gespeicherter Symbole
  for (const file of ['/og-image.png', '/apple-touch-icon.png']) {
    const response = await request.get(file);
    expect(response.headers()['content-type']).toContain('image/png');
  }
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /einladung');
  expect(robots).toContain('Disallow: /api/');
});
