import { test, expect, Page } from '@playwright/test';
import { choose } from './helpers';
import AxeBuilder from '@axe-core/playwright';

/** Organisation mit nachgebauter API (eingeloggt, /organisation): Termine, Aufgaben, Notizen und Dateien. */
async function mockApi(page: Page) {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 'test' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 'test', user: { name: 'Mira', email: 'mira@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  const data: Record<string, any[]> = { events: [], tasks: [], notes: [], files: [] };
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
          items: data['events'].map((e) => ({ kind: 'event', id: e.id, title: e.title, at: e.starts_at, overdue: false })),
          event_count: data['events'].length,
          open_task_count: data['tasks'].filter((t) => t.status !== 'DONE').length,
          overdue_count: 0,
        },
      });
    if (url.pathname.endsWith('/files/speicher/')) return r.fulfill({ json: { used: 0, quota: 524288000 } });
    const parts = url.pathname.split('/').filter(Boolean);
    const resource = parts[3];
    const list = data[resource] ?? [];
    const id = Number(parts[4]);
    if (method === 'POST') {
      const stamp = new Date().toISOString();
      const item = { id: next++, project: '', category: 'sonstiges', pinned: false, ...r.request().postDataJSON(), created_at: stamp, updated_at: stamp };
      list.push(item);
      return r.fulfill({ status: 201, json: item });
    }
    if (method === 'PATCH') {
      const item = list.find((x) => x.id === id);
      Object.assign(item, r.request().postDataJSON(), { updated_at: new Date().toISOString() });
      return r.fulfill({ json: item });
    }
    if (method === 'DELETE') {
      list.splice(list.findIndex((x) => x.id === id), 1);
      return r.fulfill({ status: 204 });
    }
    return r.fulfill({ json: list });
  });
  await page.route('**/api/v1/today/**', (r) =>
    r.fulfill({
      json: {
        date: day, timezone: 'Europe/Berlin',
        organisation: { date: day, items: [], event_count: 0, open_task_count: 0, overdue_count: 0 },
        haushalt: null, reisen: { current: null, upcoming: null, events: [] },
        finanzen: { month: day.slice(0, 7), budget: null, expenses: '0.00', available: null, spent_today: '0.00' },
        suggestions: [],
      },
    }),
  );
  return data;
}

