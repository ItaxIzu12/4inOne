import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Startleitfäden (21.11.2026): neues, leeres Konto — Start und alle vier Bereiche erklären, was man tun kann.
// Backend nachgestellt; ALLE anderen API-Aufrufe werden beantwortet, nie an eine lokal laufende Datenbank geschickt.

const NONE = {
  finanzen: { budget: false, transaction: false, goal: false },
  haushalt: { task: false, shopping: false, folder: false },
  organisation: { event: false, task: false, note: false },
  reisen: { trip: false, packing: false, budget: false, trip_id: null as number | null },
};

async function emptyAccount(page: Page, guide: { areas: typeof NONE; dismissed: string[] } = { areas: NONE, dismissed: [] }) {
  const puts: unknown[] = [];
  await page.route('**/api/v1/**', (r) => {
    const path = new URL(r.request().url()).pathname;
    if (r.request().method() !== 'GET') return r.fulfill({ status: 201, json: {} });
    if (path.endsWith('/haushalt/uebersicht/')) {
      const summary = Object.fromEntries(['open_tasks', 'due_today', 'overdue_tasks', 'recurring_tasks', 'done_this_week', 'open_shopping_items', 'active_lists', 'devices', 'devices_in_repair', 'contracts', 'contracts_expiring', 'upcoming'].map((k) => [k, 0]));
      return r.fulfill({ json: { summary, open_tasks: 0, overdue_tasks: 0, today: [], upcoming: [], deadlines: [], shopping: { open_items: 0, preview: [], list_id: 1 }, open_shopping_items: 0, devices: 0, device_list: [], contracts: 0, contracts_monthly: '0.00', contract_list: [] } });
    }
    if (path.includes('/finanzen/private/summary/')) {
      // so antwortet das Backend einem neuen Konto (leerer Monat)
      const month = new Date().toISOString().slice(0, 7);
      return r.fulfill({ json: { month, currency: 'EUR', budget: null, total: null, saved: '0.00', saved_planned: '0.00', available: null, plan_alert: null, income: '0.00', expenses: '0.00', savings_target: '0.00', savings_current: '0.00', has_data: false, categories: [], recent: [] } });
    }
    return r.fulfill({ json: [] });
  });
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Sophie', email: 'sophie@example.com', home_currency: 'EUR' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true, usage: 'personal', domains: ['finanzen', 'haushalt', 'organisation', 'reisen'] } }));
  await page.route('**/api/v1/notifications/**', (r) => r.fulfill({ json: { unread: 0, items: [] } }));
  await page.route('**/api/v1/invitations/**', (r) => r.fulfill({ json: { received: [], sent: [] } }));
  await page.route('**/api/v1/household/members/', (r) => r.fulfill({ json: { household: { id: 1, name: 'Zuhause' }, members: [], can_invite: true, can_leave: false } }));
  await page.route('**/api/v1/onboarding/guide/', async (r) => {
    if (r.request().method() === 'PUT') {
      const body = r.request().postDataJSON() as { area: string; hidden: boolean };
      puts.push(body);
      guide = { ...guide, dismissed: body.hidden ? [...guide.dismissed, body.area] : guide.dismissed.filter((d) => d !== body.area) };
    }
    await r.fulfill({ json: guide });
  });
  return puts;
}

