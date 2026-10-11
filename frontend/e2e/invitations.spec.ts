import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Invitation System V1 im Browser: Glocke, Startseite und Personen & Gruppen lesen dieselbe Einladung.
// Die API ist nachgebildet; Rechte, Rennen und Grenzen prüft das Backend (backend/core/test_invitations.py).

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const householdInvite = {
  id: 41,
  scope: { type: 'HOUSEHOLD', id: 7, display_name: 'Unser Zuhause', detail: 'Haushalt' },
  role: 'MEMBER',
  role_label: 'Mitglied',
  status: 'PENDING',
  created_at: minutesAgo(5),
  expires_at: minutesAgo(-60 * 24 * 14),
  inviter: { display_name: 'Sophie' },
};
const sentInvite = {
  id: 42,
  scope: { type: 'TRIP', id: 9, display_name: 'Berlin', detail: '12.–16. November 2026' },
  role: 'VIEWER',
  role_label: 'Kann ansehen',
  status: 'PENDING',
  created_at: minutesAgo(120),
  expires_at: minutesAgo(-60 * 24 * 14),
  invitee: { display_name: 'Ben' },
};

interface State {
  received: unknown[];
  sent: unknown[];
  unread: boolean;
  calls: string[];
  contact?: boolean;
  verified?: boolean;
  accepted?: unknown[];
  declined?: unknown[];
}

async function mockApi(page: Page, state: State) {
  // Alles Übrige ruhig beantworten — dieser Test prüft nur Einladungen.
  await page.route('**/api/v1/**', (r) => r.fulfill({ json: {} }));
  await page.route('**/api/v1/reisen/**', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/v1/organisation/tasks/**', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/v1/finanzen/private/summary/**', (r) =>
    r.fulfill({ json: { month: '', budget: null, total: null, available: null, income: '0.00', expenses: '0.00', saved: '0.00', recent: [], has_data: false } }),
  );
  await page.route('**/api/v1/today/**', (r) =>
    r.fulfill({ json: { date: '', timezone: 'Europe/Berlin', organisation: { items: [] }, haushalt: null, reisen: { events: [] }, finanzen: null, suggestions: [], link_suggestion: null } }),
  );
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) =>
    r.fulfill({ json: { access: 't', user: { name: 'Alex', email: 'alex@example.com', email_verified: state.verified ?? true } } }),
  );
  await page.route('**/api/v1/auth/email/resend/', (r) => {
    state.calls.push('resend');
    return r.fulfill({ json: { detail: 'ok', dev_link: 'http://localhost:4200/email-bestaetigen?token=lokal' } });
  });
  await page.route('**/api/v1/contacts/invites/**', (r) => {
    state.calls.push(`${r.request().method()} ${new URL(r.request().url()).pathname.replace('/api/v1/contacts', '')}`);
    state.contact = false;
    return r.fulfill({ status: 201, json: {} });
  });
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true, domains: [] } }));
  await page.route('**/api/v1/contacts/', (r) =>
    r.fulfill({
      json: {
        contacts: [
          {
            id: 1, name: 'Ben', email: 'ben@example.com', relation: 'FRIEND', since: minutesAgo(9000),
            shared: [], can_add_to: [{ kind: 'HOUSEHOLD', id: 3, title: 'Alex’ Zuhause' }], invited_to: [],
          },
        ],
        sent: [],
        received: [],
      },
    }),
  );
  await page.route('**/api/v1/household/members/', (r) =>
    r.fulfill({
      json: {
        household: { id: 3, name: 'Alex’ Zuhause' },
        members: [{ id: 5, name: 'Alex', role: 'ADMIN', role_label: 'Verwaltet', is_self: true, can_remove: false }],
        can_invite: true,
        can_leave: false,
      },
    }),
  );
  await page.route('**/api/v1/notifications/**', (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith('/read/')) {
      state.calls.push('read');
      state.unread = false;
      return r.fulfill({ status: 204 });
    }
    const items: unknown[] = state.received.map((inv, i) => ({ id: 100 + i, kind: 'INVITATION_CREATED', read: !state.unread, created_at: (inv as { created_at: string }).created_at, invitation: inv }));
    for (const note of state.accepted ?? []) items.push({ ...(note as object), read: !state.unread });
    if (state.contact) {
      items.unshift({ id: 99, kind: 'CONTACT_INVITE', read: !state.unread, created_at: minutesAgo(1),
        contact_invite: { token: 'tok-richard', from_name: 'Richard', relation: 'FAMILY', relation_label: 'Familie' } });
    }
    return r.fulfill({ json: { unread: state.unread ? items.length : 0, items } });
  });
  await page.route('**/api/v1/invitations/**', (r) => {
    const req = r.request();
    const path = new URL(req.url()).pathname.replace('/api/v1/invitations', '');
    if (req.method() === 'GET') return r.fulfill({ json: { received: state.received, sent: state.sent, declined: state.declined ?? [] } });
    state.calls.push(`${req.method()} ${path}`);
    const id = Number(path.split('/')[1]);
    state.received = state.received.filter((i) => (i as { id: number }).id !== id);
    state.sent = state.sent.filter((i) => (i as { id: number }).id !== id);
    if (path.endsWith('/accept/')) return r.fulfill({ json: { ...householdInvite, status: 'ACCEPTED' } });
    return r.fulfill({ status: 204 });
  });
}

