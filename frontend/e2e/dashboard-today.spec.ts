import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// „Heute“ aus allen Bereichen auf der Startseite. Die API ist nachgebildet wie in
// connections.spec.ts; was jede Person sehen darf, prüft das Backend selbst
// (backend/connections/tests/test_today.py).

const today = new Date();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const at = (h: number) => {
  const d = new Date(today);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);

const overview = {
  date: iso(today),
  timezone: 'Europe/Berlin',
  organisation: {
    date: iso(today), timezone: 'Europe/Berlin', event_count: 1, open_task_count: 0, overdue_count: 0,
    items: [{ kind: 'event', id: 1, title: 'Zahnarzt', at: at(14), overdue: false, location: 'Praxis Dr. Berg' }],
  },
  haushalt: {
    task_count: 2,
    shopping_open: 4,
    tasks: [
      { id: 7, title: 'Müll rausbringen', due_date: iso(yesterday), due_time: null, overdue: true, mine: true },
      { id: 8, title: 'Blumen gießen', due_date: iso(today), due_time: null, overdue: false, mine: false },
    ],
    deadlines: [{ entry_id: 3, art: 'kuendigung', title: 'Kündigen bis: Stromvertrag', date: iso(today), days: 0 }],
  },
  reisen: {
    current: null,
    upcoming: null,
    events: [{ id: 4, trip_id: 9, trip_title: 'Wien', title: 'Zug nach Wien', at: at(9), location: 'Hbf' }],
  },
  finanzen: { month: iso(today).slice(0, 7), budget: '2000.00', expenses: '640.00', available: '1360.00', spent_today: '12.40' },
  suggestions: [
    {
      key: 'trip:9:packing', kind: 'TRIP_PACKING', title: 'Packliste anlegen',
      reason: '„Wien“ beginnt in 3 Tagen, und die Packliste ist noch leer.',
      trip: { id: 9, title: 'Wien' }, actions: [{ action: 'open_packing', label: 'Packliste öffnen', navigate: true }], detail: {},
    },
  ],
};

async function mockApi(page: Page) {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira', email: 'mira@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true, domains: [] } }));
  await page.route('**/api/v1/today/**', (r) => r.fulfill({ json: overview }));
  await page.route('**/api/v1/finanzen/private/summary/**', (r) =>
    r.fulfill({ json: { month: overview.finanzen.month, currency: 'EUR', budget: '2000.00', total: '2000.00', available: '1360.00', expenses: '640.00', income: '0.00', saved: '0.00', saved_planned: '0.00', plan_alert: null, categories: [], recent: [], has_data: true, savings_target: '0.00', savings_current: '0.00' } }),
  );
  await page.route('**/api/v1/haushalt/**', (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith('/haushalt/uebersicht/'))
      return r.fulfill({ json: { open_tasks: 2, overdue_tasks: 1, today: [], upcoming_deadlines: [] } });
    return r.fulfill({ json: [] });
  });
  await page.route('**/api/v1/reisen/**', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/v1/notifications/**', (r) => r.fulfill({ json: [] }));
}

test('Heute mixes every area, overdue first, with one explained suggestion', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');

  const card = page.locator('section.today');
  await expect(card.locator('.today-row strong')).toHaveText([
    'Müll rausbringen', 'Zug nach Wien', 'Zahnarzt', 'Blumen gießen', 'Kündigen bis: Stromvertrag', '4 Sachen auf der Einkaufsliste',
  ]);
  await expect(card).toContainText('Haushalt · überfällig');
  await expect(card.locator('.today-suggestion')).toHaveAttribute('href', '/reisen?trip=9');
  await page.screenshot({ path: 'test-results/dashboard-today.png', fullPage: true });

  const axe = await new AxeBuilder({ page }).include('section.today').analyze();
  expect(axe.violations).toEqual([]);

  await card.getByText('Müll rausbringen').click();
  await expect(page).toHaveURL(/\/haushalt\?tab=aufgaben/);
});

test('Heute works at phone width without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockApi(page);
  await page.goto('/');
  await expect(page.locator('section.today .today-row').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/dashboard-today-mobile.png', fullPage: true });
});
