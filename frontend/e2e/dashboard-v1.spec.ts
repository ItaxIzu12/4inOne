import { expect, test, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Dashboard V1 (docs/DASHBOARD_V1.md): „Was ist heute wichtig?“ — Bereiche, Heute, höchstens ein „Für dich“,
// Schnellerfassung über die bestehenden Formulare.

// Feste Uhrzeit (08:30): „Als Nächstes“, „vorbei“ und „jetzt“ hängen an der Uhr — so prüft der Test immer dasselbe.
const morning = () => new Date(new Date().setHours(8, 30, 0, 0));
async function demo(page: Page, width = 1440) {
  await page.clock.setFixedTime(morning());
  await page.setViewportSize({ width, height: 900 });
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo');
  await expect(page.locator('h1')).toContainText('Sophie');
}

test('no second menu: overdue first, the next appointment on the stage, Demnächst, one "Für dich", one budget figure', async ({ page }) => {
  await demo(page);
  // Keine Bereichskacheln: die Bereiche erreicht man über die Navigation (am Handy unten)
  await expect(page.locator('.domain')).toHaveCount(0);

  // Heute: Überfälliges zuerst und für sich (mit Text, nicht nur Farbe)
  const late = page.locator('.today-list--late .today-row');
  await expect(page.locator('.plan__group--late')).toHaveText('Überfällig');
  await expect(late.first()).toContainText('überfällig');
  await expect(late.first().locator('.time')).toHaveText(/^\d\d\.\d\d\.$/);
  // Als Nächstes: der nächste Termin, der heute noch kommt — mit „in … Std.“
  const lead = page.locator('.today-row--lead');
  await expect(lead.locator('.time')).toHaveText(/^\d\d:\d\d$/);
  await expect(lead).toContainText(/in \d+ (Std|Min)\./);
  // Rest: mit Uhrzeit chronologisch, ohne Uhrzeit danach; nichts doppelt
  const times = await page.locator('#today-list .time').allInnerTexts();
  const clock = times.filter((t) => /^\d\d:\d\d$/.test(t));
  expect(clock).toEqual([...clock].sort());
  const titles = await page.locator('.today-row strong').allInnerTexts();
  expect(new Set(titles).size).toBe(titles.length);
  expect(await page.locator('.today-row').count()).toBeLessThanOrEqual(5);

  // Demnächst: nächste Reise und nächste Frist, je mit Weg dorthin
  const trip = page.locator('.soon__row.travel');
  await expect(trip).toContainText('Berlin');
  await expect(trip).toContainText('in 12 Tagen');
  await expect(trip).toHaveAttribute('href', /\/demo\/reisen\?trip=/);
  // Höchstens ein „Für dich“, eine Budget-Zahl
  await expect(page.locator('.for-you')).toHaveCount(1);
  await expect(page.locator('.budget')).toContainText('übrig');
  // Keine Fotos, keine Diagramme, keine Wetterkarte
  await expect(page.locator('main img, main canvas, main svg.chart')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/Wetter|AI|Automatisch verbunden/);
});

test('quick add: keyboard friendly list of existing forms, Escape closes and returns focus', async ({ page }) => {
  await demo(page);
  const toggle = page.getByRole('button', { name: 'Hinzufügen' }).first();
  await toggle.focus();
  await page.keyboard.press('Enter');
  const list = page.getByRole('list', { name: 'Neu hinzufügen' });
  await expect(list.getByRole('link')).toHaveText(['Transaktion', 'Aufgabe', 'Termin', 'Notiz', 'Einkauf', 'Reise']);
  await expect(list.getByRole('link').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(toggle).toBeFocused();
  // Klick daneben schließt ebenfalls
  await toggle.click();
  await page.locator('h1').click();
  await expect(list).toHaveCount(0);
});

const targets: [string, RegExp, (page: Page) => Promise<void>][] = [
  ['Transaktion', /\/demo\/finanzen/, async (page) => await expect(page.getByRole('dialog').getByRole('heading', { name: 'Transaktion erstellen' })).toBeVisible()],
  ['Aufgabe', /\/demo\/organisation\?tab=tasks/, async (page) => await expect(page.getByRole('dialog').getByRole('heading', { name: 'Aufgabe hinzufügen' })).toBeVisible()],
  ['Termin', /\/demo\/organisation/, async (page) => await expect(page.getByRole('dialog').getByRole('heading', { name: 'Termin hinzufügen' })).toBeVisible()],
  ['Notiz', /\/demo\/organisation\?tab=notes/, async (page) => await expect(page.getByRole('dialog').getByRole('heading', { name: 'Neue Notiz' })).toBeVisible()],
  ['Einkauf', /\/demo\/haushalt\?tab=einkaufen/, async (page) => await expect(page.locator('#new-item-name')).toBeFocused()],
  ['Reise', /\/demo\/reisen/, async (page) => await expect(page.getByRole('dialog').getByRole('heading', { name: 'Reise erstellen' })).toBeVisible()],
];
for (const [label, url, check] of targets) {
  test(`quick add „${label}“ opens the existing form and cleans up the address`, async ({ page }) => {
    await demo(page);
    await page.getByRole('button', { name: 'Hinzufügen' }).first().click();
    await page.getByRole('list', { name: 'Neu hinzufügen' }).getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(url);
    await check(page);
    await expect(page).not.toHaveURL(/neu=/);
  });
}

test('an unknown ?neu= value is ignored instead of opening anything', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/organisation?neu=<script>');
  await expect(page.locator('main h1')).toHaveText('Organisation');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const width of [320, 360, 390, 430, 820, 1280, 1920]) {
  test(`dashboard fits and stays accessible at ${width}px`, async ({ page }) => {
    await demo(page, width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width < 761) {
      await expect(page.locator('.mobile-nav a, .mobile-nav button')).toHaveCount(5);
      // Handy: eine Spalte in der Reihenfolge Heute → Demnächst → Für dich → Budget (kein zweites Menü)
      const tops = await page.locator('.today, .soon, .for-you, .budget').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
      expect(tops).toEqual([...tops].sort((a, b) => a - b));
      await expect(page.locator('.domain')).toHaveCount(0);
      const add = page.getByRole('button', { name: 'Hinzufügen' }).first();
      const box = await add.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  });
}

// ---------- Echtes Konto ----------

const today = new Date();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
async function live(page: Page, financeFails = 0, todayExtra: Record<string, unknown> = {}) {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira', email: 'mira@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true, domains: [] } }));
  await page.route('**/api/v1/today/**', (r) =>
    r.fulfill({
      json: {
        date: iso(today), timezone: 'Europe/Berlin',
        organisation: { date: iso(today), timezone: 'Europe/Berlin', items: [], event_count: 0, open_task_count: 0, overdue_count: 0 },
        haushalt: null, reisen: { current: null, upcoming: null, events: [] },
        finanzen: { month: iso(today).slice(0, 7), budget: null, expenses: '0.00', available: null, spent_today: '0.00' },
        suggestions: [{ key: 'x', kind: 'TRIP_PACKING', title: 'Darf nicht erscheinen', reason: '', trip: { id: 1, title: 'X' }, actions: [], detail: {} }],
        ...todayExtra,
      },
    }),
  );
  let calls = 0;
  await page.route('**/api/v1/finanzen/private/summary/**', (r) => {
    calls++;
    if (calls <= financeFails) return r.fulfill({ status: 500, body: 'Internal Server Error' });
    return r.fulfill({ json: { month: iso(today).slice(0, 7), budget: '2000.00', total: '2000.00', available: '850.00', income: '0.00', expenses: '1150.00', saved: '0.00', recent: [], has_data: true } });
  });
  await page.route('**/api/v1/haushalt/uebersicht/**', (r) =>
    r.fulfill({ json: { summary: { due_today: 0 }, open_tasks: 4, overdue_tasks: 0, today: [], upcoming: [], deadlines: [], shopping: { open_items: 0, preview: [], list_id: null }, open_shopping_items: 0, devices: 0, device_list: [], contracts: 0, contracts_monthly: '0.00', contract_list: [] } }),
  );
  await page.route('**/api/v1/reisen/trips/**', (r) => r.fulfill({ json: [] }));
}