const fresh = (): State => ({ received: [householdInvite], sent: [sentInvite], unread: true, calls: [] });

test('Glocke: dezenter Zähler, Einladung annehmen, gelesen ≠ angenommen, Fokus und Escape', async ({ page }) => {
  const state = fresh();
  await mockApi(page, state);
  await page.goto('/familie');

  const bell = page.getByRole('button', { name: 'Benachrichtigungen, 1 ungelesen' });
  await expect(bell).toBeVisible();
  await bell.click();
  const panel = page.getByRole('dialog', { name: 'Benachrichtigungen' });
  await expect(panel).toContainText('Sophie hat dich zu „Unser Zuhause“ eingeladen.');
  await expect(panel).toContainText('Haushalt · Mitglied · vor 5 Minuten');
  await expect(panel.getByRole('button', { name: 'Annehmen' })).toBeFocused();
  // Öffnen markiert als gelesen — die Einladung bleibt offen
  await expect.poll(() => state.calls).toContain('read');
  expect(state.calls.filter((c) => c.startsWith('POST'))).toEqual([]);
  expect((await new AxeBuilder({ page }).include('.bell-panel').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Benachrichtigungen' })).toBeFocused();

  await page.getByRole('button', { name: 'Benachrichtigungen' }).click();
  await page.getByRole('dialog', { name: 'Benachrichtigungen' }).getByRole('button', { name: 'Annehmen' }).click();
  await expect(page.getByRole('dialog', { name: 'Benachrichtigungen' })).toContainText('Du bist jetzt Mitglied von „Unser Zuhause“.');
  await expect(page.getByRole('dialog', { name: 'Benachrichtigungen' })).toContainText('Keine neuen Benachrichtigungen.');
  expect(state.calls).toContain('POST /41/accept/');
  // Dieselbe Einladung ist auch aus Personen & Gruppen verschwunden
  await page.keyboard.press('Escape');
  await expect(page.getByText('Von Sophie · Haushalt · Mitglied')).toHaveCount(0);
});

test('Personen & Gruppen: empfangen annehmen/ablehnen, gesendet zurückziehen, zu Haushalt einladen', async ({ page }) => {
  const state = fresh();
  await mockApi(page, state);
  await page.goto('/familie');

  const invites = page.getByRole('region', { name: /Offene Einladungen/ });
  await expect(invites).toContainText('Unser Zuhause');
  await expect(invites).toContainText('Von Sophie · Haushalt · Mitglied');
  await expect(invites).toContainText('An Ben · Kann ansehen · Ausstehend');
  await expect(invites).toContainText('Gesendet vor 2 Stunden');

  await invites.getByRole('button', { name: 'Einladung an Ben zu Berlin zurückziehen' }).click();
  await expect(invites).not.toContainText('An Ben');
  await invites.getByRole('button', { name: 'Einladung zu Unser Zuhause ablehnen' }).click();
  await expect(page.getByRole('region', { name: /Offene Einladungen/ })).toHaveCount(0);
  expect(state.calls).toEqual(expect.arrayContaining(['POST /42/revoke/', 'POST /41/decline/']));

  await page.getByRole('button', { name: 'Mit Ben teilen' }).click();
  await page.getByRole('button', { name: 'Alex’ Zuhause' }).click();
  await expect(page.getByRole('status').first()).toContainText('Einladung gesendet. Ben ist bei „Alex’ Zuhause“ dabei, sobald Ben annimmt.');
  expect(state.calls).toContain('POST /');
});

test('Startseite: eine offene Einladung erscheint als ruhige Zeile', async ({ page }) => {
  const state = fresh();
  await mockApi(page, state);
  await page.goto('/');
  const hint = page.getByRole('link', { name: /Sophie hat dich zu „Unser Zuhause“ eingeladen/ });
  await expect(hint).toBeVisible();
  await expect(hint).toHaveAttribute('href', '/familie');
  const box = await hint.boundingBox();
  expect(box!.height).toBeLessThan(80); // keine Hero-Karte
});

for (const width of [360, 390, 430]) {
  test(`Handy ${width}px: Glocke bleibt im Bild, Knöpfe sind groß genug`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const state = fresh();
    await mockApi(page, state);
    await page.goto('/familie');
    await page.getByRole('button', { name: /Benachrichtigungen/ }).click();
    const panel = page.locator('.bell-panel');
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    for (const name of ['Annehmen', 'Ablehnen']) {
      const button = (await panel.getByRole('button', { name }).boundingBox())!;
      expect(button.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
}

test('Kontaktanfrage erscheint mit Name in Glocke und Startseite und lässt sich dort annehmen', async ({ page }) => {
  const state: State = { received: [], sent: [], unread: true, calls: [], contact: true };
  await mockApi(page, state);
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Richard möchte dich als Familie hinzufügen/ })).toBeVisible();
  await page.getByRole('button', { name: 'Benachrichtigungen, 1 ungelesen' }).click();
  const panel = page.getByRole('dialog', { name: 'Benachrichtigungen' });
  await expect(panel).toContainText('Richard möchte dich als Familie hinzufügen.');
  await panel.getByRole('button', { name: 'Annehmen' }).click();
  await expect(panel).toContainText('Du bist jetzt mit Richard verbunden.');
  expect(state.calls).toContain('POST /invites/tok-richard/accept/');
  await expect(page.getByRole('link', { name: /Richard möchte dich/ })).toHaveCount(0);
});

test('ohne bestätigte E-Mail: ruhiger Hinweis mit „Mail senden“ statt Einladungen', async ({ page }) => {
  const state: State = { received: [], sent: [], unread: false, calls: [], verified: false };
  await mockApi(page, state);
  await page.goto('/');
  await expect(page.getByText('Bestätige deine E-Mail-Adresse – erst dann siehst du hier, wer dich eingeladen hat.')).toBeVisible();
  await page.getByRole('button', { name: 'Mail senden' }).click();
  // Lokal (keine echte Mail): der Link erscheint direkt — nur als Pfad innerhalb der App
  await expect(page.getByText('Entwicklungsmodus: Es wird keine echte Mail verschickt.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Jetzt bestätigen' })).toHaveAttribute('href', '/email-bestaetigen?token=lokal');
  expect(state.calls).toContain('resend');
});

test('E-Mail-Bestätigungsseite: Token verschwindet aus der Adresszeile, Erfolg und ungültiger Link', async ({ page }) => {
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ status: 401, json: {} }));
  await page.route('**/api/v1/auth/email/verify/', (r) =>
    (r.request().postDataJSON() as { token: string }).token === 'gut'
      ? r.fulfill({ json: { detail: 'E-Mail-Adresse bestätigt.' } })
      : r.fulfill({ status: 400, json: { detail: 'ungültig' } }),
  );
  await page.goto('/email-bestaetigen?token=gut');
  await expect(page.getByRole('heading', { name: 'E-Mail-Adresse bestätigt' })).toBeVisible();
  expect(page.url()).not.toContain('token');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  await page.goto('/email-bestaetigen?token=alt');
  await expect(page.getByRole('heading', { name: 'Dieser Link funktioniert nicht mehr' })).toBeVisible();
});

