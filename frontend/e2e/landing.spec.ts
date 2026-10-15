import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function session(page: Page, signedIn = false, onboarding = false) {
  let authenticated = signedIn;
  const auth = { access: 'test', user: { name: 'Mira', email: 'mira@example.com' } };
  const domainCalls: string[] = [];
  await page.route('**/api/v1/**', async (r) => {
    const url = new URL(r.request().url()).pathname;
    if (url.endsWith('/auth/csrf/')) return r.fulfill({ json: { csrfToken: 'test' } });
    if (url.endsWith('/auth/refresh/'))
      return r.fulfill({ status: authenticated ? 200 : 401, json: authenticated ? auth : {} });
    if (url.endsWith('/auth/login/') || url.endsWith('/auth/register/')) {
      authenticated = true;
      return r.fulfill({ json: auth });
    }
    if (url.endsWith('/auth/logout/')) {
      authenticated = false;
      return r.fulfill({ status: 204 });
    }
    if (url.endsWith('/onboarding/profile/'))
      return r.fulfill({ json: { needs_onboarding: onboarding, completed: !onboarding } });
    domainCalls.push(url);
    if (url.includes('/today/'))
      return r.fulfill({ json: { items: [], event_count: 0, task_count: 0 } });
    if (url.includes('/summary/'))
      return r.fulfill({
        json: {
          budget: null,
          total: null,
          available: null,
          saved: '0',
          saved_planned: '0',
          income: '0',
          expenses: '0',
          savings_target: '0',
          savings_current: '0',
          categories: [],
          recent: [],
          has_data: false,
        },
      });
    if (url.includes('/haushalt/')) return r.fulfill({ json: { open_tasks: 0 } });
    return r.fulfill({ json: [] });
  });
  return domainCalls;
}

for (const width of [360, 820, 1440]) {
  test(`public landing explains the product before demo at ${width}px`, async ({ page }) => {
    const calls = await session(page);
    await page.setViewportSize({ width, height: 1000 });
    // Axe prüft den Endzustand: ohne Einblend-Animation, sonst misst es den Kontrast halbtransparenter Abschnitte
    // mitten im Übergang (zufällig, je nach Timing).
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Dein Alltag.Alles verbunden.',
    );
    await expect(page.locator('app-dashboard')).toHaveCount(0);
    await expect(page.locator('.demo-banner')).toHaveCount(0);
    expect(calls).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
    await expect(page.getByText('Starte mit dem Bereich, den du brauchst.')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Was zusammengehört, bleibt zusammen.' }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 700));
    expect(Math.abs((await page.locator('.site-head').boundingBox())!.y)).toBeLessThan(2);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results/landing-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Demo testen', exact: true }).first().click();
    await expect(page).toHaveURL('/demo');
    await expect(page.locator('.demo-banner')).toBeVisible();
    await expect(page.getByRole('heading', { name: /^(Guten Morgen|Guten Tag|Guten Abend),? Sophie!$/ })).toBeVisible();
    expect(calls).toEqual([]);
  });
}

test('login returns to root, reload restores real dashboard, logout returns to landing', async ({
  page,
}) => {
  await session(page);
  await page.goto('/login');
  await page.locator('[formControlName="email"]').fill('mira@example.com');
  await page.locator('[formControlName="password"]').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: /^(Guten Morgen|Guten Tag|Guten Abend),? Mira!$/ })).toBeVisible();
  await expect(page.locator('.demo-banner')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: /^(Guten Morgen|Guten Tag|Guten Abend),? Mira!$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Kontomenü' }).click();
  await page.getByRole('menuitem', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('app-landing')).toBeVisible();
});

test('registration routes new accounts to onboarding without app prefix', async ({ page }) => {
  await session(page, false, true);
  await page.goto('/registrieren');
  for (const [field, value] of Object.entries({
    name: 'Mira',
    email: 'mira@example.com',
    password: 'TestPassword123!',
    confirmPassword: 'TestPassword123!',
  }))
    await page.locator(`[formControlName="${field}"]`).fill(value);
  await page.locator('[formControlName="acceptPrivacy"]').check();
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click();
  await expect(page).toHaveURL('/onboarding');
  await expect(page.getByRole('heading', { name: /Willkommen/ })).toBeVisible();
});

