import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const event = { id: 9, title: 'Lieferung', starts_at: '2030-10-12T09:00:00Z', ends_at: null, location: '', description: '' };
const task = { id: 5, title: 'Modelle vergleichen', description: '', due_date: '2030-10-12', due_time: null, priority: 'MEDIUM', status: 'OPEN' };
const goalDto = { id: 7, title: 'Neue Waschmaschine', target_amount: '700.00', current_amount: '480.00', target_date: null, status: 'ACTIVE', currency: 'EUR' };
const summary = (x: object) => ({ month: '2026-09', currency: 'EUR', budget: null, available: null, income: '0.00', expenses: '0.00', savings_target: '700.00', savings_current: '480.00', has_data: true, categories: [], recent: [], ...x });

const asEvent = { type: 'CALENDAR_EVENT', id: 9, title: 'Lieferung', subtitle: '12.10.2030, 11:00 Uhr', domain: 'organisation' };
const asGoal = { type: 'SAVINGS_GOAL', id: 7, title: 'Neue Waschmaschine', subtitle: '480,00 € von 700,00 €', domain: 'finanzen' };

async function mockApi(page: Page, connections: any[], suggestions: any[] = []) {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira', email: 'mira@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  await page.route('**/api/v1/organisation/**', (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith('/today/'))
      return r.fulfill({ json: { date: '2026-09-25', timezone: 'Europe/Berlin', items: [], event_count: 1, open_task_count: 1, overdue_count: 0 } });
    // Einzelabruf (/events/9/) liefert den Termin selbst, die Liste ein Array — wie die echte API.
    if (/\/events\/\d+\/$/.test(path)) return r.fulfill({ json: event });
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
    if (url.pathname.endsWith('/link-suggestions/')) return r.fulfill({ json: suggestions });
    if (url.pathname.endsWith('/link-suggestions/accept/')) {
      const key = r.request().postDataJSON().key;
      const index = suggestions.findIndex((s) => s.key === key);
      if (index < 0) return r.fulfill({ status: 404, json: { detail: 'Dieser Vorschlag gilt nicht mehr.' } });
      const [taken] = suggestions.splice(index, 1);
      const created = { id: nextId++, other: taken.other };
      connections.push(created);
      return r.fulfill({ status: 201, json: created });
    }
    if (url.pathname.endsWith('/link-suggestions/dismiss/')) {
      const key = r.request().postDataJSON().key;
      suggestions.splice(suggestions.findIndex((s) => s.key === key), 1);
      return r.fulfill({ status: 204 });
    }
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
    return r.fulfill({ json: connections.map((c) => ({ ...c, can_delete: true, relation_type: 'RELATED_TO', relation_label: 'x', origin: 'MANUAL', created_at: 'now', source: c.other, target: c.other })) });
  });
}

