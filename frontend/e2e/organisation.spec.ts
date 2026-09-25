import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440]) {
  test(`private organisation CRUD and calendar ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 'test' } }));
    await page.route('**/api/v1/auth/refresh/', (r) =>
      r.fulfill({ json: { access: 'test', user: { name: 'Mira', email: 'mira@example.com' } } }),
    );
    await page.route('**/api/v1/onboarding/profile/', (r) =>
      r.fulfill({ json: { needs_onboarding: false, completed: true } }),
    );
    let tasks: any[] = [];
    let events: any[] = [];
    let next = 1;
    const now = new Date();
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    await page.route('**/api/v1/organisation/**', async (r) => {
      const url = new URL(r.request().url());
      const method = r.request().method();
      if (url.pathname.endsWith('/today/'))
        return r.fulfill({
          json: {
            date: day,
            items: events.map((e) => ({
              kind: 'event',
              id: e.id,
              title: e.title,
              at: e.starts_at,
              overdue: false,
            })),
            event_count: events.length,
            open_task_count: tasks.filter((t) => t.status !== 'DONE').length,
            overdue_count: 0,
          },
        });
      const isEvent = url.pathname.includes('/events/');
      const list = isEvent ? events : tasks;
      const id = Number(url.pathname.split('/').filter(Boolean).at(-1));
      if (method === 'POST') {
        const item = { id: next++, ...r.request().postDataJSON() };
        list.push(item);
        return r.fulfill({ status: 201, json: item });
      }
      if (method === 'PATCH') {
        const item = list.find((x) => x.id === id);
        Object.assign(item, r.request().postDataJSON());
        return r.fulfill({ json: item });
      }
      if (method === 'DELETE') {
        list.splice(
          list.findIndex((x) => x.id === id),
          1,
        );
        return r.fulfill({ status: 204 });
      }
      return r.fulfill({ json: list });
    });
    await page.goto('/app/organisation');
    await expect(page.getByRole('heading', { name: 'Organisation', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Heute hast du frei geplant' })).toBeVisible();
    await page.getByRole('button', { name: 'Aufgaben', exact: true }).click();
    await page.getByRole('button', { name: 'Aufgabe erstellen', exact: true }).click();
    await page.getByLabel('Titel', { exact: true }).fill('Buch abholen');
    await page.getByLabel('Priorität').selectOption('HIGH');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Buch abholen Offen/ })).toBeVisible();
    await page.getByRole('button', { name: 'Buch abholen erledigen', exact: true }).click();
    await expect(page.getByRole('button', { name: /Buch abholen Erledigt/ })).toBeVisible();
    await page.getByRole('button', { name: 'Buch abholen wieder öffnen', exact: true }).click();
    await page.getByRole('button', { name: /Buch abholen Offen/ }).click();
    await page.getByLabel('Titel', { exact: true }).fill('Buch zurückgeben');
    await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('IN_PROGRESS');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(
      page.getByRole('button', { name: /Buch zurückgeben In Bearbeitung/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: /Buch zurückgeben In Bearbeitung/ }).click();
    await page.getByRole('button', { name: 'Aufgabe löschen', exact: true }).click();
    await page.getByRole('button', { name: 'Ja, löschen', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Keine Aufgaben in dieser Ansicht' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Kalender', exact: true }).click();
    await page.getByRole('button', { name: 'Nächster Monat', exact: true }).click();
    await page.getByRole('button', { name: 'Vorheriger Monat', exact: true }).click();
    await page.locator('.month-grid button[aria-current="date"]').click();
    await page.getByRole('button', { name: 'Termin erstellen', exact: true }).click();
    await page.getByLabel('Titel', { exact: true }).fill('Zahnarzt');
    await page.getByLabel('Beginn', { exact: true }).fill(day + 'T10:00');
    await page.getByLabel('Ort (optional)', { exact: true }).fill('Praxis');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByRole('button', { name: /10:00 Zahnarzt Praxis/ })).toBeVisible();
    await page.getByRole('button', { name: /10:00 Zahnarzt Praxis/ }).click();
    await page.getByLabel('Titel', { exact: true }).fill('Kontrolle');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await page.getByRole('button', { name: 'Heute', exact: true }).click();
    await expect(
      page.locator('.main-card').getByRole('button', { name: /10:00 Kontrolle/ }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `test-results/organisation-${width}.png`, fullPage: true });
    await page.goto('/app');
    await expect(page.locator('.today-row').filter({ hasText: 'Kontrolle' })).toBeVisible();
    await expect(page.locator('.today-row').filter({ hasText: 'Yoga' })).toHaveCount(0);
    await page.locator('.today-row').filter({ hasText: 'Kontrolle' }).click();
    await expect(page.getByRole('heading', { name: 'Termin bearbeiten' })).toBeVisible();
    await page.getByRole('button', { name: 'Termin löschen', exact: true }).click();
    await page.getByRole('button', { name: 'Ja, löschen', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Heute hast du frei geplant' })).toBeVisible();
  });
}
test('organisation rejects unauthenticated navigation', async ({ page }) => {
  await page.goto('/app/organisation');
  await expect(page).toHaveURL(/\/login$/);
});
