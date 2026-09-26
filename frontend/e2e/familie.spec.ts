import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function signedIn(page: Page, email = 'mira@example.com') {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira', email } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
}

type Overview = { contacts: unknown[]; sent: unknown[]; received: unknown[] };

async function mockContacts(page: Page, state: Overview) {
  const calls: string[] = [];
  await page.route('**/api/v1/contacts/**', async (r) => {
    const req = r.request();
    const path = new URL(req.url()).pathname.replace('/api/v1/contacts', '');
    if (req.method() === 'GET' && (path === '/' || path === '')) return r.fulfill({ json: state });
    calls.push(`${req.method()} ${path}`);
    if (req.method() === 'POST' && path === '/invites/') {
      const body = req.postDataJSON() as { email: string; relation: string };
      state.sent = [...state.sent, { id: 9, email: body.email, relation: body.relation, expires_at: '2026-10-10T00:00:00Z' }];
      return r.fulfill({ status: 201, json: { id: 9, email: body.email, email_sent: true } });
    }
    if (req.method() === 'DELETE' && path.startsWith('/invites/')) {
      state.sent = [];
      return r.fulfill({ status: 204 });
    }
    if (req.method() === 'POST' && path.endsWith('/accept/')) {
      state.contacts = [{ id: 1, name: 'Tom', email: 'tom@example.com', relation: 'FRIEND', since: '2026-09-26T00:00:00Z' }];
      state.received = [];
      return r.fulfill({ status: 201, json: state.contacts[0] });
    }
    if (req.method() === 'POST' && path.endsWith('/decline/')) {
      state.received = [];
      return r.fulfill({ status: 204 });
    }
    if (req.method() === 'DELETE') {
      state.contacts = [];
      return r.fulfill({ status: 204 });
    }
    return r.fulfill({ status: 404, json: {} });
  });
  return calls;
}

test('empty state explains the idea; inviting adds an open invite, cancelling removes it', async ({ page }) => {
  await signedIn(page);
  const state: Overview = { contacts: [], sent: [], received: [] };
  const calls = await mockContacts(page, state);
  await page.goto('/app/familie');
  await expect(page.getByRole('heading', { name: 'Familie & Freunde', level: 1 })).toBeVisible();
  await expect(page.getByText('Eine Verbindung teilt noch nichts')).toBeVisible();
  await expect(page.getByText('Noch niemand hier.')).toBeVisible();

  // Validierung
  await page.getByRole('button', { name: 'Einladung senden' }).click();
  await expect(page.getByRole('alert')).toContainText('gültige E-Mail-Adresse');
  expect(calls).toEqual([]);

  // Einladen als Familie
  await page.getByLabel('E-Mail-Adresse').fill('tom@example.com');
  await page.locator('label.fam-chip', { hasText: 'Familie' }).click(); // die Auswahl ist ein Chip (Label um ein verstecktes Radio)
  await page.getByRole('button', { name: 'Einladung senden' }).click();
  await expect(page.getByRole('status').first()).toContainText('Einladung an tom@example.com gesendet.');
  await expect(page.getByRole('heading', { name: 'Offene Einladungen' })).toBeVisible();
  await expect(page.getByText('Familie · wartet auf Antwort bis')).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

  await page.getByRole('button', { name: 'Einladung an tom@example.com zurückziehen' }).click();
  await expect(page.getByRole('heading', { name: 'Offene Einladungen' })).toHaveCount(0);
  expect(calls).toEqual(['POST /invites/', 'DELETE /invites/9/']);
});

test('a received invite can be accepted; contacts are grouped and removal asks first', async ({ page }) => {
  await signedIn(page);
  const state: Overview = { contacts: [], sent: [], received: [{ token: 'abc', from_name: 'Tom', relation: 'FRIEND', expires_at: '2026-10-10T00:00:00Z' }] };
  const calls = await mockContacts(page, state);
  await page.goto('/app/familie');
  await expect(page.getByRole('heading', { name: 'Einladungen an dich' })).toBeVisible();
  await expect(page.getByText('möchte dich als Freund:in hinzufügen')).toBeVisible();
  await page.getByRole('button', { name: 'Annehmen' }).click();
  await expect(page.getByRole('status').first()).toContainText('Du bist jetzt mit Tom verbunden.');
  await expect(page.getByRole('heading', { name: 'Freunde', exact: true })).toBeVisible();
  await expect(page.getByText('tom@example.com')).toBeVisible();

  await page.getByRole('button', { name: 'Verbindung zu Tom beenden' }).click();
  await expect(page.getByRole('button', { name: 'Ja, beenden' })).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('button', { name: 'Ja, beenden' })).toHaveCount(0);
  expect(calls).toEqual(['POST /invites/abc/accept/']);
  await page.getByRole('button', { name: 'Verbindung zu Tom beenden' }).click();
  await page.getByRole('button', { name: 'Ja, beenden' }).click();
  await expect(page.getByRole('status').first()).toContainText('Die Verbindung zu Tom wurde beendet.');
  expect(calls).toEqual(['POST /invites/abc/accept/', 'DELETE /1/']);
});

test('the invite link: guests are told to sign in, the invited account can accept, others see a neutral message', async ({ page }) => {
  // ohne Anmeldung
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ status: 401, json: {} }));
  await page.goto('/einladung/abc');
  await expect(page.getByRole('heading', { name: 'Du wurdest zu 4inOne eingeladen' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Anmelden' })).toBeVisible();
});

test('the invite link for the invited account shows the sender and accepts', async ({ page }) => {
  await signedIn(page, 'tom@example.com');
  const state: Overview = { contacts: [], sent: [], received: [] };
  const calls = await mockContacts(page, state);
  await page.route('**/api/v1/contacts/invites/abc/', (r) => r.fulfill({ json: { from_name: 'Mira', relation: 'FAMILY', expires_at: '2026-10-10T00:00:00Z' } }));
  await page.goto('/einladung/abc');
  await expect(page.getByRole('heading', { name: 'Mira lädt dich ein' })).toBeVisible();
  await expect(page.getByText('als Familie hinzufügen')).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Annehmen' }).click();
  await expect(page).toHaveURL(/\/app\/familie$/);
  expect(calls).toContain('POST /invites/abc/accept/');
});

test('an invite for another account looks like an invalid one', async ({ page }) => {
  await signedIn(page, 'fremd@example.com');
  await page.route('**/api/v1/contacts/invites/zzz/', (r) => r.fulfill({ status: 404, json: {} }));
  await page.goto('/einladung/zzz');
  await expect(page.getByRole('heading', { name: 'Diese Einladung gilt nicht' })).toBeVisible();
});
