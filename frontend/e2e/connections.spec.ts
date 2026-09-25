import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const event = { id: 9, title: 'Lieferung', starts_at: '2030-10-12T09:00:00Z', ends_at: null, location: '', description: '' };
const task = { id: 5, title: 'Modelle vergleichen', description: '', due_date: '2030-10-12', due_time: null, priority: 'MEDIUM', status: 'OPEN' };
const goalDto = { id: 7, title: 'Neue Waschmaschine', target_amount: '700.00', current_amount: '480.00', target_date: null, status: 'ACTIVE', currency: 'EUR' };
const summary = (x: object) => ({ month: '2026-09', currency: 'EUR', budget: null, available: null, income: '0.00', expenses: '0.00', savings_target: '700.00', savings_current: '480.00', has_data: true, categories: [], recent: [], ...x });

const asEvent = { type: 'CALENDAR_EVENT', id: 9, title: 'Lieferung', subtitle: '12.10.2030, 11:00 Uhr', domain: 'organisation' };
const asGoal = { type: 'SAVINGS_GOAL', id: 7, title: 'Neue Waschmaschine', subtitle: '480,00 € von 700,00 €', domain: 'finanzen' };

async function mockApi(page: Page, connections: any[]) {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira', email: 'mira@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  await page.route('**/api/v1/organisation/**', (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith('/today/'))
      return r.fulfill({ json: { date: '2026-09-25', timezone: 'Europe/Berlin', items: [], event_count: 1, open_task_count: 1, overdue_count: 0 } });
    return r.fulfill({ json: path.includes('/events/') ? [event] : [task] });
  });
  await page.route('**/api/v1/finanzen/private/**', (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith('/summary/')) return r.fulfill({ json: summary({}) });
    return r.fulfill({ json: path.endsWith('/goals/') ? [goalDto] : [] });
  });
  let nextId = 100;
  await page.route('**/api/v1/connections/**', async (r) => {
    const url = new URL(r.request().url());
    const method = r.request().method();
    if (url.pathname.endsWith('/options/'))
      return r.fulfill({ json: [{ type: 'CALENDAR_EVENT', label: 'Termin', domain: 'organisation', relation_type: 'SCHEDULED_AS' }, { type: 'SAVINGS_GOAL', label: 'Sparziel', domain: 'finanzen', relation_type: 'TASK_FOR' }] });
    if (url.pathname.endsWith('/candidates/')) {
      const linked = connections.some((c) => c.other.id === 9);
      return r.fulfill({ json: linked ? [] : [asEvent] });
    }
    const deleteId = url.pathname.match(/\/connections\/(\d+)\/$/)?.[1];
    if (method === 'DELETE' && deleteId) {
      const index = connections.findIndex((c) => c.id === Number(deleteId));
      if (index >= 0) connections.splice(index, 1);
      return r.fulfill({ status: 204 });
    }
    if (method === 'POST') {
      const body = r.request().postDataJSON();
      const created = { id: nextId++, other: body.target_id === 9 ? asEvent : asGoal };
      connections.push(created);
      return r.fulfill({ status: 201, json: created });
    }
    return r.fulfill({ json: connections.map((c) => ({ ...c, relation_type: 'RELATED_TO', relation_label: 'x', origin: 'MANUAL', created_at: 'now', source: c.other, target: c.other })) });
  });
}

for (const width of [390, 1280]) {
  test(`connect and disconnect a task with an event ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page, []);
    await page.goto('/app/organisation?kind=task&id=5');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Aufgabe bearbeiten' })).toBeVisible();

    // Leerzustand
    await expect(dialog.getByText('Noch nichts verknüpft.')).toBeVisible();

    // Assistent: Was → Womit → Bestätigen
    await dialog.getByRole('button', { name: 'Verbindung hinzufügen' }).click();
    await expect(dialog.getByRole('heading', { name: 'Was möchtest du verbinden?' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Termin', exact: true }).click();
    await dialog.getByRole('button', { name: /Lieferung/ }).click();
    await expect(dialog.getByText('Beide bleiben unverändert')).toBeVisible();
    await dialog.getByRole('button', { name: 'Verknüpfen', exact: true }).click();

    const row = dialog.locator('.connection', { hasText: 'Lieferung' });
    await expect(row).toBeVisible();
    expect((await new AxeBuilder({ page }).include('[role=dialog]').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    // Lösen: beide Objekte bleiben, die Liste aktualisiert sich
    await row.getByRole('button', { name: /lösen/ }).click();
    await expect(dialog.getByText('Noch nichts verknüpft.')).toBeVisible();
  });
}

test('escape closes only the assistant, the surrounding dialog stays open', async ({ page }) => {
  await mockApi(page, []);
  await page.goto('/app/organisation?kind=task&id=5');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Verbindung hinzufügen' }).click();
  await expect(dialog.getByRole('heading', { name: 'Was möchtest du verbinden?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog.getByRole('heading', { name: 'Was möchtest du verbinden?' })).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: 'Aufgabe bearbeiten' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Verbindung hinzufügen' })).toBeFocused();
});

test('a connected object opens directly: same page hop and other page', async ({ page }) => {
  await mockApi(page, [{ id: 1, other: asEvent }, { id: 2, other: asGoal }]);
  await page.goto('/app/organisation?kind=task&id=5');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Aufgabe bearbeiten' })).toBeVisible();
  await expect(page).not.toHaveURL(/kind=/); // Adresse bleibt sauber

  // gleiche Seite: Aufgabe → verknüpfter Termin
  await dialog.getByRole('link', { name: /Lieferung/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Termin bearbeiten' })).toBeVisible();
  await expect(dialog.getByLabel('Titel')).toHaveValue('Lieferung');

  // andere Seite: Sparziel
  await page.goto('/app/finanzen?goal=7');
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Sparziel bearbeiten' })).toBeVisible();
  await expect(page).not.toHaveURL(/goal=/);
});
