import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function signedIn(page: Page, email = 'mira@example.com') {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira', email } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  // Einladungen zu Haushalt/Reise prüft e2e/invitations.spec.ts — hier leer.
  await page.route('**/api/v1/notifications/**', (r) => r.fulfill({ json: { unread: 0, items: [] } }));
  await page.route('**/api/v1/invitations/**', (r) => r.fulfill({ json: { received: [], sent: [] } }));
  await page.route('**/api/v1/household/members/', (r) =>
    r.fulfill({ json: { household: { id: 1, name: 'Zuhause', }, members: [], can_invite: true, can_leave: false } }),
  );
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
      state.sent = [...state.sent, { id: 9, email: body.email, relation: body.relation, expires_at: '2026-10-10T00:00:00Z', created_at: new Date().toISOString() }];
      return r.fulfill({ status: 201, json: { id: 9, email: body.email, email_sent: true } });
    }
    if (req.method() === 'DELETE' && path.startsWith('/invites/')) {
      state.sent = [];
      return r.fulfill({ status: 204 });
    }
    if (req.method() === 'POST' && path.endsWith('/accept/')) {
      state.contacts = [{ id: 1, name: 'Tom', email: 'tom@example.com', relation: 'FRIEND', since: '2026-09-26T00:00:00Z', shared: [], can_add_to: [], invited_to: [] }];
      state.received = [];
      return r.fulfill({ status: 201, json: state.contacts[0] });
    }
    if (req.method() === 'POST' && path.endsWith('/decline/')) {
      state.received = [];
      return r.fulfill({ status: 204 });
    }
    if (req.method() === 'PATCH') {
      const body = req.postDataJSON() as { relation: string };
      state.contacts = state.contacts.map((c) => ({ ...(c as object), relation: body.relation }));
      return r.fulfill({ json: state.contacts[0] });
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
  await page.goto('/familie');
  await expect(page.getByRole('heading', { name: 'Personen & Gruppen', level: 1 })).toBeVisible();
  await expect(page.getByText('Eine Verbindung teilt noch keine Daten.')).toBeVisible();
  await expect(page.getByText('Noch niemand hier.')).toBeVisible();

  // Validierung
  await page.getByRole('button', { name: 'Einladung senden' }).click();
  await expect(page.getByRole('alert')).toContainText('gültige E-Mail-Adresse');
  expect(calls).toEqual([]);

  // Einladen als Familie
  await page.getByLabel('E-Mail-Adresse').fill('tom@example.com');
  await page.locator('label.people-choice', { hasText: 'Familie' }).click(); // die Auswahl ist ein Feld (Label um ein verstecktes Radio)
  await page.getByRole('button', { name: 'Einladung senden' }).click();
  await expect(page.getByRole('status').first()).toContainText('Einladung an tom@example.com gesendet.');
  await expect(page.getByRole('heading', { name: 'Offene Einladungen' })).toBeVisible();
  await expect(page.getByText('Du hast als Familie eingeladen · wartet auf Antwort')).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

  await page.getByRole('button', { name: 'Einladung an tom@example.com zurückziehen' }).click();
  await expect(page.getByRole('heading', { name: 'Offene Einladungen' })).toHaveCount(0);
  expect(calls).toEqual(['POST /invites/', 'DELETE /invites/9/']);
});

