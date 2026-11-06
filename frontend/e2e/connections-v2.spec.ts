import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Connection Engine V2 (01.11.2026) in der Demo — Pflicht-Szenario „Vertrag“ aus dem Entwicklungsplan (Abschnitt 2.5)
// durch die Oberfläche: verbinden mit Vorschau → genau ein Planposten in Finanzen und genau eine Erinnerung im Kalender
// → Preis ändern → pausieren → aufheben. Rechte, Wiederholungen und Gleichzeitigkeit prüft das Backend:
// backend/connections/tests/test_auto_links.py (QA-01 … QA-14).

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
});

/** In der Demo navigieren, ohne neu zu laden (Neuladen setzt die Beispieldaten zurück). */
async function go(page: import('@playwright/test').Page, url: string) {
  await page.evaluate((u) => {
    history.pushState({}, '', u);
    dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, url);
}

async function editContract(page: import('@playwright/test').Page, name: string) {
  await go(page, '/demo/haushalt?tab=zuhause&bereich=vertraege');
  if (!(await page.locator('.detail.is-open', { hasText: name }).count())) await page.getByText(name, { exact: true }).first().click();
  await page.locator('.detail').getByRole('button', { name: /^Bearbeiten/ }).first().click();
  return page.getByRole('dialog');
}

async function plannedRow(page: import('@playwright/test').Page, title: string) {
  await go(page, '/demo/finanzen?tab=transactions');
  await page.getByRole('button', { name: 'Geplant', exact: true }).click(); // wartet, bis die Seite steht
  await expect(page.getByRole('button', { name: 'Geplant', exact: true })).toHaveAttribute('aria-pressed', 'true');
  return page.locator('main').getByRole('button', { name: new RegExp(title) }).filter({ hasText: 'aus Haushalt › Vertrag' });
}

test('contract → planned cost in Finanzen: preview, exactly one item, price change, pause', async ({ page }) => {
  await page.goto('/demo/haushalt');
  let dialog = await editContract(page, 'Handyvertrag Sophie');
  const links = dialog.locator('app-auto-links');
  // Vorschau VOR dem Speichern: was genau wo erscheint
  await expect(links).toContainText('Finanzen › Geplant: 17,99 € monatlich');
  await links.getByRole('switch', { name: /In Finanzen als geplante Kosten zeigen/ }).check();
  await expect(links).toContainText('Wird beim Speichern eingeschaltet.');
  expect((await new AxeBuilder({ page }).include('app-auto-links').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toHaveCount(0);

  // Finanzen: genau ein geplanter Posten (keine Buchung)
  let row = await plannedRow(page, 'Handyvertrag Sophie');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('17,99');

  // Preis ändern → der Planwert folgt
  dialog = await editContract(page, 'Handyvertrag Sophie');
  await dialog.locator('#folder-cost').fill('14,99');
  await expect(dialog.locator('app-auto-links')).toContainText('14,99 € monatlich');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  row = await plannedRow(page, 'Handyvertrag Sophie');
  await expect(row).toContainText('14,99');

  // Pausieren → nichts mehr geplant, die Einstellung bleibt sichtbar
  dialog = await editContract(page, 'Handyvertrag Sophie');
  await dialog.locator('app-auto-links .al__row', { hasText: 'In Finanzen' }).getByRole('button', { name: 'Pausieren' }).click();
  await expect(dialog.locator('app-auto-links')).toContainText('Wird beim Speichern pausiert.');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  row = await plannedRow(page, 'Handyvertrag Sophie');
  await expect(row).toHaveCount(0);
  dialog = await editContract(page, 'Handyvertrag Sophie');
  await expect(dialog.locator('app-auto-links .al__row', { hasText: 'In Finanzen' })).toContainText('Pausiert');
});

async function monthHas(page: import('@playwright/test').Page, text: string, months = 3): Promise<boolean> {
  await page.getByRole('button', { name: 'Monat', exact: true }).click();
  for (let i = 0; i < months; i++) {
    if (await page.locator('.month .ev', { hasText: text }).count()) return true;
    await page.getByRole('button', { name: 'Nächster Monat' }).click();
    await page.waitForTimeout(300);
  }
  return false;
}

test('contract → cancellation reminder in the calendar; unlink removes only the reminder', async ({ page }) => {
  await page.goto('/demo/haushalt');
  let dialog = await editContract(page, 'Strom');
  const links = dialog.locator('app-auto-links');
  await expect(links).toContainText('„Kündigen bis: Strom“ am');
  await links.getByRole('switch', { name: /Kündigungserinnerung im Kalender/ }).check();
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await go(page, '/demo/organisation?tab=calendar');
  expect(await monthHas(page, 'Kündigen bis: Strom')).toBe(true);

  dialog = await editContract(page, 'Strom');
  await dialog.locator('app-auto-links').getByRole('switch', { name: /Kündigungserinnerung/ }).uncheck();
  await expect(dialog.locator('app-auto-links')).toContainText('Der Vertrag und echte Buchungen, Termine und Aufgaben bleiben');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await go(page, '/demo/organisation?tab=calendar');
  expect(await monthHas(page, 'Kündigen bis: Strom')).toBe(false);
  await go(page, '/demo/haushalt?tab=zuhause&bereich=vertraege');
  await expect(page.getByText('Strom', { exact: true }).first()).toBeVisible(); // der Vertrag bleibt
});

test('cancel discards switch changes; nothing is applied before saving', async ({ page }) => {
  await page.goto('/demo/haushalt');
  let dialog = await editContract(page, 'Strom');
  await dialog.locator('app-auto-links').getByRole('switch', { name: /In Finanzen/ }).check();
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  dialog = await editContract(page, 'Strom');
  await expect(dialog.locator('app-auto-links').getByRole('switch', { name: /In Finanzen/ })).not.toBeChecked();
});

for (const width of [390, 1440]) {
  test(`household tasks in Organisation: switch on, tick one off — same task as in Haushalt (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/demo/organisation?tab=tasks');
    const box = page.locator('app-org-household-tasks');
    await expect(box).toContainText('Haushaltsaufgaben hier zeigen?');
    await box.getByRole('switch').check();
    await expect(box).toContainText('Winterreifen-Termin vereinbaren');
    expect((await new AxeBuilder({ page }).include('app-org-household-tasks').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    // einmalige Aufgabe: nach dem Abhaken ist sie weg (wiederkehrende rücken weiter und bleiben offen)
    await box.getByRole('button', { name: 'Winterreifen-Termin vereinbaren erledigen' }).click();
    await expect(box.getByRole('button', { name: 'Winterreifen-Termin vereinbaren erledigen' })).toHaveCount(0);
    // derselbe Datensatz: auch im Haushalt nicht mehr offen
    await go(page, '/demo/haushalt?tab=aufgaben');
    await expect(page.getByRole('button', { name: 'Winterreifen-Termin vereinbaren als erledigt markieren' })).toHaveCount(0);
  });
}

test('derived calendar entries are read-only and open their source', async ({ page }) => {
  await page.goto('/demo/organisation?tab=calendar');
  await page.getByRole('button', { name: 'Woche', exact: true }).click();
  await expect(page.locator('#agenda-h')).toContainText(/Woche|Termine \d/);
  const row = page.locator('.agenda__row', { hasText: 'Wartung: Heizung' });
  for (let i = 0; i < 5 && !(await row.count()); i++) {
    await page.getByRole('button', { name: 'Nächste Woche' }).click();
    await page.waitForTimeout(300);
  }
  await expect(row.first()).toContainText('Aus Haushalt › Gerät');
  await row.first().click();
  await expect(page).toHaveURL(/\/demo\/haushalt\?.*entry=demo-folder-2/);
});
