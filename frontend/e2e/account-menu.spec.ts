import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function signedIn(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira Beispiel', email: 'mira@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  await page.route('**/api/v1/organisation/today/**', (r) => r.fulfill({ json: { items: [], event_count: 0 } }));
  await page.route('**/api/v1/finanzen/private/**', (r) =>
    r.fulfill({ json: r.request().url().includes('/summary/') ? { month: '2026-09', currency: 'EUR', budget: null, total: null, saved: '0.00', saved_planned: '0.00', available: null, plan_alert: null, income: '0.00', expenses: '0.00', savings_target: '0.00', savings_current: '0.00', has_data: false, categories: [], recent: [] } : [] }),
  );
  await page.route('**/api/v1/haushalt/**', (r) => r.fulfill({ json: { open_tasks: 0 } }));
}

test('the profile button opens an account menu with name, email and the account actions', async ({ page }) => {
  await signedIn(page);
  await page.goto('/app');
  const trigger = page.getByRole('button', { name: 'Kontomenü' });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();

  const menu = page.getByRole('menu', { name: 'Konto' });
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(menu).toContainText('Mira Beispiel');
  await expect(menu).toContainText('mira@example.com');
  for (const item of ['Familie & Freunde', 'Einstellungen', 'Zwei-Faktor-Authentifizierung', 'Datenschutz', 'Barrierefreiheit', 'Abmelden'])
    await expect(menu.getByRole('menuitem', { name: item })).toBeVisible();
  // Fokus liegt im Menü, Pfeiltasten wandern
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Einstellungen' })).toBeFocused();
  expect((await new AxeBuilder({ page }).include('.account-menu').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

  // Escape schließt und gibt den Fokus zurück
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();

  // Klick daneben schließt ebenfalls
  await trigger.click();
  await expect(menu).toBeVisible();
  await page.mouse.click(300, 400);
  await expect(menu).toBeHidden();

  // Einstellungen: navigiert und schließt das Menü
  await trigger.click();
  await menu.getByRole('menuitem', { name: 'Einstellungen' }).click();
  await expect(page).toHaveURL(/\/einstellungen$/);
  await expect(page.getByRole('menu', { name: 'Konto' })).toHaveCount(0);
});

test('the settings page sits in the app shell with grouped settings and passes axe', async ({ page }) => {
  await signedIn(page);
  await page.goto('/einstellungen');
  await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible();
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.locator('.settings-profile')).toContainText('mira@example.com');
  await expect(page.getByRole('heading', { name: 'Sicherheit' })).toBeVisible();
  await page.getByRole('link', { name: /Zwei-Faktor-Authentifizierung/ }).first().click();
  await expect(page).toHaveURL(/zwei-faktor/);
  await page.goBack();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

test('the profile page changes the name and the menu follows; the email stays read-only', async ({ page }) => {
  await signedIn(page);
  let sent: unknown = null;
  await page.route('**/api/v1/auth/me/', async (r) => {
    sent = r.request().postDataJSON();
    return r.fulfill({ json: { name: (sent as { name: string }).name, email: 'mira@example.com' } });
  });
  await page.goto('/einstellungen/profil');
  await expect(page.getByRole('heading', { name: 'Profil', level: 1 })).toBeVisible();
  await expect(page.getByLabel('E-Mail-Adresse')).toHaveAttribute('readonly', '');
  const save = page.getByRole('button', { name: 'Speichern' });
  await expect(save).toBeDisabled(); // nichts geändert

  await page.getByLabel('Name').fill('M');
  await save.click();
  await expect(page.getByRole('alert')).toContainText('mindestens 2 Zeichen');
  expect(sent).toBeNull();

  await page.getByLabel('Name').fill('Mira Neu');
  await save.click();
  await expect(page.getByRole('status')).toContainText('Gespeichert');
  expect(sent).toEqual({ name: 'Mira Neu' });
  await expect(page.getByRole('button', { name: 'Kontomenü' })).toContainText('Mira Neu');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

test('active sessions lists the devices, signs one out and all others', async ({ page }) => {
  await signedIn(page);
  let rows = [
    { id: 'a', device: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605 Version/17.0 Safari/605', created_at: '2026-09-20T10:00:00Z', last_seen: '2026-09-26T12:30:00Z', current: true },
    { id: 'b', device: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Mobile Safari/604', created_at: '2026-09-21T10:00:00Z', last_seen: '2026-09-25T08:00:00Z', current: false },
    { id: 'c', device: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36', created_at: '2026-09-22T10:00:00Z', last_seen: '2026-09-24T08:00:00Z', current: false },
  ];
  const deleted: string[] = [];
  await page.route('**/api/v1/auth/sessions/**', async (r) => {
    const url = new URL(r.request().url()).pathname;
    if (r.request().method() === 'DELETE') {
      const id = url.split('/').filter(Boolean).pop()!;
      deleted.push(id === 'sessions' ? 'others' : id);
      rows = id === 'sessions' ? rows.filter((x) => x.current) : rows.filter((x) => x.id !== id);
      return r.fulfill({ status: 204 });
    }
    return r.fulfill({ json: rows });
  });
  await page.goto('/einstellungen/sitzungen');
  const list = page.getByRole('list', { name: 'Angemeldete Geräte' });
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(list.getByRole('listitem').first()).toContainText('Safari auf Mac');
  await expect(list.getByRole('listitem').first()).toContainText('Dieses Gerät');
  await expect(list.getByRole('button', { name: 'Safari auf Mac abmelden' })).toHaveCount(0); // das eigene meldet man mit „Abmelden“ ab
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

  await expect(page.getByRole('button', { name: 'Alle anderen Geräte abmelden' })).toBeVisible(); // zwei andere Geräte
  await list.getByRole('button', { name: 'Safari auf iPhone abmelden' }).click();
  await expect(page.getByRole('status')).toContainText('Safari auf iPhone wurde abgemeldet');
  await expect(list.getByRole('listitem')).toHaveCount(2);
  expect(deleted).toEqual(['b']);

  await expect(page.getByRole('button', { name: 'Alle anderen Geräte abmelden' })).toHaveCount(0); // nur noch eins anderes
  await expect(list.getByRole('button', { name: 'Chrome auf Windows abmelden' })).toBeVisible();
});

test('"Alle anderen Geräte abmelden" keeps only this device', async ({ page }) => {
  await signedIn(page);
  const mk = (id: string, current: boolean) => ({ id, device: 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0', created_at: '2026-09-20T10:00:00Z', last_seen: '2026-09-26T10:00:00Z', current });
  let rows = [mk('a', true), mk('b', false), mk('c', false)];
  let others = 0;
  await page.route('**/api/v1/auth/sessions/', async (r) => {
    if (r.request().method() === 'DELETE') {
      others++;
      rows = rows.filter((x) => x.current);
      return r.fulfill({ status: 204 });
    }
    return r.fulfill({ json: rows });
  });
  await page.goto('/einstellungen/sitzungen');
  await page.getByRole('button', { name: 'Alle anderen Geräte abmelden' }).click();
  await expect(page.getByRole('status').first()).toContainText('Alle anderen Geräte wurden abgemeldet');
  await expect(page.getByRole('list', { name: 'Angemeldete Geräte' }).getByRole('listitem')).toHaveCount(1);
  await expect(page.getByText('Du bist nur auf diesem Gerät angemeldet.')).toBeVisible();
  expect(others).toBe(1);
});

test.describe('two-factor page', () => {
  test('shows the active state without offering the setup again', async ({ page }) => {
    await signedIn(page);
    await page.route('**/api/v1/auth/mfa/status/', (r) => r.fulfill({ json: { enabled: true } }));
    await page.goto('/einstellungen/zwei-faktor');
    await expect(page.getByRole('heading', { name: 'Zwei-Faktor-Authentifizierung', level: 1 })).toBeVisible();
    await expect(page.getByText('Dein Konto ist zusätzlich geschützt')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Einrichtung starten' })).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Fortschritt der Einrichtung' })).toHaveCount(0);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  });

  test('guides through the three steps: start, scan and confirm, save the backup codes', async ({ page }) => {
    await signedIn(page);
    await page.route('**/api/v1/auth/mfa/status/', (r) => r.fulfill({ json: { enabled: false } }));
    await page.route('**/api/v1/auth/mfa/setup/', (r) =>
      r.fulfill({ json: { secret: 'JBSWY3DPEHPK3PXP', otpauth_url: 'otpauth://totp/x', qr_code: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' } }),
    );
    let sent = '';
    await page.route('**/api/v1/auth/mfa/verify/', async (r) => {
      sent = (r.request().postDataJSON() as { code: string }).code;
      if (sent !== '123456') return r.fulfill({ status: 400, json: { detail: 'Der Code ist ungültig oder abgelaufen.' } });
      return r.fulfill({ json: { detail: 'ok', backup_codes: ['AAAA-1111', 'BBBB-2222', 'CCCC-3333', 'DDDD-4444'] } });
    });
    await page.goto('/einstellungen/zwei-faktor');

    // Schritt 1
    const steps = page.getByRole('list', { name: 'Fortschritt der Einrichtung' });
    await expect(steps.getByRole('listitem').first()).toHaveAttribute('aria-current', 'step');
    await page.getByRole('button', { name: 'Einrichtung starten' }).click();

    // Schritt 2: QR-Code, Schlüssel in Vierergruppen, Eingabe nimmt nur Ziffern
    await expect(page.getByRole('img', { name: /QR-Code/ })).toBeVisible();
    await expect(page.getByLabel('Geheimer Schlüssel')).toHaveText('JBSW Y3DP EHPK 3PXP');
    const input = page.getByLabel('6-stelliger Code aus der App');
    await input.fill('12ab34x');
    await expect(input).toHaveValue('1234');
    await page.getByRole('button', { name: 'Bestätigen und aktivieren' }).click();
    await expect(page.getByRole('alert')).toContainText('6-stellige');
    expect(sent).toBe('');

    await input.fill('999999');
    await page.getByRole('button', { name: 'Bestätigen und aktivieren' }).click();
    await expect(page.getByRole('alert')).toContainText('Der Code stimmt nicht');
    await expect(input).toHaveValue('');

    await input.fill('123456');
    await page.getByRole('button', { name: 'Bestätigen und aktivieren' }).click();

    // Schritt 3: Codes sichern, „Fertig“ erst nach Bestätigung
    const codes = page.getByRole('list', { name: 'Backup-Codes' });
    await expect(codes.getByRole('listitem')).toHaveCount(4);
    const done = page.getByRole('link', { name: 'Fertig' });
    await expect(done).toHaveAttribute('aria-disabled', 'true');
    await page.getByLabel('Ich habe die Codes an einem sicheren Ort gespeichert.').check();
    await expect(done).toHaveAttribute('aria-disabled', 'false');
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await done.click();
    await expect(page).toHaveURL(/\/einstellungen$/);
  });

  test('a 400 on start means it is already active, not an error', async ({ page }) => {
    await signedIn(page);
    await page.route('**/api/v1/auth/mfa/status/', (r) => r.fulfill({ status: 500, json: {} }));
    await page.route('**/api/v1/auth/mfa/setup/', (r) => r.fulfill({ status: 400, json: { detail: 'bereits aktiv' } }));
    await page.goto('/einstellungen/zwei-faktor');
    await page.getByRole('button', { name: 'Einrichtung starten' }).click();
    await expect(page.getByText('Dein Konto ist zusätzlich geschützt')).toBeVisible();
  });
});

test('the mobile bottom bar has only Start and the four areas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signedIn(page);
  await page.goto('/app');
  const nav = page.getByRole('navigation', { name: 'Mobile Navigation' });
  await expect(nav.getByRole('link')).toHaveText(['Start', 'Finanzen', 'Haushalt', 'Organisation', 'Reisen']);
  await expect(nav.getByRole('button')).toHaveCount(0); // kein „+“, kein „Mehr“
  await expect(nav.getByRole('link', { name: 'Start' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Finanzen' }).click();
  await expect(page).toHaveURL(/\/app\/finanzen$/);
});

test('on the phone the account menu leads to Familie & Freunde', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signedIn(page);
  await page.route('**/api/v1/contacts/', (r) => r.fulfill({ json: { contacts: [], sent: [], received: [] } }));
  await page.goto('/app');
  await page.getByRole('button', { name: 'Kontomenü' }).click();
  await page.getByRole('menuitem', { name: 'Familie & Freunde' }).click();
  await expect(page).toHaveURL(/\/app\/familie$/);
  await expect(page.getByRole('heading', { name: 'Familie & Freunde', level: 1 })).toBeVisible();
});

test('the preview (guest) account menu offers only "Anmelden", not "Konto erstellen"', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Kontomenü' }).click();
  const menu = page.getByRole('menu', { name: 'Konto' });
  await expect(menu).toContainText('Vorschau');
  await expect(menu).toContainText('Beispieldaten, kein Konto');
  await expect(menu.getByRole('menuitem', { name: 'Anmelden' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Konto erstellen' })).toHaveCount(0);
});
