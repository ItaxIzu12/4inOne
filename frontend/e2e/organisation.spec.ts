import { test, expect } from '@playwright/test';
import { choose, pickDate, pickTime } from './helpers';
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
    await choose(page, 'Priorität', 'Hoch');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Buch abholen Offen/ })).toBeVisible();
    await page.getByRole('button', { name: 'Buch abholen erledigen', exact: true }).click();
    await expect(page.getByRole('button', { name: /Buch abholen Erledigt/ })).toBeVisible();
    await page.getByRole('button', { name: 'Buch abholen wieder öffnen', exact: true }).click();
    await page.getByRole('button', { name: /Buch abholen Offen/ }).click();
    await page.getByLabel('Titel', { exact: true }).fill('Buch zurückgeben');
    await choose(page, 'Status', 'In Bearbeitung');
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
    // Neuer Termin steht schon auf dem gewählten Tag um 09:00; hier auf 10:00 ändern
    await pickTime(page, page.getByLabel('Beginn – Uhrzeit', { exact: true }), '10:00');
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

test('"Aufgabe erstellen" and "Termin erstellen" open a dialog for exactly that kind, only "Neuer Eintrag" offers the choice', async ({ page }) => {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira', email: 'm@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  await page.route('**/api/v1/organisation/**', (r) => r.fulfill({ json: [] }));
  await page.goto('/app/organisation');
  const dialog = page.getByRole('dialog');
  const choice = (name: string) => dialog.getByRole('button', { name, exact: true });

  // „Heute“ bietet keinen eigenen Button mehr an: dafür gibt es „Neuer Eintrag“ und die Reiter
  await expect(page.getByRole('heading', { name: 'Heute hast du frei geplant' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aufgabe erstellen', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Aufgaben', exact: true }).click();
  await page.getByRole('button', { name: 'Aufgabe erstellen', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Aufgabe erstellen' })).toBeVisible();
  await expect(choice('Termin')).toHaveCount(0);
  await expect(choice('Aufgabe')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();

  await page.getByRole('button', { name: 'Kalender', exact: true }).click();
  await page.getByRole('button', { name: 'Termin erstellen', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Termin erstellen' })).toBeVisible();
  await expect(choice('Aufgabe')).toHaveCount(0);
  await expect(choice('Termin')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();

  await page.getByRole('button', { name: 'Neuer Eintrag', exact: true }).click();
  await expect(choice('Termin')).toBeVisible();
  await expect(choice('Aufgabe')).toBeVisible();
  await choice('Aufgabe').click();
  await expect(dialog.getByRole('heading', { name: 'Aufgabe erstellen' })).toBeVisible();
});

test('tasks: search filters the list, and only 5 show at first with "weitere anzeigen" for the rest', async ({ page }) => {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 'test' } }));
  await page.route('**/api/v1/auth/refresh/', (r) =>
    r.fulfill({ json: { access: 'test', user: { name: 'Mira', email: 'mira@example.com' } } }),
  );
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  const tasks = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    title: i === 3 ? 'Stromrechnung bezahlen' : `Aufgabe ${i + 1}`,
    description: '',
    due_date: null,
    due_time: null,
    priority: 'MEDIUM',
    status: 'OPEN',
  }));
  await page.route('**/api/v1/organisation/**', async (r) => {
    const url = new URL(r.request().url());
    if (url.pathname.endsWith('/today/'))
      return r.fulfill({ json: { date: '2026-09-27', items: [], event_count: 0, open_task_count: tasks.length, overdue_count: 0 } });
    if (url.pathname.includes('/events/')) return r.fulfill({ json: [] });
    return r.fulfill({ json: tasks });
  });
  await page.goto('/app/organisation');
  await page.getByRole('button', { name: 'Aufgaben', exact: true }).click();

  const rows = page.locator('.task-row');
  await expect(rows).toHaveCount(5);
  await expect(page.getByRole('button', { name: '3 weitere Aufgaben anzeigen' })).toBeVisible();
  await page.getByRole('button', { name: '3 weitere Aufgaben anzeigen' }).click();
  await expect(rows).toHaveCount(8);
  await expect(page.getByRole('button', { name: /weitere Aufgabe/ })).toHaveCount(0);

  // Suche filtert sofort und setzt die Begrenzung zurück
  await page.getByPlaceholder('Aufgabe suchen …').fill('stromrechnung');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Stromrechnung bezahlen');

  await page.getByPlaceholder('Aufgabe suchen …').fill('nichts passt hier');
  await expect(page.getByRole('heading', { name: 'Keine Aufgabe gefunden' })).toBeVisible();
  await expect(page.getByText('Für „nichts passt hier“ gibt es keinen Treffer.')).toBeVisible();

  // Filterwechsel setzt die Begrenzung ebenfalls zurück
  await page.getByPlaceholder('Aufgabe suchen …').fill('');
  await expect(rows).toHaveCount(5);
});