async function axe(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  expect((await new AxeBuilder({ page }).include('app-start-guide, app-start-overview').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
}
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

const AREAS = [
  { path: '/finanzen', heading: 'So startest du mit Finanzen', first: 'Monatsbudget festlegen' },
  { path: '/haushalt', heading: 'So startest du mit Haushalt', first: 'Erste Aufgabe anlegen' },
  { path: '/organisation', heading: 'So startest du mit Organisation', first: 'Ersten Termin eintragen' },
  { path: '/reisen', heading: 'So startest du mit Reisen', first: 'Erste Reise anlegen' },
];

for (const width of [390, 1440]) {
  test(`leeres Konto bei ${width}px: Start zeigt die vier Bereiche, jeder Bereich seinen Leitfaden`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await emptyAccount(page);
    await page.goto('/');
    const start = page.locator('app-start-overview');
    await expect(start.getByRole('heading', { name: 'Dein Start mit 4inOne' })).toBeVisible();
    await expect(start.locator('.so__row')).toHaveCount(4);
    await expect(start).toContainText('0 von 4 Bereichen eingerichtet');
    expect(await noOverflow(page)).toBe(true);
    await axe(page);
    await page.screenshot({ path: `test-results/leitfaden-start-${width}.png`, fullPage: true, animations: 'disabled' });

    for (const a of AREAS) {
      await page.goto(a.path);
      const guide = page.locator('app-start-guide');
      await expect(guide.getByRole('heading', { name: a.heading })).toBeVisible();
      await expect(guide).toContainText('0 von 3 erledigt');
      await expect(guide.locator('.guide__cta')).toContainText(a.first);
      // ein Hauptweg: kein schwebender Knopf über dem Leitfaden
      await expect(page.locator('app-mobile-action')).toHaveCount(0);
      expect(await noOverflow(page)).toBe(true);
      await axe(page);
      await page.screenshot({ path: `test-results/leitfaden${a.path.replace('/', '-')}-${width}.png`, fullPage: true, animations: 'disabled' });
    }
  });
}

test('Organisation: ohne Tageskopf „ohne Termin“, solange der Leitfaden da ist; Schritt öffnet den Termin', async ({ page }) => {
  await emptyAccount(page);
  await page.goto('/organisation');
  await expect(page.locator('.day-hero')).toHaveCount(0);
  await page.locator('app-start-guide .guide__cta').click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('Ausblenden wird im Konto gespeichert; danach kommt der bisherige Leer-Zustand', async ({ page }) => {
  const puts = await emptyAccount(page);
  await page.goto('/haushalt');
  await page.getByRole('button', { name: 'So startest du mit Haushalt ausblenden' }).click();
  await expect(page.locator('app-start-guide')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Dein Zuhause im Blick' })).toBeVisible();
  expect(puts).toEqual([{ area: 'haushalt', hidden: true }]);
  // anderes Gerät / neu geladen: bleibt weg
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dein Zuhause im Blick' })).toBeVisible();
  await expect(page.locator('app-start-guide')).toHaveCount(0);
});

test('eingerichtete Bereiche verschwinden; Reisen: Packliste öffnet die eigene Reise', async ({ page }) => {
  await emptyAccount(page, { areas: { ...NONE, finanzen: { budget: true, transaction: true, goal: false }, reisen: { trip: true, packing: false, budget: false, trip_id: 7 } }, dismissed: [] });
  await page.goto('/');
  await expect(page.locator('app-start-overview')).toContainText('1 von 4 Bereichen eingerichtet');
  await expect(page.locator('app-start-overview')).toContainText('als Nächstes: Packliste');
  await page.goto('/reisen');
  await page.locator('app-start-guide .guide__cta').click();
  await expect(page).toHaveURL(/trip=7/);
  await expect(page).toHaveURL(/tab=packliste/);
});

test('Demo: nie ein Leitfaden', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (r) => r.abort());
  for (const path of ['/demo', '/demo/finanzen', '/demo/haushalt', '/demo/organisation', '/demo/reisen']) {
    await page.goto(path);
    await page.waitForTimeout(400);
    await expect(page.locator('app-start-guide, app-start-overview')).toHaveCount(0);
  }
});

test('Startseite: keine zweite Budget-Aufforderung neben „Dein Start mit 4inOne“; mit erster Ausgabe kommt die Finanzen-Karte', async ({ page }) => {
  await emptyAccount(page);
  await page.goto('/');
  await expect(page.locator('app-start-overview')).toBeVisible();
  await expect(page.locator('section.money')).toHaveCount(0);
  await expect(page.getByText('Starte mit deinem Monatsbudget')).toHaveCount(0);
});

test('Startseite: Finanzen-Karte bleibt, sobald es eine Ausgabe gibt', async ({ page }) => {
  await emptyAccount(page, { areas: { ...NONE, finanzen: { budget: false, transaction: true, goal: false } }, dismissed: [] });
  await page.goto('/');
  await expect(page.locator('app-start-overview')).toBeVisible();
  await expect(page.locator('section.money')).toHaveCount(1);
});

for (const width of [390, 1440]) {
  test(`Einstellungen bei ${width}px: ausgeblendeten Leitfaden wieder einblenden — gilt danach im Bereich`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/v1/auth/mfa/**', (r) => r.fulfill({ json: { enabled: false } }));
    const puts = await emptyAccount(page, { areas: { ...NONE, finanzen: { budget: true, transaction: true, goal: false } }, dismissed: ['haushalt', 'start', 'finanzen'] });
    await page.goto('/einstellungen');
    const group = page.getByRole('region', { name: 'Startleitfäden' });
    await expect(group).toBeVisible();
    // Finanzen ist eingerichtet: nichts zum Einblenden
    await expect(group.getByRole('button', { name: 'So startest du mit Finanzen wieder einblenden' })).toHaveCount(0);
    await expect(group).toContainText('Eingerichtet – wird nicht mehr gebraucht');
    await expect(group).toContainText('Sichtbar in Organisation');
    expect(await noOverflow(page)).toBe(true);
    expect((await new AxeBuilder({ page }).include('#leitfaeden').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/leitfaden-einstellungen-${width}.png`, fullPage: true, animations: 'disabled' });

    await group.getByRole('button', { name: 'So startest du mit Haushalt wieder einblenden' }).click();
    await expect(group.getByRole('button', { name: 'So startest du mit Haushalt wieder einblenden' })).toHaveCount(0);
    await expect(group).toContainText('Sichtbar in Haushalt');
    expect(puts).toEqual([{ area: 'haushalt', hidden: false }]);

    await page.goto('/haushalt');
    await expect(page.getByRole('heading', { name: 'So startest du mit Haushalt' })).toBeVisible();
  });
}