test('demo stays isolated for signed-in users and its links stay in demo', async ({ page }) => {
  const calls = await session(page, true);
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: /^(Guten Morgen|Guten Tag|Guten Abend),? Sophie!$/ })).toBeVisible();
  await page.getByRole('link', { name: 'Finanzen', exact: true }).first().click();
  await expect(page).toHaveURL('/demo/finanzen');
  await expect(page.locator('.demo-banner')).toBeVisible();
  expect(calls).toEqual([]);
  await page.goto('/finanzen');
  await expect(page.locator('.demo-banner')).toHaveCount(0);
  await expect(page.getByText('Für', { exact: false }).first()).toBeVisible();
  expect(calls.some((url) => url.includes('/finanzen/private/'))).toBe(true);
});

test('private links require login; legacy bookmarks retain query and fragment', async ({
  page,
}) => {
  await session(page);
  await page.goto('/finanzen');
  await expect(page).toHaveURL('/login');
  await page.goto('/app/finanzen');
  await expect(page).toHaveURL('/login');
  await page.unrouteAll({ behavior: 'wait' });
  await session(page, true);
  await page.goto('/app/finanzen?month=2026-10#budget');
  await expect(page).toHaveURL('/finanzen?month=2026-10#budget');
  await page.goto('/app');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: /^(Guten Morgen|Guten Tag|Guten Abend),? Mira!$/ })).toBeVisible();
});

test('landing: honest product story, four areas as keyboard tabs, privacy principle, real auth links', async ({ page }) => {
  await session(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Kernaussagen in der vorgesehenen Reihenfolge: Verbindung früh, dann Bereiche, Unabhängigkeit, Privatsphäre
  const headings = await page.getByRole('heading', { level: 2 }).allInnerTexts();
  const order = ['Was zusammengehört', 'Vier Bereiche', 'Nutze nur', 'Passende Vorschläge', 'So fühlt sich', 'Verbinde den Zusammenhang', 'Weniger doppelt'];
  expect(order.map((t) => headings.findIndex((h) => h.replace(/\s+/g, ' ').includes(t)))).toEqual([...order.keys()]);
  // Keine erfundenen Behauptungen
  await expect(page.locator('main')).not.toContainText(/KI|AI-|automatisch gebucht|Bank-level|Tausende|Bewertung|Testimonial/);
  // Bereiche als Reiter, per Tastatur wechselbar; das Bild folgt
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(4);
  await tabs.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('tab', { name: /Haushalt/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /Haushalt/ })).toBeFocused();
  await expect(page.getByRole('tabpanel').locator('img:visible')).toHaveAttribute('alt', /Haushalt in 4inOne/);
  // Privatsphäre als Produktprinzip
  await expect(page.locator('#privat')).toContainText('Eine Verbindung erweitert niemals automatisch Zugriffsrechte.');
  // Echte Ziele
  await expect(page.getByRole('link', { name: 'Konto erstellen' }).first()).toHaveAttribute('href', '/registrieren');
  await expect(page.getByRole('link', { name: 'Anmelden' }).first()).toHaveAttribute('href', '/login');
  for (const href of ['/impressum', '/datenschutz', '/barrierefreiheit'])
    await expect(page.locator(`footer a[href="${href}"]`)).toHaveCount(1);
  // Echte Produktbilder mit Alternativtext, nur das erste wird früh geladen
  const imgs = page.locator('main img');
  for (const alt of await imgs.evaluateAll((els) => els.filter((e) => !e.getAttribute('aria-hidden')).map((e) => e.getAttribute('alt') ?? ''))) expect(alt.length).toBeGreaterThan(20);
});

test('landing: the connection can be tried out — both entries show “Verknüpft mit”, focus stays close, undo works', async ({ page }) => {
  await session(page);
  await page.goto('/');
  const stage = page.locator('.link-stage');
  await expect(stage.getByText('noch nichts')).toHaveCount(2);
  await page.getByRole('button', { name: 'Verknüpfen', exact: true }).click();
  await expect(stage.locator('.entry__link')).toHaveText([/Waschmaschine/, /Neue Waschmaschine/]);
  await expect(page.getByRole('button', { name: 'Verbindung entfernen' })).toBeFocused();
  await expect(page.locator('[aria-live="polite"]')).toContainText('Beide Einträge bleiben unverändert');
  await page.keyboard.press('Enter');
  await expect(stage.getByText('noch nichts')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Verknüpfen', exact: true })).toBeFocused();
});
