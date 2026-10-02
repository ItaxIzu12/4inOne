import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// „Reise planen“ von Anfang bis Ende: Vorschläge erklären, die Person entscheidet,
// danach steht die Verbindung unter „Verknüpft“. Die API ist nachgebildet wie in
// connections.spec.ts — Regeln und Berechtigungen prüft das Backend selbst
// (backend/connections/tests/test_suggestions.py).

const trip = {
  id: 4, title: 'Lissabon', destination: 'Lissabon', start_date: '2030-11-10', end_date: '2030-11-17', notes: '',
  status: 'PLANNED', travel_type: 'CITY_TRIP', transport_type: 'FLIGHT', baggage_type: '', budget_amount: '900.00',
  currency: 'EUR', created_at: '2030-08-01T10:00:00Z', updated_at: '2030-08-01T10:00:00Z', packing_total: 0,
  packing_packed: 0, tasks_open: 0, tasks_total: 0, events_count: 0, budget_spent: '0.00', participants: [], my_role: 'OWNER',
};

const goalSuggestion = {
  key: 'trip:4:goal', kind: 'TRIP_SAVINGS_GOAL', title: 'Für „Lissabon“ sparen',
  reason: 'Das Budget der Reise ist 900,00 €. Bis zur Abreise am 10.11.2030 bleiben 3 Monate – das sind 300,00 € pro Monat.',
  trip: { id: 4, title: 'Lissabon' }, actions: [{ action: 'create_goal', label: 'Sparziel anlegen' }], detail: {},
};
const choreSuggestion = {
  key: 'trip:4:htask:9', kind: 'TRIP_HOUSEHOLD_TASK', title: '„Blumen gießen“ fällt in deine Reise',
  reason: 'Sie ist jede Woche dran – am 13.11.2030 bist du in Lissabon (10.11.2030–17.11.2030).',
  trip: { id: 4, title: 'Lissabon' },
  actions: [
    { action: 'hand_over', label: 'Jemand anderes übernimmt', needs_member: true },
    { action: 'link', label: 'Nur merken' },
  ],
  detail: { members: [{ id: 2, name: 'Ben' }] },
};

async function mockApi(page: Page) {
  const suggestions = [choreSuggestion, goalSuggestion];
  const connections: unknown[] = [];
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira', email: 'mira@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  await page.route('**/api/v1/reisen/**', (r) => {
    const path = new URL(r.request().url()).pathname;
    return r.fulfill({ json: path.endsWith('/trips/') ? [trip] : [] });
  });
  await page.route('**/api/v1/connections/**', (r) => {
    const url = new URL(r.request().url());
    if (url.pathname.endsWith('/suggestions/accept/')) {
      const body = r.request().postDataJSON();
      const index = suggestions.findIndex((s) => s.key === body.key);
      const [done] = suggestions.splice(index, 1);
      const other = done.kind === 'TRIP_SAVINGS_GOAL'
        ? { type: 'SAVINGS_GOAL', id: 31, title: 'Reise: Lissabon', subtitle: '0,00 € von 900,00 €', domain: 'finanzen' }
        : { type: 'HOUSEHOLD_TASK', id: 9, title: 'Blumen gießen', subtitle: 'Fällig 13.11.2030', domain: 'haushalt' };
      connections.push({
        id: connections.length + 1, relation_type: 'FUNDED_BY', relation_label: 'Finanziert durch', origin: 'SUGGESTED',
        created_at: '2030-08-01T10:00:00Z', source: { type: 'TRIP', id: 4, title: 'Lissabon', subtitle: '', domain: 'reisen' },
        target: other, other,
      });
      const detail = done.kind === 'TRIP_SAVINGS_GOAL'
        ? 'Sparziel „Reise: Lissabon“ angelegt, 300,00 € pro Monat.'
        : `Ben übernimmt „Blumen gießen“.`;
      return r.fulfill({ json: { detail } });
    }
    if (url.pathname.endsWith('/suggestions/')) return r.fulfill({ json: suggestions });
    if (url.pathname.endsWith('/options/')) return r.fulfill({ json: [] });
    return r.fulfill({ json: connections });
  });
}

test('planning a trip: explained suggestions, a decision, and the result stays connected', async ({ page }) => {
  await mockApi(page);
  await page.goto('/reisen?trip=4');

  const plan = page.locator('app-trip-plan');
  await expect(plan.getByRole('heading', { name: 'Nächste Schritte' })).toBeVisible();
  await expect(plan).toContainText('300,00 € pro Monat');
  await expect(plan).toContainText('am 13.11.2030 bist du in Lissabon');
  await page.screenshot({ path: 'test-results/trip-plan-before.png', fullPage: true });

  await plan.getByRole('button', { name: 'Sparziel anlegen' }).click();
  await expect(plan.locator('.trip-plan__done')).toContainText('Sparziel „Reise: Lissabon“ angelegt');
  await expect(plan).not.toContainText('Für „Lissabon“ sparen');
  await expect(plan.locator('app-connections')).toContainText('Reise: Lissabon');

  await plan.getByRole('button', { name: 'Jemand anderes übernimmt' }).click();
  await expect(plan).toContainText('Wer übernimmt?');
  await page.screenshot({ path: 'test-results/trip-plan-after.png', fullPage: true });

  const axe = await new AxeBuilder({ page }).include('app-trip-plan').analyze();
  expect(axe.violations).toEqual([]);
});

test('trip plan works at phone width without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockApi(page);
  await page.goto('/reisen?trip=4');
  await expect(page.locator('app-trip-plan')).toContainText('Für „Lissabon“ sparen');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/trip-plan-mobile.png', fullPage: true });
});
