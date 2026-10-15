import { test, expect, Page } from '@playwright/test';

// Persistence-Audit (Beta) im Browser: Das Backend ist die einzige Quelle der Wahrheit. Ein fehlgeschlagenes
// Speichern darf nie wie gespeichert aussehen, ein Doppelklick erzeugt nur eine Anfrage, und nach dem Neuladen
// zeigt die Seite genau den Stand des Servers. Backend-Seite: backend/core/test_persistence_audit.py.

async function mockOrganisation(page: Page, opts: { failPost?: boolean; slowPost?: boolean } = {}) {
  await page.route('**/api/v1/**', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 'test' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 'test', user: { name: 'Mira', email: 'mira@example.com', email_verified: true } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  await page.route('**/api/v1/notifications/**', (r) => r.fulfill({ json: { unread: 0, items: [] } }));
  await page.route('**/api/v1/invitations/**', (r) => r.fulfill({ json: { received: [], sent: [], declined: [] } }));
  const server = { notes: [] as Record<string, unknown>[], posts: 0 };
  await page.route('**/api/v1/organisation/notes/**', async (r) => {
    if (r.request().method() === 'POST') {
      server.posts++;
      if (opts.slowPost) await new Promise((resolve) => setTimeout(resolve, 600));
      if (opts.failPost) return r.fulfill({ status: 500, json: { detail: 'Ein interner Fehler ist aufgetreten.' } });
      const note = { id: server.notes.length + 1, title: '', pinned: false, ...r.request().postDataJSON(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      server.notes.push(note);
      return r.fulfill({ status: 201, json: note });
    }
    return r.fulfill({ json: server.notes });
  });
  return server;
}

async function openNewNote(page: Page) {
  await page.goto('/organisation');
  await page.getByRole('button', { name: 'Notizen', exact: true }).click();
  await page.getByRole('button', { name: 'Notiz erstellen', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Inhalt').fill('Arztfragen\nBlutwerte besprechen');
  return dialog;
}

test('fehlgeschlagenes Speichern: Dialog bleibt offen, Eingabe bleibt erhalten, nichts erscheint als gespeichert', async ({ page }) => {
  const server = await mockOrganisation(page, { failPost: true });
  const dialog = await openNewNote(page);
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Inhalt')).toHaveValue('Arztfragen\nBlutwerte besprechen');
  await expect(page.getByRole('alert').or(dialog.locator('.field-error, .form-error, [role=alert]')).first()).toBeVisible();
  await expect(page.locator('.note__title')).toHaveCount(0);
  expect(server.posts).toBe(1);
});

test('Doppelklick auf Speichern erzeugt genau eine Notiz', async ({ page }) => {
  const server = await mockOrganisation(page, { slowPost: true });
  const dialog = await openNewNote(page);
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).dblclick();
  await expect(page.locator('.note__title')).toHaveText(['Arztfragen']);
  expect(server.posts).toBe(1);
});

test('nach dem Neuladen zeigt die Seite genau den Stand des Servers', async ({ page }) => {
  const server = await mockOrganisation(page);
  const dialog = await openNewNote(page);
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.locator('.note__title')).toHaveText(['Arztfragen']);
  server.notes.length = 0; // auf dem Server inzwischen gelöscht (z. B. auf einem anderen Gerät)
  await page.reload();
  await page.getByRole('button', { name: 'Notizen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Noch keine Notizen' })).toBeVisible();
});