for (const width of [390, 1280]) {
  test(`connect and disconnect a task with an event ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page, []);
    await page.goto('/organisation?kind=task&id=5');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Aufgabe bearbeiten' })).toBeVisible();

    // Leerzustand
    await expect(dialog.getByText('Noch nichts verknüpft.')).toBeVisible();

    // Assistent: Was → Womit → Bestätigen
    await dialog.getByRole('button', { name: 'Verknüpfen', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Was möchtest du verbinden?' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Termin', exact: true }).click();
    await dialog.getByRole('button', { name: /Lieferung/ }).click();
    await expect(dialog.getByText('Beide bleiben unverändert')).toBeVisible();
    await dialog.getByRole('button', { name: 'Verknüpfen', exact: true }).click();

    const row = dialog.locator('.connection', { hasText: 'Lieferung' });
    await expect(row).toBeVisible();
    expect((await new AxeBuilder({ page }).include('[role=dialog]').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    // Verbindung entfernen: beide Objekte bleiben, die Liste aktualisiert sich
    await row.getByRole('button', { name: /Verbindung zu „Lieferung“ entfernen/ }).click();
    await expect(dialog.getByText('Noch nichts verknüpft.')).toBeVisible();
  });
}

test('escape closes only the assistant, the surrounding dialog stays open', async ({ page }) => {
  await mockApi(page, []);
  await page.goto('/organisation?kind=task&id=5');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Verknüpfen', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Was möchtest du verbinden?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog.getByRole('heading', { name: 'Was möchtest du verbinden?' })).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: 'Aufgabe bearbeiten' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Verknüpfen', exact: true })).toBeFocused();
});

test('a connected object opens directly: same page hop and other page', async ({ page }) => {
  await mockApi(page, [{ id: 1, other: asEvent }, { id: 2, other: asGoal }]);
  await page.goto('/organisation?kind=task&id=5');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Aufgabe bearbeiten' })).toBeVisible();
  await expect(page).not.toHaveURL(/kind=/); // Adresse bleibt sauber

  // gleiche Seite: Aufgabe → verknüpfter Termin
  await dialog.getByRole('link', { name: /Lieferung/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Termin bearbeiten' })).toBeVisible();
  await expect(dialog.getByLabel('Titel')).toHaveValue('Lieferung');

  // andere Seite: Sparziel
  await page.goto('/finanzen?goal=7');
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Sparziel bearbeiten' })).toBeVisible();
  await expect(page).not.toHaveURL(/goal=/);
});

const asTrip = { type: 'TRIP', id: 1, title: 'Berlin', subtitle: 'Berlin, 12.11.2030 – 16.11.2030', domain: 'reisen' };
const tripSuggestion = () => ({
  key: 'link:TRIP:1:TASK:5', reason_code: 'DATE_AND_CONTEXT_MATCH',
  headline: '„Modelle vergleichen“ könnte zu deiner Reise „Berlin“ gehören.',
  reason: 'Die Aufgabe erwähnt „Berlin“ und ist kurz vor oder während deiner Reise fällig.',
  relation_label: 'Aufgabe für', source: asTrip, target: asTrip, other: asTrip,
});

for (const width of [360, 390, 430, 768, 1024]) {
  test(`a suggestion fits at ${width}px and accepting turns it into a connection`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const connections: any[] = [];
    await mockApi(page, connections, [tripSuggestion()]);
    await page.goto('/organisation?kind=task&id=5');
    const dialog = page.getByRole('dialog');
    const block = dialog.locator('.suggestions');
    await expect(block).toContainText('Das könnte zusammengehören');
    await expect(block).toContainText('Die Aufgabe erwähnt „Berlin“');
    const accept = block.getByRole('button', { name: 'Mit „Berlin“ verknüpfen' });
    const dismiss = block.getByRole('button', { name: 'Vorschlag „Berlin“ ist nicht relevant' });
    await accept.scrollIntoViewIfNeeded();
    for (const button of [accept, dismiss]) {
      const box = (await button.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    expect((await new AxeBuilder({ page }).include('[role=dialog]').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    await accept.focus();
    await page.keyboard.press('Enter');
    await expect(block).toHaveCount(0);
    const row = dialog.locator('.connection', { hasText: 'Berlin' });
    await expect(row).toBeVisible();
    const remove = row.getByRole('button', { name: /Verbindung zu „Berlin“ entfernen/ });
    await expect(remove).toHaveText('Verbindung entfernen');
    const box = (await remove.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
  });
}

test('"Nicht relevant" hides the suggestion and creates nothing', async ({ page }) => {
  const connections: any[] = [];
  await mockApi(page, connections, [tripSuggestion()]);
  await page.goto('/organisation?kind=task&id=5');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Vorschlag „Berlin“ ist nicht relevant' }).click();
  await expect(dialog.locator('.suggestions')).toHaveCount(0);
  await expect(dialog.getByText('Noch nichts verknüpft.')).toBeVisible();
  expect(connections).toEqual([]);
});
