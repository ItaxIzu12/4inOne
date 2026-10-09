import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Haushalt V1: Heute · Aufgaben · Einkaufen · Zuhause (Geräte | Verträge). Läuft gegen die Demo (keine Backend-Aufrufe),
// nur der leere Zustand nutzt eine angemeldete Sitzung mit nachgebildeter API.

const VIEWS = [
  { query: 'tab=heute', component: 'app-uebersicht-tab', ready: 'Heute fällig' },
  { query: 'tab=aufgaben&ansicht=wiederkehrend', component: 'app-routinen-tab', ready: 'Tägliche Routinen' },
  { query: 'tab=einkaufen', component: 'app-einkauf-tab', ready: 'Wocheneinkauf' },
  { query: 'tab=zuhause&bereich=geraete', component: 'app-ordner-tab', ready: 'Meine Geräte' },
  { query: 'tab=zuhause&bereich=vertraege', component: 'app-ordner-tab', ready: 'Meine Verträge' },
];

for (const width of [360, 390, 430, 820, 1280, 1440]) {
  for (const view of VIEWS) {
    test(`${view.query} is accessible and fits at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('http://localhost:8000/api/**', (route) => route.abort());
      await page.goto(`/demo/haushalt?${view.query}`);
      await expect(page.locator(view.component).getByText(view.ready).first()).toBeAttached();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const result = await new AxeBuilder({ page }).include(view.component).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(result.violations).toEqual([]);
    });
  }
}

test('exactly four tabs; old links land on the new ones', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/haushalt');
  await expect(page.getByRole('tablist', { name: 'Bereiche im Haushalt' }).getByRole('tab')).toHaveText([
    'Heute', 'Aufgaben', 'Einkaufen', 'Zuhause',
  ]);
  for (const [old, tab, check] of [
    ['uebersicht', 'heute', 'Heute fällig'],
    ['routinen', 'aufgaben', 'Tägliche Routinen'],
    ['einkauf', 'einkaufen', 'Wocheneinkauf'],
    ['ordner', 'zuhause', 'Meine Verträge'],
  ]) {
    await page.goto(`/demo/haushalt?tab=${old}`);
    await expect(page.locator(`#hh-tab-${tab}`)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(check).first()).toBeVisible();
    // „Heute“ ist der Standard und braucht keinen Parameter
    if (tab !== 'heute') await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
    else await expect(page).not.toHaveURL(/tab=/);
  }
});

test('Heute: due tasks, upcoming deadlines (30 days) and the shopping summary', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/haushalt');
  await expect(page.locator('.page-head__action')).toHaveCount(0);
  await expect(page.locator('app-uebersicht-tab .task')).toHaveCount(3);
  await expect(page.locator('.soon__text b').first()).toHaveText('Geschirrspüler');
  await page.locator('.soon', { hasText: 'Strom' }).click();
  await expect(page.locator('#hh-tab-zuhause')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.section-switch').getByRole('button', { name: 'Verträge' })).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#hh-tab-heute').click();
  await page.getByRole('button', { name: 'Einkauf öffnen' }).click();
  await expect(page.locator('#hh-tab-einkaufen')).toHaveAttribute('aria-selected', 'true');
});

test('recurring tasks: pausing via the switch and filtering paused ones', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/haushalt?tab=aufgaben');
  await page.getByRole('button', { name: 'Wiederkehrend' }).click();
  await expect(page).toHaveURL(/ansicht=wiederkehrend/);
  const toggle = page.getByRole('switch', { name: 'Küche sauber halten aktiv' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: /^Pausiert \(3\)/ }).click();
  await expect(page.locator('app-routinen-tab .title-text')).toHaveCount(3);
  await page.getByRole('button', { name: 'Aktionen für Küche sauber halten' }).click();
  await expect(page.getByRole('menuitem', { name: /erledigt/i })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
});

