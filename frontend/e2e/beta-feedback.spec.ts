import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Beta-Test (Entwicklungsplan Phase 5): „Feedback geben“ im Kontomenü — sendet nur, was im Formular steht. */
async function signedIn(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira Beispiel', email: 'mira@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  await page.route('**/api/v1/organisation/today/**', (r) => r.fulfill({ json: { items: [], event_count: 0 } }));
  // Startseite (Dashboard V1) lädt für echte Konten /today/ und bevorstehende Reisen — ohne Attrappe erschiene ein
  // Fehlerhinweis oben rechts über dem Kontomenü.
  await page.route('**/api/v1/today/**', (r) =>
    r.fulfill({ json: { date: '2026-10-10', timezone: 'Europe/Berlin', organisation: { items: [], event_count: 0, open_task_count: 0, overdue_count: 0 }, haushalt: null, reisen: { current: null, upcoming: null, events: [] }, finanzen: null, suggestions: [] } }),
  );
  await page.route('**/api/v1/reisen/trips/**', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/v1/finanzen/private/**', (r) =>
    r.fulfill({ json: r.request().url().includes('/summary/') ? { month: '2026-09', currency: 'EUR', budget: null, total: null, saved: '0.00', saved_planned: '0.00', available: null, plan_alert: null, income: '0.00', expenses: '0.00', savings_target: '0.00', savings_current: '0.00', has_data: false, categories: [], recent: [] } : [] }),
  );
  await page.route('**/api/v1/haushalt/**', (r) => r.fulfill({ json: { open_tasks: 0 } }));
}

const TASKS = [
  { value: 'T1', label: 'Vertrag anlegen und mit Finanzen und Organisation verbinden' },
  { value: 'T2', label: 'Eine Änderung vornehmen und die Folgen prüfen' },
  { value: 'T3', label: 'Reise mit Budget und Kalender verbinden' },
  { value: 'T4', label: 'Eine Verbindung pausieren oder aufheben' },
  { value: 'T5', label: 'Den Vorteil von 4inOne erklären' },
];
const AREAS = [
  { value: 'FINANZEN', label: 'Finanzen' }, { value: 'HAUSHALT', label: 'Haushalt' }, { value: 'ORGANISATION', label: 'Organisation' },
  { value: 'REISEN', label: 'Reisen' }, { value: 'CONNECTIONS', label: 'Verbindungen zwischen Bereichen' }, { value: 'GENERAL', label: 'Allgemein' },
];

for (const width of [390, 1440]) {
  test(`feedback from the account menu at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signedIn(page);
    const sent: unknown[] = [];
    await page.route('**/api/v1/feedback/', (r) => {
      if (r.request().method() === 'POST') {
        sent.push(r.request().postDataJSON());
        return r.fulfill({ status: 201, json: { id: 1 } });
      }
      return r.fulfill({ json: { enabled: true, areas: AREAS, tasks: TASKS } });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Kontomenü' }).click();
    const item = page.getByRole('menu', { name: 'Konto' }).getByRole('menuitem', { name: /Feedback geben/ });
    await expect(item).toBeVisible();
    await item.click();

    const dialog = page.getByRole('dialog', { name: 'Feedback geben' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Bitte keine Passwörter');
    // Fragen als Umschalter (aria-pressed), mindestens 44 px
    const four = dialog.getByRole('group', { name: /Wie verständlich/ }).getByRole('button', { name: '4', exact: true });
    await four.click();
    await expect(four).toHaveAttribute('aria-pressed', 'true');
    expect((await four.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await dialog.getByRole('group', { name: /weiter nutzen/ }).getByRole('button', { name: 'Ja' }).click();
    await dialog.getByLabel(/Was ist dir aufgefallen/).fill('Die Vorschau „was passiert wo“ hat geholfen.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    expect((await new AxeBuilder({ page }).include('[role=dialog]').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    await dialog.getByRole('button', { name: 'Senden' }).click();
    await expect(dialog).toContainText('Deine Rückmeldung ist angekommen');
    expect(sent).toEqual([{ area: 'GENERAL', task: '', understood: 4, in_control: null, saves_time: '', would_continue: 'YES',
      message: 'Die Vorschau „was passiert wo“ hat geholfen.', page: '/' }]);
    await dialog.getByRole('button', { name: 'Schließen' }).last().click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Kontomenü' })).toBeFocused();
  });
}

test('no feedback entry when the beta is switched off', async ({ page }) => {
  await signedIn(page);
  await page.route('**/api/v1/feedback/', (r) => r.fulfill({ json: { enabled: false, areas: [], tasks: [] } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Kontomenü' }).click();
  await expect(page.getByRole('menu', { name: 'Konto' }).getByRole('menuitem', { name: 'Abmelden' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Feedback/ })).toHaveCount(0);
});