test('Einladende Person: Annahme als Erfolg mit nächstem Schritt, Ablehnung nur still als Status', async ({ page }) => {
  const state: State = {
    received: [], sent: [], unread: true, calls: [],
    accepted: [
      { id: 7, kind: 'CONTACT_ACCEPTED', created_at: minutesAgo(3), accepted: { name: 'Lena', relation_label: 'Freund:in' } },
      { id: 8, kind: 'INVITATION_ACCEPTED', created_at: minutesAgo(30), accepted: { name: 'Ben', scope: { type: 'TRIP', id: 9, display_name: 'Berlin' } } },
    ],
    declined: [{ ...sentInvite, id: 50, status: 'DECLINED', invitee: { display_name: 'Mia' } }],
  };
  await mockApi(page, state);
  await page.goto('/');
  const line = page.getByRole('link', { name: /Lena hat deine Einladung angenommen\. Ihr seid jetzt verbunden\./ });
  await expect(line).toBeVisible();
  await expect(line).toContainText('Etwas teilen');

  await page.getByRole('button', { name: 'Benachrichtigungen, 2 ungelesen' }).click();
  const panel = page.getByRole('dialog', { name: 'Benachrichtigungen' });
  await expect(panel).toContainText('Ben ist jetzt bei „Berlin“ dabei.');
  await expect(panel.getByRole('link', { name: 'Zur Reise' })).toHaveAttribute('href', '/reisen?trip=9');
  await expect(panel).not.toContainText('abgelehnt');
  await page.keyboard.press('Escape');

  await page.goto('/familie');
  const invites = page.getByRole('region', { name: /Offene Einladungen/ });
  await expect(invites).toContainText('Nicht angenommen');
  await expect(invites).toContainText('An Mia · Reise · Nicht angenommen');
});
