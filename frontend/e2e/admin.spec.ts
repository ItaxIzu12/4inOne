import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Admin-Panel (docs/MONITORING.md) im Browser mit nachgestellten API-Antworten — die Rechte selbst prüft das Backend
// (backend/monitoring/tests.py). Hier: Menüpunkt nur für Admins, Darstellung, Barrierefreiheit, Handy-Breite.

const OVERVIEW = {
  accounts: { total: 12, new_7d: 3, active_7d: 7 },
  events_24h: { registered: 1, login_succeeded: 9, login_failed: 4, locked_out: 1, mfa_failed: 0, password_reset_requested: 0, password_reset_completed: 0 },
  events_7d: { registered: 3, login_succeeded: 40, login_failed: 6, locked_out: 1, mfa_failed: 0, password_reset_requested: 1, password_reset_completed: 1 },
  labels: {},
  monitoring: { connected: true, environment: 'entwicklung', url: 'http://localhost:8001', errors_available: true },
  retention_days: 90,
};
const EVENTS = [
  { id: 4, kind: 'locked_out', label: 'Gesperrt nach Fehlversuchen', created_at: '2026-11-15T10:12:00Z', user: { name: 'Sophie', email: 's•••@example.com' }, ip_prefix: '203.0.113.0' },
  { id: 3, kind: 'login_failed', label: 'Anmeldung fehlgeschlagen', created_at: '2026-11-15T10:10:00Z', user: null, ip_prefix: '198.51.100.0' },
  { id: 2, kind: 'login_succeeded', label: 'Angemeldet', created_at: '2026-11-15T09:00:00Z', user: { name: 'Max', email: 'm•••@example.com' }, ip_prefix: '192.0.2.0' },
  { id: 1, kind: 'registered', label: 'Registriert', created_at: '2026-11-14T18:30:00Z', user: { name: 'Lena', email: 'l•••@example.com' }, ip_prefix: '192.0.2.0' },
];

async function mock(page: Page, opts: { admin?: boolean; mfa?: boolean } = {}) {
  const { admin = true, mfa = true } = opts;
  await page.route('**/api/v1/**', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 'test' } }));
  await page.route('**/api/v1/auth/refresh/', (r) =>
    r.fulfill({ json: { access: 'test', user: { name: 'Ada', email: 'ada@example.com', email_verified: true, is_admin: admin } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  await page.route('**/api/v1/notifications/**', (r) => r.fulfill({ json: { unread: 0, items: [] } }));
  await page.route('**/api/v1/invitations/**', (r) => r.fulfill({ json: { received: [], sent: [], declined: [] } }));
  await page.route('**/api/v1/monitoring/config/', (r) => r.fulfill({ json: { enabled: false, dsn: null, environment: 'test' } }));
  await page.route('**/api/v1/admin/overview/', (r) =>
    mfa ? r.fulfill({ json: OVERVIEW }) : r.fulfill({ status: 403, json: { detail: 'x', code: 'mfa_required' } }));
  await page.route('**/api/v1/admin/events/**', (r) => r.fulfill({ json: { results: EVENTS, page: 1, has_more: true } }));
  await page.route('**/api/v1/admin/errors/', (r) =>
    r.fulfill({ json: { available: true, issues: [{ id: '7', title: 'ZeroDivisionError: division by zero', culprit: 'finanzen.views in summary', level: 'error', count: 3, last_seen: '2026-11-15T10:00:00Z', link: 'http://localhost:8001/4inone/issues/7' }] } }));
}

async function axe(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
}

for (const width of [390, 1440]) {
  test(`Admin-Panel bei ${width}px: Status, Kennzahlen, Ereignisse, Fehler — barrierearm, ohne Querscrollen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mock(page);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Admin-Panel', level: 1 })).toBeVisible();
    await expect(page.getByText('GlitchTip verbunden')).toBeVisible();
    await expect(page.locator('.admin__kpi.is-bad .admin__kpi-value')).toHaveText('1');
    await expect(page.locator('.admin__event')).toHaveCount(4);
    await expect(page.getByText('Unbekanntes Konto')).toBeVisible();
    await expect(page.getByRole('link', { name: /ZeroDivisionError/ })).toHaveAttribute('rel', /noopener/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await axe(page);
    await page.screenshot({ path: `test-results/admin-${width}.png`, fullPage: true });
  });
}

test('Menü: Admin-Panel nur für Admin-Konten; ohne Zwei-Faktor erklärt die Seite, was fehlt', async ({ page }) => {
  await mock(page, { admin: true, mfa: false });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Erst Zwei-Faktor einrichten' })).toBeVisible();
  await page.getByRole('button', { name: /Mein Konto|Konto/ }).first().click();
  await expect(page.getByRole('menuitem', { name: 'Admin-Panel' })).toBeVisible();
});

test('kein Admin: kein Menüpunkt, /admin führt zur Startseite', async ({ page }) => {
  await mock(page, { admin: false });
  await page.goto('/admin');
  await expect(page).not.toHaveURL(/\/admin/);
  await page.getByRole('button', { name: /Mein Konto|Konto/ }).first().click();
  await expect(page.getByRole('menuitem', { name: 'Admin-Panel' })).toHaveCount(0);
});