test.describe('demo preview: task list stays live', () => {
  test('creating a task shows it (and "weitere anzeigen") immediately, no tab switch needed', async ({ page }) => {
    await page.goto('/organisation');
    await page.getByRole('button', { name: 'Aufgaben', exact: true }).click();
    await expect(page.locator('.task-row')).toHaveCount(5);
    await page.getByRole('button', { name: 'Aufgabe erstellen', exact: true }).click();
    await page.getByLabel('Titel', { exact: true }).fill('Neue Testaufgabe');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.task-row')).toHaveCount(5); // weiterhin begrenzt …
    await expect(page.getByRole('button', { name: '1 weitere Aufgabe anzeigen' })).toBeVisible(); // … aber sichtbar
    await page.getByRole('button', { name: '1 weitere Aufgabe anzeigen' }).click();
    await expect(page.locator('.task-row')).toHaveCount(6);
    await expect(page.getByText('Neue Testaufgabe')).toBeVisible();
  });

  test('marking a task done/open updates the "offene Aufgaben" filter and count immediately', async ({ page }) => {
    await page.goto('/organisation');
    await page.getByRole('button', { name: 'Aufgaben', exact: true }).click();
    await choose(page, 'Anzeigen', 'Offene Aufgaben');
    await expect(page.locator('.task-row')).toHaveCount(4);
    await page.getByRole('button', { name: /Wocheneinkauf erledigen/ }).click();
    await expect(page.locator('.task-row')).toHaveCount(3); // sofort raus aus „Offene Aufgaben“, kein Tab-Wechsel nötig
    await choose(page, 'Anzeigen', 'Erledigte Aufgaben');
    await expect(page.getByText('Wocheneinkauf')).toBeVisible();
  });
});

test.describe('calendar day: search and limit work like tasks, "Nächste Termine" shows on mobile', () => {
  test('the day list is searchable and limited to 5, with the button next to the date', async ({ page }) => {
    await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 'test' } }));
    await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 'test', user: { name: 'Mira', email: 'mira@example.com' } } }));
    await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
    const today = new Date();
    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const events = Array.from({ length: 7 }, (_, i) => ({
      id: i + 1,
      title: i === 4 ? 'Zahnarzttermin' : `Termin ${i + 1}`,
      starts_at: `${day}T${String(8 + i).padStart(2, '0')}:00:00`,
      ends_at: null,
      location: '',
      description: '',
    }));
    await page.route('**/api/v1/organisation/**', (r) => {
      const url = new URL(r.request().url());
      if (url.pathname.endsWith('/today/')) return r.fulfill({ json: { date: day, items: [], event_count: events.length, open_task_count: 0, overdue_count: 0 } });
      if (url.pathname.includes('/tasks/')) return r.fulfill({ json: [] });
      return r.fulfill({ json: events });
    });
    await page.goto('/app/organisation');
    await page.getByRole('button', { name: 'Kalender', exact: true }).click();

    // Button steht im selben Kopf wie das Datum, rechts daneben
    const header = page.locator('.card-heading').filter({ hasText: 'Termin erstellen' });
    await expect(header.getByRole('heading')).toBeVisible();
    await expect(header.getByRole('button', { name: 'Termin erstellen' })).toBeVisible();

    const rows = page.locator('.entry');
    await expect(rows).toHaveCount(5);
    await expect(page.getByRole('button', { name: '2 weitere Termine anzeigen' })).toBeVisible();
    await page.getByRole('button', { name: '2 weitere Termine anzeigen' }).click();
    await expect(rows).toHaveCount(7);

    await page.getByPlaceholder('Termin suchen …').fill('zahnarzt');
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('Zahnarzttermin');

    await page.getByPlaceholder('Termin suchen …').fill('nichts passt');
    await expect(page.getByRole('heading', { name: 'Kein Termin gefunden' })).toBeVisible();
  });

  test('"Nächste Termine" is visible on mobile too', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/organisation');
    await page.getByRole('button', { name: 'Kalender', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nächste Termine' })).toBeVisible();
  });
});

