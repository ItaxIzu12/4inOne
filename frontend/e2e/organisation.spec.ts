import { test, expect, Page } from '@playwright/test';
import { choose, pickTime } from './helpers';
import AxeBuilder from '@axe-core/playwright';

// Organisation V1 (docs/ORGANISATION_V1.md): Kalender · Aufgaben · Notizen.

/** Angemeldet unter /organisation mit nachgebauter API — leeres Konto, keine Demo-Daten. */
async function mockApi(page: Page) {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 'test' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 'test', user: { name: 'Mira', email: 'mira@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  await page.route('**/api/v1/notifications/**', (r) => r.fulfill({ json: [] }));
  const data: Record<string, any[]> = { events: [], tasks: [], notes: [] };
  const requests: string[] = [];
  let next = 1;
  await page.route('**/api/v1/organisation/**', async (r) => {
    const url = new URL(r.request().url());
    const method = r.request().method();
    requests.push(`${method} ${url.pathname}${url.search}`);
    const parts = url.pathname.split('/').filter(Boolean);
    const resource = parts[3];
    const list = data[resource] ?? [];
    const id = Number(parts[4]);
    if (method === 'POST') {
      const stamp = new Date().toISOString();
      const body = r.request().postDataJSON();
      if (resource === 'events' && body.ends_at && body.ends_at < body.starts_at) {
        return r.fulfill({ status: 400, json: { ends_at: ['Das Ende liegt vor dem Beginn.'] } });
      }
      const item = { id: next++, project: '', category: 'sonstiges', pinned: false, all_day: false, recurrence: '', ...body, created_at: stamp, updated_at: stamp };
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
    if (id) return r.fulfill({ json: list.find((x) => x.id === id) });
    return r.fulfill({ json: list });
  });
  return { data, requests };
}

test('a new account sees three tabs and clean empty states, no demo data', async ({ page }) => {
  await mockApi(page);
  await page.goto('/organisation');
  await expect(page.getByRole('navigation', { name: 'Organisation Ansichten' }).getByRole('button')).toHaveText(['Kalender', 'Aufgaben', 'Notizen']);
  await expect(page.getByRole('heading', { name: 'Noch keine Termine' })).toBeVisible();
  await page.getByRole('button', { name: 'Aufgaben', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Noch keine Aufgaben' })).toBeVisible();
  await page.getByRole('button', { name: 'Notizen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Noch keine Notizen' })).toBeVisible();
  // Alte Links (Übersicht, Dateien) landen im Kalender
  await page.goto('/organisation?tab=files');
  await expect(page.locator('#org-tab-calendar')).toHaveAttribute('aria-current', 'page');
});

test('the calendar loads only the visible range', async ({ page }) => {
  const { requests } = await mockApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/organisation');
  await expect(page.getByRole('heading', { name: 'Noch keine Termine' })).toBeVisible();
  const eventCalls = requests.filter((r) => r.startsWith('GET /api/v1/organisation/events/'));
  expect(eventCalls.length).toBeGreaterThan(0);
  expect(eventCalls.every((r) => /start=\d{4}-\d{2}-\d{2}&end=\d{4}-\d{2}-\d{2}/.test(r))).toBe(true);
});

for (const width of [360, 1440]) {
  test(`events, tasks and notes end to end at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const { data } = await mockApi(page);
    await page.goto('/organisation');
    const dialog = page.getByRole('dialog');

    // Termin: Ende vor Beginn → Fehler direkt am Feld, Eingaben bleiben
    await page.getByRole('button', { name: 'Termin hinzufügen', exact: true }).first().click();
    await dialog.getByLabel('Titel', { exact: true }).fill('Teammeeting');
    await pickTime(page, dialog.getByLabel('Beginn (optional)', { exact: true }), '10:00');
    await pickTime(page, dialog.getByLabel('Ende (optional)', { exact: true }), '09:00');
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(dialog.getByText('Das Ende liegt vor dem Beginn.')).toBeVisible();
    await expect(dialog.getByLabel('Titel', { exact: true })).toHaveValue('Teammeeting');
    expect(data['events']).toHaveLength(0);

    // korrigiert und wöchentlich
    await pickTime(page, dialog.getByLabel('Ende (optional)', { exact: true }), '11:00');
    await choose(page, 'Wiederholung', 'Wöchentlich');
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(data['events'][0]).toMatchObject({ title: 'Teammeeting', recurrence: 'weekly', all_day: false });
    await expect(page.locator('.agenda__row')).toContainText(['Teammeeting']);

    // Aufgabe anlegen, suchen, erledigen, unter „Erledigt“ (mit Anzahl) wieder öffnen
    await page.getByRole('button', { name: 'Aufgaben', exact: true }).click();
    await page.getByRole('button', { name: 'Aufgabe hinzufügen', exact: true }).first().click();
    await dialog.getByLabel('Titel', { exact: true }).fill('Präsentation vorbereiten');
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.locator('.task')).toContainText(['Präsentation vorbereiten']);
    await page.getByLabel('Aufgaben durchsuchen').fill('steuer');
    await expect(page.getByText('Keine Aufgabe passt zu „steuer“.')).toBeVisible();
    await page.getByLabel('Aufgaben durchsuchen').fill('präsent');
    await expect(page.locator('.task')).toHaveCount(1);
    await page.getByLabel('Aufgaben durchsuchen').fill('');
    await page.getByRole('button', { name: 'Präsentation vorbereiten erledigen' }).click();
    await expect(page.getByText('Keine offenen Aufgaben – alles erledigt.')).toBeVisible();
    const done = page.getByRole('group', { name: 'Aufgaben anzeigen' }).getByRole('button').filter({ hasText: 'Erledigt' });
    await expect(done).toHaveText(/Erledigt\s*1/);
    await done.click();
    await page.getByRole('button', { name: 'Präsentation vorbereiten wieder öffnen' }).click();
    await page.getByRole('button', { name: 'Alle', exact: true }).click();
    await expect(page.locator('.task')).toHaveCount(1);

    // Notiz: Inhalt genügt, Titel optional; anheften
    await page.getByRole('button', { name: 'Notizen', exact: true }).click();
    await page.getByRole('button', { name: 'Notiz erstellen', exact: true }).first().click();
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(dialog.getByText('Bitte schreib etwas in die Notiz.')).toBeVisible();
    await dialog.getByLabel('Inhalt').fill('Arztfragen\nBlutwerte besprechen');
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.locator('.note__title')).toHaveText(['Arztfragen']);
    await page.getByRole('button', { name: 'Arztfragen anheften' }).click();
    await expect(page.getByRole('heading', { name: 'Angeheftet' })).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    // Termin löschen mit Bestätigung, ohne Neuladen der Seite
    await page.getByRole('button', { name: 'Kalender', exact: true }).click();
    await page.locator('.agenda__row', { hasText: 'Teammeeting' }).click();
    await page.getByRole('button', { name: 'Termin löschen', exact: true }).click();
    await page.getByRole('button', { name: 'Ja, löschen', exact: true }).click();
    await expect(page.locator('.agenda__row')).toHaveCount(0);
  });
}

test.describe('demo preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost:8000/api/**', (route) => route.abort());
  });

  test('tasks: the five views and the head button', async ({ page }) => {
    await page.goto('/demo/organisation?tab=tasks');
    await expect(page.locator('.page-heading .primary')).toHaveText(/Aufgabe hinzufügen/);
    const views = page.getByRole('group', { name: 'Aufgaben anzeigen' }).getByRole('button');
    await expect(views).toHaveText([/Alle/, /Heute/, /Überfällig/, /Wiederkehrend/, /Erledigt/]);
    await views.filter({ hasText: 'Überfällig' }).click();
    await expect(page.locator('.task')).toContainText(['Steuerunterlagen sortieren']);
    await views.filter({ hasText: 'Wiederkehrend' }).click();
    await expect(page.locator('.task__title')).toHaveText(['Wochenplanung']);
    // Erledigen rückt die wiederkehrende Aufgabe weiter, sie bleibt offen
    await page.getByRole('button', { name: 'Wochenplanung erledigen' }).click();
    await expect(page.locator('.task__title')).toHaveText(['Wochenplanung']);
    await expect(page.locator('.task__meta')).not.toContainText('Heute');
  });

  test('calendar: Heute, Woche and Monat on the same events', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/organisation?tab=calendar');
    await page.getByRole('button', { name: 'Tag', exact: true }).click();
    await expect(page.locator('.agenda__row')).toContainText(['Zahnarzt', 'Badminton']);
    await page.getByRole('button', { name: 'Woche', exact: true }).click();
    await expect(page.locator('.week__col')).toHaveCount(7);
    await page.getByRole('button', { name: 'Monat', exact: true }).click();
    await expect(page.locator('.cell')).toHaveCount(42);
    // das wöchentliche Teammeeting erscheint an mehreren Tagen
    expect(await page.locator('.cell .ev', { hasText: 'Teammeeting' }).count()).toBeGreaterThan(3);
    expect((await new AxeBuilder({ page }).include('app-org-calendar').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  });

  for (const width of [360, 390, 430, 820, 1440]) {
    test(`every tab fits and is accessible at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/demo/organisation');
      for (const [tab, key] of [['Kalender', 'calendar'], ['Aufgaben', 'tasks'], ['Notizen', 'notes']]) {
        await page.getByRole('button', { name: tab, exact: true }).click();
        await expect(page.locator('#org-tab-' + key)).toHaveAttribute('aria-current', 'page');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const result = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze();
        expect(result.violations, tab).toEqual([]);
      }
    });
  }

  test('the agenda lists the whole period: the day, the week by day, the month by day', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/organisation?tab=calendar');
    const cal = page.locator('app-org-calendar');
    await cal.getByRole('button', { name: 'Tag', exact: true }).click();
    await expect(cal.locator('.agenda__date')).toHaveCount(0); // ein Tag, keine Tagesgruppen
    await cal.getByRole('button', { name: 'Woche', exact: true }).click();
    await expect(cal.locator('#agenda-h')).toHaveText('Termine dieser Woche');
    // Teammeeting (Montag) steht in der Woche, auch wenn heute ein anderer Tag ist
    await expect(cal.locator('.agenda__row', { hasText: 'Teammeeting' })).toHaveCount(1);
    expect(await cal.locator('.agenda__date').count()).toBeGreaterThan(1);
    await cal.getByRole('button', { name: 'Monat', exact: true }).click();
    await expect(cal.locator('#agenda-h')).toHaveText(/^Termine im /);
    // Vergangene Tage des laufenden Monats sind eingeklappt: die Liste beginnt heute oder später …
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const firstDay = async () => (await cal.locator('.agenda__day').first().getAttribute('id'))!.slice('agenda-'.length);
    expect(await firstDay() >= today).toBe(true);
    // … und „Frühere Termine“ holt sie zurück
    const past = cal.getByRole('button', { name: /Frühere Termine/ });
    if (await past.count()) {
      await past.click();
      await expect(past).toHaveCount(0);
      await expect.poll(async () => (await firstDay()) < today).toBe(true);
    }
    expect((await new AxeBuilder({ page }).include('app-org-calendar').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  });

  test('the jump-back button follows the view: current day, week or month', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/organisation?tab=calendar');
    const cal = page.locator('app-org-calendar');
    const jump = cal.locator('.today-btn');
    for (const [view, step, label] of [
      ['Tag', 'Nächster Tag', 'Aktueller Tag'],
      ['Woche', 'Nächste Woche', 'Aktuelle Woche'],
      ['Monat', 'Nächster Monat', 'Aktueller Monat'],
    ]) {
      await cal.getByRole('button', { name: view, exact: true }).click();
      await expect(jump).toHaveCount(0); // im aktuellen Zeitraum kein Knopf
      await cal.getByRole('button', { name: step }).click();
      await expect(jump).toHaveText(label);
      await jump.click();
      await expect(jump).toHaveCount(0);
    }
  });

  test('day, week and month share one date', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/organisation?tab=calendar');
    const cal = page.locator('app-org-calendar');
    await cal.getByRole('button', { name: 'Monat', exact: true }).click();
    const current = await cal.locator('#cal-title').innerText();
    await cal.getByRole('button', { name: 'Nächster Monat' }).click();
    await expect(cal.locator('#cal-title')).not.toHaveText(current);
    const title = await cal.locator('#cal-title').innerText(); // z. B. „November 2026“
    // In die Woche: die Woche des 1. dieses Monats, nicht die aktuelle
    await cal.getByRole('button', { name: 'Woche', exact: true }).click();
    await expect(cal.locator('.today-btn')).toHaveText('Aktuelle Woche');
    await cal.getByRole('button', { name: 'Tag', exact: true }).click();
    await expect(cal.locator('#cal-title')).toContainText(title.split(' ')[0]); // derselbe Monat
    await cal.getByRole('button', { name: 'Monat', exact: true }).click();
    await expect(cal.locator('#cal-title')).toHaveText(title);
    // Zurück in den aktuellen Monat → Tag ist heute
    await cal.locator('.today-btn').click();
    await cal.getByRole('button', { name: 'Tag', exact: true }).click();
    await expect(cal.locator('.today-btn')).toHaveCount(0);
  });

  test('mobile week: a day strip instead of seven columns, then the agenda', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/demo/organisation?tab=calendar');
    await page.getByRole('button', { name: 'Woche', exact: true }).click();
    await expect(page.locator('.week')).toBeHidden();
    await expect(page.locator('.strip__day')).toHaveCount(7);
    const strip = (await page.locator('.strip').boundingBox())!;
    const agenda = (await page.locator('.agenda').boundingBox())!;
    expect(strip.y).toBeLessThan(agenda.y);
  });
});