for (const width of [390, 1440]) {
  test(`organisation: events, tasks and notes end to end at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const data = await mockApi(page);
    await page.goto('/organisation');
    await expect(page.getByRole('heading', { name: 'Organisation', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Heute hast du frei geplant' })).toBeVisible();

    // Termin mit Kategorie
    await page.getByRole('button', { name: 'Kalender', exact: true }).click();
    await page.getByRole('button', { name: 'Termin erstellen', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Titel', { exact: true }).fill('Zahnarzt');
    await choose(page, 'Kategorie', 'Gesundheit');
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(data['events'][0]).toMatchObject({ title: 'Zahnarzt', category: 'gesundheit' });
    await expect(page.locator('.event')).toContainText('Zahnarzt');
    await expect(page.locator('.event .tag')).toHaveText('Gesundheit');

    // Aufgabe mit Projekt, dann erledigen und wieder öffnen
    await page.getByRole('button', { name: 'Aufgaben', exact: true }).click();
    await page.getByRole('button', { name: 'Aufgabe erstellen', exact: true }).first().click();
    await dialog.getByLabel('Titel', { exact: true }).fill('Steuer abgeben');
    await dialog.getByLabel('Projekt (optional)').fill('Finanzen');
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.locator('.task-row')).toContainText(['Steuer abgeben']);
    await expect(page.locator('.projects')).toContainText('Finanzen');
    await page.getByRole('button', { name: 'Steuer abgeben erledigen' }).click();
    await expect(page.getByRole('heading', { name: 'Keine Aufgaben in dieser Ansicht' })).toBeVisible();
    await choose(page, 'Status', 'Erledigte Aufgaben');
    await page.getByRole('button', { name: 'Steuer abgeben wieder öffnen' }).click();
    await choose(page, 'Status', 'Offene Aufgaben');
    await expect(page.locator('.task-row')).toHaveCount(1);

    // Notiz anlegen und anheften
    await page.getByRole('button', { name: 'Notizen', exact: true }).click();
    await page.getByRole('button', { name: 'Notiz erstellen', exact: true }).first().click();
    await dialog.getByLabel('Titel der Notiz').fill('Ideen');
    await dialog.getByLabel('Inhalt (optional)').fill('• Sommerfest\n• Newsletter');
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.locator('.note')).toContainText('• Sommerfest');
    await page.getByRole('button', { name: 'Ideen anheften' }).click();
    await expect(page.getByRole('button', { name: 'Ideen lösen' })).toBeVisible();

    // Übersicht zeigt alles zusammen
    await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Letzte Notizen' })).toBeVisible();
    await expect(page.locator('app-org-overview')).toContainText('Ideen');
    await expect(page.locator('app-org-overview')).toContainText('Steuer abgeben');

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    // Termin löschen mit Bestätigung
    await page.getByRole('button', { name: 'Kalender', exact: true }).click();
    await page.getByRole('button', { name: 'Zahnarzt bearbeiten' }).click();
    await page.getByRole('button', { name: 'Termin löschen', exact: true }).click();
    await page.getByRole('button', { name: 'Ja, löschen', exact: true }).click();
    await expect(page.locator('.event')).toHaveCount(0);
  });
}

test('the head button follows the tab, and the overview has none', async ({ page }) => {
  await mockApi(page);
  await page.goto('/organisation');
  const head = page.locator('.page-heading .primary');
  await expect(page.getByRole('heading', { name: 'Organisation', exact: true })).toBeVisible();
  await expect(head).toHaveCount(0);

  for (const [tab, label, title] of [
    ['Kalender', 'Termin erstellen', 'Termin erstellen'],
    ['Aufgaben', 'Aufgabe erstellen', 'Aufgabe erstellen'],
    ['Notizen', 'Notiz erstellen', 'Neue Notiz'],
  ]) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(head).toHaveText(new RegExp(label));
    await head.click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.getByRole('button', { name: 'Abbrechen' }).click();
  }
  await page.getByRole('button', { name: 'Dateien', exact: true }).click();
  await expect(head).toHaveText(/Datei hochladen/);
  await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
  await expect(head).toHaveCount(0);
});

test.describe('demo preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost:8000/api/**', (route) => route.abort());
  });

  test('tasks: filters, groups and live updates without reloading', async ({ page }) => {
    await page.goto('/demo/organisation?tab=tasks');
    await expect(page.getByRole('heading', { name: /Überfällig/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Heute/ })).toBeVisible();
    const rows = page.locator('.task-row');
    const before = await rows.count();

    await page.getByPlaceholder('Aufgabe suchen …').fill('Kita');
    await expect(rows).toHaveCount(1);
    await page.getByPlaceholder('Aufgabe suchen …').fill('nichts passt hier');
    await expect(page.getByText('Für „nichts passt hier“ gibt es keinen Treffer.')).toBeVisible();
    await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
    await expect(rows).toHaveCount(before);

    // Projekt-Klick filtert
    await page.locator('.project', { hasText: 'Auto' }).click();
    await expect(rows).toHaveCount(1);
    await page.locator('.project', { hasText: 'Auto' }).click();

    // Abhaken nimmt die Aufgabe aus der Liste, der Fortschritt zählt mit
    await page.getByRole('button', { name: 'Kind zum Sport bringen erledigen' }).click();
    await expect(rows).toHaveCount(before - 1);
    await expect(page.locator('.progress')).toContainText('4 / 15');
  });

  test('calendar: views, category filter and the selected day', async ({ page }) => {
    await page.goto('/demo/organisation?tab=calendar');
    await expect(page.locator('.event')).toHaveCount(2); // heute: Zahnärztin und Yoga
    await page.locator('.chip', { hasText: 'Sport' }).click();
    await expect(page.locator('.event')).toHaveCount(1);
    await page.getByRole('button', { name: 'Alle Kategorien' }).click();
    await page.getByRole('button', { name: 'Woche', exact: true }).click();
    await expect(page.locator('.week__col')).toHaveCount(7);
    await page.getByRole('button', { name: 'Nächster Tag' }).click();
    await expect(page.locator('.event')).toContainText(['Kita bringen']);
    await page.getByRole('button', { name: 'Tag', exact: true }).click();
    await expect(page.locator('.month')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Demnächst' })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('app-org-calendar').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  });

  test('files: categories, preview, favourite and delete', async ({ page }) => {
    await page.goto('/demo/organisation?tab=files');
    await page.locator('.nav button', { hasText: 'Alle Dateien' }).click();
    await expect(page.locator('.file-row')).toHaveCount(8);
    await page.locator('.nav--cats button', { hasText: 'Buchungen' }).click();
    await expect(page.locator('.file-row')).toHaveCount(2);
    await page.locator('.file-row', { hasText: 'Flugtickets_Rom.pdf' }).click();
    await expect(page.locator('#file-h')).toHaveText('Flugtickets_Rom.pdf');
    await expect(page.locator('.info')).toContainText('PDF-Dokument');
    await page.getByRole('button', { name: 'Zu Favoriten' }).click();
    await expect(page.locator('.nav button', { hasText: 'Favoriten' })).toContainText('4');
    await page.getByRole('button', { name: 'Flugtickets_Rom.pdf löschen' }).click();
    await page.getByRole('button', { name: 'Ja, löschen', exact: true }).click();
    await expect(page.locator('.file-row')).toHaveCount(1);
    expect((await new AxeBuilder({ page }).include('app-org-files').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  });

  for (const width of [390, 820, 1440]) {
    test(`every tab fits and is accessible at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/demo/organisation');
      for (const tab of ['Übersicht', 'Kalender', 'Aufgaben', 'Notizen', 'Dateien']) {
        await page.getByRole('button', { name: tab, exact: true }).click();
        await expect(page.locator('#org-tab-' + ({ Übersicht: 'overview', Kalender: 'calendar', Aufgaben: 'tasks', Notizen: 'notes', Dateien: 'files' } as Record<string, string>)[tab])).toHaveAttribute('aria-current', 'page');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const result = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze();
        expect(result.violations, tab).toEqual([]);
      }
    });
  }

  test('mobile calendar: month grid, then the day, then "Demnächst"', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo/organisation?tab=calendar');
    const grid = (await page.locator('.month').boundingBox())!;
    const day = (await page.locator('.day').boundingBox())!;
    const upcoming = (await page.locator('.upcoming').boundingBox())!;
    expect(grid.y).toBeLessThan(day.y);
    expect(day.y).toBeLessThan(upcoming.y);
  });
});
