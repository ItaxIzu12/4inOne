import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Onboarding (Neubau 19.11.2026): Du · Bereiche · erster echter Eintrag · Fertig. Backend nachgestellt; ALLE anderen
// API-Aufrufe werden abgewiesen, damit nie etwas in einer lokal laufenden Datenbank landet.

interface Seen {
  profile?: Record<string, unknown>;
  me?: Record<string, unknown>;
  entry?: { url: string; body: Record<string, unknown> };
}

async function mock(page: Page, seen: Seen) {
  let completed = false;
  await page.route('**/api/v1/**', (r) => r.abort());
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 'test-csrf' } }));
  await page.route('**/api/v1/auth/refresh/', (r) =>
    r.fulfill({ json: { access: 'test-access', user: { name: 'Sophie', email: 'sophie@example.com', home_currency: 'EUR' } } }));
  await page.route('**/api/v1/auth/me/', async (r) => {
    seen.me = r.request().postDataJSON();
    await r.fulfill({ json: { name: 'Sophie Weber', email: 'sophie@example.com', home_currency: 'EUR' } });
  });
  await page.route('**/api/v1/onboarding/profile/', async (r) => {
    if (r.request().method() !== 'GET') {
      seen.profile = r.request().postDataJSON();
      completed = true;
    }
    await r.fulfill({ json: { needs_onboarding: !completed, completed, usage: null, domains: [] } });
  });
  await page.route('**/api/v1/finanzen/private/categories/**', (r) =>
    r.fulfill({ json: [{ id: 3, name: 'Lebensmittel', color: '#17694f' }, { id: 4, name: 'Freizeit', color: '#36608b' }] }));
  for (const path of ['finanzen/private/transactions/', 'haushalt/aufgaben/', 'organisation/tasks/', 'reisen/trips/']) {
    await page.route(`**/api/v1/${path}`, async (r) => {
      seen.entry = { url: r.request().url(), body: r.request().postDataJSON() };
      await r.fulfill({ status: 201, json: { id: 1 } });
    });
  }
}

async function axe(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
}
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

for (const width of [390, 1440]) {
  test(`neues Konto bei ${width}px: Name, Bereiche, erste Ausgabe, fertig — barrierearm`, async ({ page }) => {
    const seen: Seen = {};
    await page.setViewportSize({ width, height: 900 });
    await mock(page, seen);
    await page.goto('/');
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole('heading', { name: 'Willkommen bei 4inOne' })).toBeVisible();
    await expect(page.getByText('Schritt 1 von 3')).toBeVisible();
    await axe(page);
    await page.screenshot({ path: `test-results/onboarding-1-${width}.png`, fullPage: true });

    await page.getByLabel('Wie dürfen wir dich nennen?').fill('Sophie Weber');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByRole('heading', { name: 'Womit möchtest du anfangen?' })).toBeFocused();
    expect(seen.me).toEqual({ name: 'Sophie Weber' });

    await page.getByRole('button', { name: /Reisen/ }).click();
    await page.getByRole('button', { name: /Finanzen/ }).click();
    await expect(page.getByRole('button', { name: /Finanzen/ })).toHaveAttribute('aria-pressed', 'true');
    expect(await noOverflow(page)).toBe(true);
    await axe(page);
    await page.screenshot({ path: `test-results/onboarding-2-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Weiter' }).click();
    expect(seen.profile).toEqual({ usage: 'personal', domains: ['finanzen', 'reisen'] });

    await expect(page.getByRole('heading', { name: 'Deine erste Ausgabe' })).toBeVisible();
    await page.getByLabel('Betrag').fill('12,40');
    await page.getByLabel('Wofür?').fill('Bäcker');
    await page.getByRole('button', { name: 'Freizeit' }).click();
    expect(await noOverflow(page)).toBe(true);
    await axe(page);
    await page.screenshot({ path: `test-results/onboarding-3-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Speichern' }).click();
    expect(seen.entry!.url).toContain('/finanzen/private/transactions/');
    expect(seen.entry!.body).toEqual(expect.objectContaining({ amount: '12.40', category: 4, note: 'Bäcker', type: 'EXPENSE' }));

    await expect(page.getByRole('heading', { name: /Alles bereit/ })).toBeVisible();
    await expect(page.getByText('Bäcker')).toBeVisible();
    await axe(page);
    await page.screenshot({ path: `test-results/onboarding-4-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Zu Finanzen' }).click();
    await expect(page).toHaveURL(/\/finanzen/);
  });
}

test('Bereich für den ersten Eintrag wechseln: Reise mit Zeitraum', async ({ page }) => {
  const seen: Seen = {};
  await mock(page, seen);
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: /Finanzen/ }).click();
  await page.getByRole('button', { name: /Reisen/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('group', { name: 'Bereich für den ersten Eintrag' }).getByRole('button', { name: 'Reisen' }).click();
  await expect(page.getByRole('heading', { name: 'Deine erste Reise' })).toBeVisible();
  await page.getByLabel('Wohin geht es?').fill('Lissabon');
  await page.getByRole('button', { name: 'Speichern' }).click();
  expect(seen.entry!.url).toContain('/reisen/trips/');
  expect(seen.entry!.body).toEqual(expect.objectContaining({ title: 'Lissabon', destination: 'Lissabon' }));
  await expect(page.getByRole('button', { name: 'Zu Reisen' })).toBeVisible();
});

test('Überspringen speichert sinnvolle Standards und führt zur Startseite', async ({ page }) => {
  const seen: Seen = {};
  await mock(page, seen);
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Überspringen' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(seen.profile).toEqual({ usage: 'personal', domains: ['finanzen', 'haushalt', 'organisation', 'reisen'] });
});

test('ohne Eintrag weiter: leerer Start, kein Eintrag gesendet', async ({ page }) => {
  const seen: Seen = {};
  await mock(page, seen);
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: /Haushalt/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByRole('heading', { name: 'Deine erste Haushaltsaufgabe' })).toBeVisible();
  await page.getByRole('button', { name: 'Ohne Eintrag weiter' }).click();
  await expect(page.getByText('Du startest mit einem leeren Arbeitsbereich.')).toBeVisible();
  expect(seen.entry).toBeUndefined();
});