test('shopping lists: switch, add an item, create a list, archive and restore', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/haushalt?tab=einkaufen');
  await page.locator('.list-card__main', { hasText: 'Drogerie' }).click();
  await expect(page.locator('#shopping-heading')).toHaveText('Drogerie');
  const add = page.locator('app-einkauf-tab form.add');
  await expect(add.getByRole('button', { name: 'Hinzufügen' })).toBeDisabled();
  await add.getByRole('combobox', { name: 'Bereich im Laden' }).click();
  await page.getByRole('option', { name: 'Haushalt' }).click();
  await page.getByPlaceholder('Artikel hinzufügen, z. B. Milch').fill('Zahnseide');
  await page.keyboard.press('Enter');
  await expect(page.locator('app-einkauf-tab .item__name', { hasText: 'Zahnseide' })).toBeVisible();
  await expect(page.getByPlaceholder('Artikel hinzufügen, z. B. Milch')).toHaveValue('');
  await expect(page.locator('.list-card.is-active')).toContainText('3 von 10');

  await page.locator('.page-head__action').click();
  await page.locator('#list-name').fill('Baby');
  await page.getByRole('radio', { name: 'Party' }).click();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('#shopping-heading')).toHaveText('Baby');
  await expect(page.locator('.list-card b')).toHaveCount(6);

  await page.getByRole('button', { name: 'Aktionen für Liste Baumarkt' }).click();
  await page.getByRole('menuitem', { name: 'Liste archivieren' }).click();
  await expect(page.locator('.list-card b')).toHaveCount(5);
  await page.getByRole('button', { name: 'Archiv (1)' }).click();
  await page.getByRole('button', { name: 'Liste Baumarkt wiederherstellen' }).click();
  await expect(page.locator('.list-card b')).toHaveCount(6);
});

test('contracts: detail with notice days and contract number, mobile as a sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/haushalt?tab=zuhause&bereich=vertraege');
  await expect(page.locator('app-ordner-tab .rows')).not.toContainText('4711-0815');
  await page.locator('.row__main', { hasText: 'Strom' }).click();
  await expect(page.locator('#zuhause-detail-heading')).toHaveText('Strom');
  await expect(page.locator('#zuhause-panel')).toContainText('30 Tage');
  await expect(page.locator('#zuhause-panel')).toContainText('4711-0815');
  await page.getByRole('button', { name: 'Details schließen' }).click();
  await expect(page.locator('.detail')).toBeHidden();
});

test('contracts: the end may not lie before the start', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/haushalt?tab=zuhause&bereich=vertraege');
  await page.locator('.page-head__action').click();
  await page.locator('#folder-name').fill('Fitnessstudio');
  await page.locator('#folder-cost').fill('0');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Bitte die Kosten als Betrag größer als 0 eingeben')).toBeVisible();
  await page.locator('#folder-cost').fill('29,90');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('.row__name b', { hasText: 'Fitnessstudio' })).toBeVisible();
});

test('devices: retire a device and delete it after confirming', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/haushalt?tab=zuhause');
  await expect(page.locator('.page-head__action')).toHaveText('Gerät hinzufügen');
  await page.locator('.row__main', { hasText: 'Backofen' }).click();
  await page.getByRole('button', { name: 'Außer Betrieb setzen' }).click();
  await expect(page.locator('.detail .pill')).toHaveText('Außer Betrieb');
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await page.getByRole('button', { name: 'Löschen' }).click();
  // Erst nach der Bestätigung wird gelöscht
  await expect(page.locator('.row__name b', { hasText: 'Backofen' })).toBeVisible();
  await expect(page.getByText('Wirklich löschen?')).toBeVisible();
  await page.getByRole('button', { name: 'Ja, löschen' }).click();
  await expect(page.locator('.row__name b', { hasText: 'Backofen' })).toHaveCount(0);
});

async function signedInEmptyHousehold(page: Page) {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira', email: 'mira@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true, domains: [] } }));
  await page.route('**/api/v1/notifications/**', (r) => r.fulfill({ json: [] }));
  const summary = Object.fromEntries(
    ['open_tasks', 'due_today', 'overdue_tasks', 'recurring_tasks', 'done_this_week', 'open_shopping_items', 'active_lists',
      'devices', 'devices_in_repair', 'contracts', 'contracts_expiring', 'upcoming'].map((k) => [k, 0]),
  );
  await page.route('**/api/v1/haushalt/**', (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith('/haushalt/uebersicht/'))
      return r.fulfill({
        json: {
          summary, open_tasks: 0, overdue_tasks: 0, today: [], upcoming: [], deadlines: [],
          shopping: { open_items: 0, preview: [], list_id: 1 }, open_shopping_items: 0, devices: 0, device_list: [],
          contracts: 0, contracts_monthly: '0.00', contract_list: [],
        },
      });
    return r.fulfill({ json: [] });
  });
}

test('an empty household shows “Dein Zuhause im Blick” with ways to start', async ({ page }) => {
  await signedInEmptyHousehold(page);
  await page.goto('/haushalt');
  await expect(page.getByRole('heading', { name: 'Dein Zuhause im Blick' })).toBeVisible();
  await expect(page.locator('.welcome__actions button')).toHaveText([
    'Aufgabe hinzufügen', 'Einkauf planen', 'Gerät hinzufügen', 'Vertrag hinzufügen',
  ]);
  expect((await new AxeBuilder({ page }).include('app-uebersicht-tab').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Vertrag hinzufügen' }).click();
  await expect(page.locator('#hh-tab-zuhause')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Neuer Vertrag' })).toBeVisible();
});