test('a received invite can be accepted; contacts are grouped and removal asks first', async ({ page }) => {
  await signedIn(page);
  const state: Overview = { contacts: [], sent: [], received: [{ token: 'abc', from_name: 'Tom', relation: 'FRIEND', expires_at: '2026-10-10T00:00:00Z', created_at: new Date().toISOString() }] };
  const calls = await mockContacts(page, state);
  await page.goto('/familie');
  await expect(page.getByRole('heading', { name: 'Offene Einladungen' })).toBeVisible();
  await expect(page.getByText('möchte dich als Freund:in hinzufügen')).toBeVisible();
  await page.getByRole('button', { name: 'Annehmen' }).click();
  await expect(page.getByRole('status').first()).toContainText('Du bist jetzt mit Tom verbunden.');
  await expect(page.getByRole('heading', { name: 'Deine Personen' })).toBeVisible();
  await expect(page.getByText('Noch nichts geteilt')).toBeVisible();

  // Gruppen: nach Beziehung; über „…“ umstellen
  await page.getByRole('button', { name: 'Weitere Aktionen für Tom' }).click();
  await page.getByRole('button', { name: 'Als Familie markieren' }).click();
  await expect(page.getByRole('status').first()).toContainText('Tom steht jetzt unter Familie.');
  await page.getByRole('tab', { name: 'Gruppen' }).click();
  await expect(page.getByRole('region', { name: 'Familie' }).getByText('tom@example.com')).toBeVisible();
  await page.getByRole('tab', { name: 'Übersicht' }).click();

  // Beenden fragt erst nach
  await page.getByRole('button', { name: 'Weitere Aktionen für Tom' }).click();
  await page.getByRole('button', { name: 'Verbindung beenden' }).click();
  await expect(page.getByRole('button', { name: 'Ja, beenden' })).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('button', { name: 'Ja, beenden' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Weitere Aktionen für Tom' }).click();
  await page.getByRole('button', { name: 'Verbindung beenden' }).click();
  await page.getByRole('button', { name: 'Ja, beenden' }).click();
  await expect(page.getByRole('status').first()).toContainText('Die Verbindung zu Tom wurde beendet.');
  expect(calls).toEqual(['POST /invites/abc/accept/', 'PATCH /1/', 'DELETE /1/']);
});

test('from the public demo, "Personen & Gruppen" works without signing in and shows example data plus a short explanation', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('link', { name: 'Personen & Gruppen' }).click();
  await expect(page).toHaveURL(/\/demo\/familie$/);
  await expect(page).not.toHaveURL(/\/login/);

  await expect(page.getByRole('heading', { name: 'Personen & Gruppen', level: 1 })).toBeVisible();
  await expect(page.getByText('Beispieldaten · Änderungen gelten nur bis zum Neuladen.')).toBeVisible();

  // Testdaten statt leerem Zustand: bestehende Verbindungen, eine offene eigene Einladung, eine eingehende.
  const people = page.getByRole('region', { name: /Deine Personen/ });
  await expect(people.getByText('Max', { exact: true })).toBeVisible();
  await expect(people.getByText('Berlin Wochenende')).toBeVisible();
  await expect(people.getByText('Noch nichts geteilt')).toBeVisible();
  await expect(page.getByText('möchte dich als Freund:in hinzufügen')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Offene Einladungen/ })).toBeVisible();

  // Teilen: Lena zu einer kommenden Reise einladen — sie ist erst nach dem Annehmen dabei
  await page.getByRole('button', { name: 'Mit Lena teilen' }).click();
  await page.getByRole('button', { name: 'Italien Sommerurlaub' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Einladung gesendet. Lena ist bei „Italien Sommerurlaub“ dabei, sobald Lena annimmt.' })).toBeVisible();
  await expect(people.getByText('Eingeladen · ausstehend')).toBeVisible();
  await page.getByRole('tab', { name: 'Geteilte Bereiche' }).click();
  // Eine offene Einladung teilt noch nichts: nur Max ist wirklich bei einer Reise dabei.
  await expect(page.getByText('Reise · mit Max')).toBeVisible();
  await expect(page.getByText('Reise · mit Lena')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Übersicht' }).click();

  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
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
  await expect(page).toHaveURL(/\/familie$/);
  expect(calls).toContain('POST /invites/abc/accept/');
});

test('an invite for another account looks like an invalid one', async ({ page }) => {
  await signedIn(page, 'fremd@example.com');
  await page.route('**/api/v1/contacts/invites/zzz/', (r) => r.fulfill({ status: 404, json: {} }));
  await page.goto('/einladung/zzz');
  await expect(page.getByRole('heading', { name: 'Diese Einladung gilt nicht' })).toBeVisible();
});