test.describe('the three tiles (Termine heute/offene Aufgaben/überfällig) only belong to "Heute"', () => {
  test('they show on Heute, not on Kalender or Aufgaben; the calendar grid stays out of Heute', async ({ page }) => {
    await page.goto('/organisation');
    const stats = page.locator('.stats[aria-label="Dein Überblick"]');
    await expect(stats).toBeVisible();
    await expect(page.getByRole('heading', { name: 'September 2026' })).toHaveCount(0); // Monatsraster nicht im Heute-Tab
    await expect(page.getByRole('heading', { name: 'Nächste Termine' })).toBeVisible();

    await page.getByRole('button', { name: 'Kalender', exact: true }).click();
    await expect(stats).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'September 2026', exact: true })).toBeVisible(); // hier weiterhin da

    await page.getByRole('button', { name: 'Aufgaben', exact: true }).click();
    await expect(stats).toHaveCount(0);
  });
});

test('calendar: the date filter jumps straight to that day\'s events, and the mini month follows', async ({ page }) => {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 'test' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 'test', user: { name: 'Mira', email: 'mira@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  const events = [
    { id: 1, title: 'Weihnachtsfeier', starts_at: '2026-12-15T18:00:00', ends_at: null, location: '', description: '' },
  ];
  await page.route('**/api/v1/organisation/**', (r) => {
    const url = new URL(r.request().url());
    if (url.pathname.endsWith('/today/')) return r.fulfill({ json: { date: '2026-09-27', items: [], event_count: 0, open_task_count: 0, overdue_count: 0 } });
    if (url.pathname.includes('/tasks/')) return r.fulfill({ json: [] });
    return r.fulfill({ json: events });
  });
  await page.goto('/app/organisation');
  await page.getByRole('button', { name: 'Kalender', exact: true }).click();
  await expect(page.getByText('Noch keine Termine')).toBeVisible();

  await pickDate(page, page.getByLabel('Datum', { exact: true }), '2026-12-15');
  await expect(page.getByRole('heading', { name: /15\. Dezember 2026/ })).toBeVisible();
  await expect(page.locator('.entry').getByText('Weihnachtsfeier')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dezember 2026', exact: true })).toBeVisible(); // Monatsraster folgt
});

test.describe('mobile order and visibility', () => {
  test('"Nächste Termine" is visible on Heute (mobile), stacked after the day card', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/organisation');
    await expect(page.getByRole('heading', { name: 'Nächste Termine' })).toBeVisible();
  });

  test('on Kalender (mobile) the order is: month grid, then the selected day, then "Nächste Termine"', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/organisation');
    await page.getByRole('button', { name: 'Kalender', exact: true }).click();
    const today = new Date();
    const monthLabel = today.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    const dayLabel = new RegExp(`${today.getDate()}\\. ${today.toLocaleDateString('de-DE', { month: 'long' })} ${today.getFullYear()}`);
    const tops = await Promise.all(
      [
        page.getByRole('heading', { name: monthLabel, exact: true }),
        page.getByRole('heading', { name: dayLabel }),
        page.getByRole('heading', { name: 'Nächste Termine' }),
      ].map(async (l) => (await l.boundingBox())!.y),
    );
    expect(tops[0]).toBeLessThan(tops[1]);
    expect(tops[1]).toBeLessThan(tops[2]);
  });
});