test('a real account without data gets calm empty states, no demo data, no suggestions', async ({ page }) => {
  await live(page);
  const tripRequests: string[] = [];
  page.on('request', (req) => req.url().includes('/reisen/trips/') && tripRequests.push(req.url()));
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Mira');
  await expect(page.locator('.today')).toContainText('Heute ist nichts Dringendes offen');
  await expect(page.locator('.soon')).toContainText('keine Reise und keine Frist');
  await expect(page.locator('.for-you')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/Berlin|Sophie|Darf nicht erscheinen|0 Termine/);
  await expect(page.locator('main a[href^="/demo"]')).toHaveCount(0);
  // Nur bevorstehende Reisen laden, nicht die ganze Historie
  expect(tripRequests.every((url) => url.includes('scope=upcoming'))).toBe(true);
});

test('if one area fails, the rest stays and it can be retried — without technical messages', async ({ page }) => {
  await live(page, 1);
  await page.goto('/');
  await expect(page.locator('.budget')).toContainText('Gerade nicht verfügbar');
  await expect(page.locator('.soon')).toContainText('keine Reise und keine Frist');
  await expect(page.locator('main')).not.toContainText(/500|undefined|Error/);
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page.locator('.budget')).toContainText('850,00 € übrig');
  await expect(page.locator('.partial-error')).toHaveCount(0);
});

