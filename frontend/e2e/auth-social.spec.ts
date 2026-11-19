import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Anmeldung/Registrierung (Neubau 19.11.2026) mit Google und Apple — Backend nachgestellt (die echte Prüfung von
// state, nonce, PKCE und ID-Token testet backend/core/test_social.py). Alle anderen API-Aufrufe werden abgewiesen.

async function mock(page: Page, opts: { google?: boolean; apple?: boolean; pending?: object } = {}) {
  const { google = true, apple = true, pending = { step: null } } = opts;
  await page.route('**/api/v1/**', (r) => r.abort());
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 'test-csrf' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ status: 401, json: { detail: 'x' } }));
  await page.route('**/api/v1/auth/oauth/providers/', (r) => r.fulfill({ json: { google, apple } }));
  await page.route('**/api/v1/auth/oauth/pending/', (r) => r.fulfill({ json: pending }));
}

async function axe(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
}

for (const width of [375, 1440]) {
  for (const path of ['/login', '/registrieren']) {
    test(`${path} bei ${width}px: Google und Apple oben, E-Mail darunter — barrierearm, ohne Querscrollen`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mock(page);
      await page.goto(path);
      const social = page.getByRole('group', { name: 'Mit einem anderen Konto' }).getByRole('button');
      await expect(social).toHaveText(['Weiter mit Google', 'Weiter mit Apple']);
      await expect(page.getByText('oder mit E-Mail')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await axe(page);
      await page.screenshot({ path: `test-results/auth${path.replace('/', '-')}-${width}.png`, fullPage: true });
    });
  }
}

test('Klick auf „Weiter mit Google“ führt zum Start im Backend (dort beginnt state/nonce/PKCE)', async ({ page }) => {
  await mock(page, { apple: false });
  let started = '';
  await page.route('**/api/v1/auth/oauth/google/start/', (r) => {
    started = r.request().url();
    return r.fulfill({ status: 200, contentType: 'text/html', body: '<p>Google</p>' });
  });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Weiter mit Apple' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Weiter mit Google' }).click();
  await expect.poll(() => started).toContain('/api/v1/auth/oauth/google/start/');
});

test('ohne eingerichtete Anbieter: keine Knöpfe, nur E-Mail', async ({ page }) => {
  await mock(page, { google: false, apple: false });
  await page.goto('/login');
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible();
  await expect(page.getByRole('button', { name: /Weiter mit/ })).toHaveCount(0);
  await expect(page.getByText('oder mit E-Mail')).toHaveCount(0);
});

test('bestehendes Konto: verbinden nur mit Passwort, danach in die App', async ({ page }) => {
  await mock(page, { pending: { step: 'link', provider: 'google', email: 'l•••@example.com', has_password: true } });
  let body: unknown = null;
  await page.route('**/api/v1/auth/oauth/link/', async (r) => {
    body = r.request().postDataJSON();
    await r.fulfill({ json: { access: 'a', user: { name: 'Lena', email: 'lena@example.com' } } });
  });
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  await page.goto('/login?social=verknuepfen');
  await expect(page.getByRole('heading', { name: 'Konto verbinden' })).toBeFocused();
  await expect(page.getByText('l•••@example.com')).toBeVisible();
  await axe(page);
  await page.screenshot({ path: 'test-results/auth-verbinden-1440.png', fullPage: true });
  await page.getByRole('button', { name: 'Verbinden und anmelden' }).click();
  await expect(page.locator('#link-password-error')).toHaveText('Bitte gib dein Passwort ein.');
  await page.getByLabel('Passwort von 4inOne').fill('Sicher123!x');
  await page.getByRole('button', { name: 'Verbinden und anmelden' }).click();
  await expect(page).not.toHaveURL(/\/login/);
  expect(body).toEqual({ password: 'Sicher123!x', mfa_code: '' });
});

test('Zwei-Faktor nach Google: Code-Feld für Passwort-Manager und SMS-Vorschläge, falscher Code wird erklärt', async ({ page }) => {
  await mock(page, { pending: { step: 'mfa', provider: 'apple', email: 'l•••@example.com', has_password: false } });
  await page.route('**/api/v1/auth/oauth/mfa/', (r) => r.fulfill({ status: 401, json: { detail: 'x' } }));
  await page.goto('/login?social=zwei-faktor');
  await expect(page.getByRole('heading', { name: 'Noch ein Schritt' })).toBeVisible();
  const code = page.getByLabel('Code');
  await expect(code).toHaveAttribute('autocomplete', 'one-time-code');
  await expect(code).toHaveAttribute('inputmode', 'numeric');
  await code.fill('12a34 56');
  await expect(code).toHaveValue('123456'); // nur Ziffern, Einfügen erlaubt
  await page.getByRole('button', { name: 'Bestätigen' }).click();
  await expect(page.getByRole('alert')).toContainText('Der Code stimmt nicht');
});

test('Rückkehr mit Fehler: verständlicher Satz, die Adresse wird aufgeräumt', async ({ page }) => {
  await mock(page);
  await page.goto('/login?fehler=email');
  await expect(page.getByRole('alert')).toContainText('keine bestätigte E-Mail-Adresse');
  await expect(page).toHaveURL(/\/login$/);
});

test('Passwort-Anmeldung mit Zwei-Faktor: Code wird geprüft, nicht die Seite neu geladen', async ({ page }) => {
  await mock(page, { google: false, apple: false });
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/api/v1/auth/login/', async (r) => {
    const body = r.request().postDataJSON();
    bodies.push(body);
    await r.fulfill(body.mfa_code ? { json: { access: 'a', user: { name: 'Lena', email: 'lena@example.com' } } } : { json: { mfa_required: true } });
  });
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse').fill('lena@example.com');
  await page.getByLabel('Passwort', { exact: true }).fill('Sicher123!x');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bestätige, dass du es bist' })).toBeFocused();
  await page.getByLabel('Code').fill('654321');
  await page.getByRole('button', { name: 'Bestätigen' }).click();
  await expect(page).not.toHaveURL(/code=/);
  await expect(page).not.toHaveURL(/\/login/);
  expect(bodies.at(-1)).toEqual(expect.objectContaining({ email: 'lena@example.com', mfa_code: '654321' }));
});