test('"Demnächst" shows a placeholder while its sources load, then rows or a calm sentence — no jump from nowhere', async ({ page }) => {
  await live(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/v1/haushalt/uebersicht/**', async (r) => {
    await held;
    await r.fulfill({ json: { summary: { due_today: 0 }, open_tasks: 0, overdue_tasks: 0, today: [], upcoming: [], deadlines: [], shopping: { open_items: 0, preview: [], list_id: null }, open_shopping_items: 0, devices: 0, device_list: [], contracts: 0, contracts_monthly: '0.00', contract_list: [] } });
  });
  await page.goto('/');
  await expect(page.locator('.soon__card--skeleton')).toBeVisible();
  await expect(page.locator('.soon[aria-busy="true"]')).toHaveCount(1);
  release();
  // Nichts Relevantes (keine Frist, keine Reise) → ein ruhiger Satz, kein leerer Rahmen; kein „Für dich“.
  await expect(page.locator('.soon')).toContainText('keine Reise und keine Frist');
  await expect(page.locator('.for-you')).toHaveCount(0);
});

test('the add menu fades in quickly and is fully visible right after opening', async ({ page }) => {
  await demo(page);
  await page.getByRole('button', { name: 'Hinzufügen' }).first().click();
  const list = page.getByRole('list', { name: 'Neu hinzufügen' });
  await expect(list).toBeVisible();
  const duration = await list.evaluate((el) => getComputedStyle(el).animationDuration);
  expect(['0.15s', '150ms']).toContain(duration);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  expect(await list.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
});


test('"Für dich" can show one connection suggestion when nothing else is due — it only links to the object', async ({ page }) => {
  const taskSide = { type: 'TASK', id: 5, title: 'Hotel Berlin bestätigen', subtitle: 'Fällig 05.11.2026', domain: 'organisation' };
  const tripSide = { type: 'TRIP', id: 1, title: 'Berlin', subtitle: 'Berlin, 12.11.2026 – 16.11.2026', domain: 'reisen' };
  await live(page, 0, {
    link_suggestion: {
      key: 'link:TRIP:1:TASK:5', reason_code: 'DATE_AND_CONTEXT_MATCH',
      headline: '„Hotel Berlin bestätigen“ könnte zu deiner Reise „Berlin“ gehören.',
      reason: 'Die Aufgabe erwähnt „Berlin“ und ist kurz vor oder während deiner Reise fällig.',
      relation_label: 'Aufgabe für', source: tripSide, target: taskSide,
    },
  });
  const posts: string[] = [];
  page.on('request', (req) => req.method() === 'POST' && posts.push(req.url()));
  await page.goto('/');
  const card = page.locator('.for-you__card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Das könnte zusammengehören');
  await expect(card).toContainText('„Hotel Berlin bestätigen“ könnte zu deiner Reise „Berlin“ gehören.');
  await expect(card).toContainText('erwähnt „Berlin“');
  await expect(card).not.toContainText(/%|KI|AI/);
  await expect(card).toHaveAttribute('href', '/organisation?kind=task&id=5');
  expect(posts.filter((url) => url.includes('/connections/'))).toEqual([]); // nichts wird von hier aus verknüpft
});
