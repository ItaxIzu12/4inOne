import { test, expect, Page } from '@playwright/test';
import { choose, pickDate } from './helpers';
import AxeBuilder from '@axe-core/playwright';

function iso(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
async function axe(page: Page) {
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
}
async function submit(page: Page) {
  await page.locator('app-modal-form form').evaluate((f: HTMLFormElement) => f.requestSubmit());
}
async function tab(page: Page, label: string) {
  await page.locator('nav.tabs button', { hasText: label }).click();
}
/** Hauptaktion: am Rechner oben im Kopf, am Handy der feste Knopf unten. */
async function headAction(page: Page) {
  await page.locator('.page-heading .primary:visible, app-mobile-action button:visible').first().click();
}
async function newTrip(page: Page, title: string, from: number, to: number) {
  // „Neue Reise“ gibt es im Reiter Reisen (die Übersicht hat keinen Hauptknopf)
  await tab(page, 'Reisen');
  await headAction(page);
  await page.locator('#trip-title').fill(title);
  await pickDate(page, page.getByLabel('Beginn', { exact: true }), iso(from));
  await pickDate(page, page.getByLabel('Ende', { exact: true }), iso(to));
}

// Demo-Route (öffentlich, DemoReisenApi): vollständiger CRUD-Durchlauf einmal mobil, einmal am Desktop.
for (const width of [390, 1440]) {
  test(`reisen CRUD lifecycle ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/demo/reisen');
    await page.waitForLoadState('networkidle');

    // CREATE mit Unterkunft und Transport-Notiz
    await newTrip(page, 'Städtetrip Wien', 60, 63);
    await page.locator('#trip-accommodation').fill('Hotel Sacher');
    await page.locator('#trip-accommodation-area').fill('Innere Stadt');
    await submit(page);
    await expect(page.getByRole('heading', { name: 'Deine Reise ist vorbereitet.' })).toBeVisible();
    await page.getByRole('button', { name: 'Überspringen', exact: true }).click();
    await expect(page.locator('.trip', { hasText: 'Städtetrip Wien' })).toBeVisible();

    // READ: im Reiter „Reisen“ mit Details
    await tab(page, 'Reisen');
    const row = page.locator('.trip', { hasText: 'Städtetrip Wien' });
    await expect(row).toBeVisible();
    await row.click();
    const detail = page.locator('.detail');
    await expect(detail).toContainText('Hotel Sacher');
    await expect(detail).toContainText('3 Nächte · Innere Stadt');

    // UPDATE über das Menü der Details
    await detail.getByRole('button', { name: 'Weitere Aktionen zur Reise' }).click();
    await detail.getByRole('button', { name: 'Reise bearbeiten' }).click();
    await expect(page.locator('#trip-title')).toHaveValue('Städtetrip Wien');
    await page.locator('#trip-title').fill('Städtetrip Wien (verlängert)');
    await choose(page, 'Status', 'Bestätigt');
    await submit(page);
    await expect(page.locator('.trip', { hasText: 'Städtetrip Wien (verlängert)' })).toContainText('Bestätigt');

    // DELETE mit Rückfrage
    await page.locator('.trip', { hasText: 'Städtetrip Wien (verlängert)' }).click();
    await detail.getByRole('button', { name: 'Weitere Aktionen zur Reise' }).click();
    await detail.getByRole('button', { name: 'Reise bearbeiten' }).click();
    await page.getByRole('button', { name: 'Reise löschen' }).click();
    await expect(page.getByText('Wirklich löschen?')).toBeVisible();
    await page.getByRole('button', { name: 'Ja, löschen' }).click();
    await expect(page.locator('.modal-panel')).toBeHidden();
    await expect(page.getByText('Städtetrip Wien (verlängert)')).toHaveCount(0);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await axe(page);
  });
}

test('Reisen tab: filter, sort and trip details; on a phone the details open as a sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo/reisen?tab=reisen');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('#tl-count')).toHaveText('3 Reisen');
  await expect(page.locator('.detail')).toBeHidden();
  await page.locator('.trip', { hasText: 'Berlin Wochenende' }).click();
  const sheet = page.locator('.detail.is-open');
  await expect(sheet).toBeVisible();
  await expect(page.locator('app-mobile-action button')).toBeHidden();
  await expect(sheet).toContainText('Hin- und Rückfahrt gebucht');
  await expect(sheet).toContainText('8 offene Aufgaben');
  await axe(page);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(page.locator('app-mobile-action button')).toHaveText('Neue Reise');

  await page.getByLabel('Nach Status filtern', { exact: true }).click();
  await page.getByRole('option', { name: 'Idee', exact: true }).click();
  await expect(page.locator('#tl-count')).toHaveText('1 Reise');
  await expect(page.locator('.trip')).toHaveText(/Skifahren Schweiz/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('packing list at mobile width: categories, check with date, add/edit/delete, big touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo/reisen?tab=packlisten');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Wichtige Dokumente', level: 3 })).toBeVisible();
  await expect(page.locator('#pk-progress')).toHaveText('12 von 24 erledigt');
  const check = page.locator('.item', { hasText: 'Ladegerät' }).locator('.check');
  const box = await check.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);

  await check.click();
  await expect(page.locator('#pk-progress')).toHaveText('13 von 24 erledigt');
  await expect(page.locator('.item', { hasText: 'Ladegerät' })).toContainText('Erledigt am');

  // Hinzufügen über „Element hinzufügen“ (unten, auf dem Handy)
  await expect(page.locator('.page-heading .primary')).toBeHidden();
  await page.locator('app-mobile-action button', { hasText: 'Element hinzufügen' }).click();
  // ein offener Dialog verdeckt sich nicht selbst mit dem festen Knopf
  await expect(page.locator('app-mobile-action button')).toBeHidden();
  await page.locator('#packing-item-title').fill('Faltschirm');
  await choose(page, 'Kategorie', 'Unterwegs');
  await submit(page);
  await expect(page.locator('.group', { hasText: 'Unterwegs' })).toContainText('Faltschirm');

  // Bearbeiten und Löschen
  await page.getByRole('button', { name: 'Faltschirm bearbeiten' }).click();
  await page.locator('#packing-item-title').fill('Taschenschirm');
  await submit(page);
  await expect(page.getByText('Taschenschirm')).toBeVisible();
  await page.getByRole('button', { name: 'Taschenschirm bearbeiten' }).click();
  await page.getByRole('button', { name: 'Artikel löschen' }).click();
  await page.getByRole('button', { name: 'Ja, löschen' }).click();
  await expect(page.getByText('Taschenschirm')).toHaveCount(0);

  // Ansicht „Offen“ zeigt nur Offenes
  await page.locator('.views button', { hasText: 'Offen' }).click();
  await expect(page.locator('.item input:checked')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await axe(page);
});

test('reminders at mobile width: trip, household and calendar in one list; add with time, mark done, edit, delete', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo/reisen?tab=erinnerungen');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('.item', { hasText: 'Online Check-in öffnen' })).toContainText('18:00');
  await expect(page.locator('.item', { hasText: 'Pflanzen gießen' })).toContainText('Haushalt');
  await expect(page.locator('.item', { hasText: 'Abreise' })).toContainText('Organisation');
  await expect(page.locator('.hint--warn')).toContainText('„Pflanzen gießen“ fällt in deine Reisezeit');

  await headAction(page);
  await page.locator('#task-item-title').fill('Visum beantragen');
  await pickDate(page, page.getByLabel(/^Datum/), iso(5));
  await page.locator('#task-item-note').fill('Braucht ca. 2 Wochen');
  await submit(page);
  const visa = page.locator('.item', { hasText: 'Visum beantragen' });
  await expect(visa).toBeVisible();

  await visa.getByRole('button', { name: 'Aktionen zu Visum beantragen' }).click();
  await page.getByRole('button', { name: 'Als erledigt markieren' }).click();
  await expect(visa).toHaveClass(/is-done/);
  await visa.getByRole('button', { name: 'Aktionen zu Visum beantragen' }).click();
  await page.getByRole('button', { name: 'Wieder öffnen' }).click();
  await expect(visa).not.toHaveClass(/is-done/);

  await visa.getByRole('button', { name: 'Aktionen zu Visum beantragen' }).click();
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await expect(page.locator('#task-item-note')).toHaveValue('Braucht ca. 2 Wochen');
  await page.locator('#task-item-title').fill('Visum verlängern');
  await submit(page);
  await expect(page.locator('.item', { hasText: 'Visum verlängern' })).toBeVisible();

  await page.locator('.item', { hasText: 'Visum verlängern' }).getByRole('button', { name: /Aktionen zu/ }).click();
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await page.getByRole('button', { name: 'Erinnerung löschen' }).click();
  await page.getByRole('button', { name: 'Ja, löschen' }).click();
  await expect(page.getByText('Visum verlängern')).toHaveCount(0);

  // Filter Bereich
  await page.getByRole('button', { name: 'Weitere Filter anzeigen' }).click();
  await page.getByLabel('Nach Bereich filtern', { exact: true }).click();
  await page.getByRole('option', { name: 'Haushalt', exact: true }).click();
  await expect(page.locator('.item')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await axe(page);
});

test('trip budget at mobile width: totals, plan per category, expenses with category', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo/reisen?tab=budget');
  await page.waitForLoadState('networkidle');

  const kpis = page.locator('.kpi');
  await expect(kpis.nth(0)).toContainText('700 €');
  await expect(kpis.nth(1)).toContainText('420 €');
  await expect(kpis.nth(2)).toContainText('280 €');
  await expect(kpis.nth(3)).toContainText('150 €');
  await expect(page.locator('.cats__row', { hasText: 'Unterkunft' })).toContainText('80 %');

  // Planung: Shopping einplanen
  await page.getByRole('button', { name: 'Planung bearbeiten' }).click();
  await page.getByLabel('Shopping', { exact: true }).fill('120');
  await expect(page.locator('.budget-plan__sum')).toContainText('820 €');
  await submit(page);
  await expect(page.locator('.cats__row', { hasText: 'Shopping' })).toContainText('0 € von 120 €');

  // Ausgabe erfassen
  await page.locator('app-mobile-action button', { hasText: 'Ausgabe erfassen' }).click();
  await page.locator('#expense-title').fill('Souvenir');
  await page.locator('#expense-amount').fill('30');
  await choose(page, 'Kategorie', 'Shopping');
  await submit(page);
  await expect(kpis.nth(1)).toContainText('450 €');
  await expect(page.locator('.cats__row', { hasText: 'Shopping' })).toContainText('30 € von 120 €');
  await expect(page.locator('.exp')).toContainText('Souvenir');

  // Bearbeiten und löschen
  await page.locator('.exp__row', { hasText: 'Souvenir' }).click();
  await expect(page.locator('#expense-amount')).toHaveValue('30,00');
  await page.getByRole('button', { name: 'Ausgabe löschen' }).click();
  await page.getByRole('button', { name: 'Ja, löschen' }).click();
  await expect(page.locator('.exp')).not.toContainText('Souvenir');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await axe(page);
});

test('a trip budget can use a different currency than euro, and says honestly it stays apart from Finanzen', async ({ page }) => {
  await page.goto('/demo/reisen');
  await page.waitForLoadState('networkidle');
  await newTrip(page, 'USA-Reise', 100, 110);
  await page.locator('#trip-budget').fill('2000');
  await choose(page, 'Währung', 'US-Dollar ($)');
  await submit(page);
  await page.getByRole('button', { name: 'Überspringen', exact: true }).click();

  await tab(page, 'Budget');
  await expect(page.locator('.kpi').first()).toContainText('$ 2.000');
  await expect(page.locator('app-trip-budget aside.finance')).toContainText('Dein Monatsbudget in Finanzen ändert sich dadurch nicht');
});

test('creating a trip without dates fails with a clear message, nothing is saved', async ({ page }) => {
  await page.goto('/demo/reisen');
  await page.waitForLoadState('networkidle');
  await tab(page, 'Reisen');
  await headAction(page);
  await page.locator('#trip-title').fill('Reise ohne Zeitraum');
  await submit(page);
  await expect(page.locator('app-error-notice [role="alert"]')).toHaveText('Bitte gib Beginn und Ende der Reise an.');
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByText('Reise ohne Zeitraum')).toHaveCount(0);
});

test('smart setup: a flight with hand luggage suggests check-in tasks, and lets you deselect one before accepting', async ({ page }) => {
  await page.goto('/demo/reisen');
  await page.waitForLoadState('networkidle');
  await newTrip(page, 'Flug nach Rom', 45, 48);
  await page.getByLabel(/^Transportart/).click();
  await page.getByRole('option', { name: 'Flugzeug' }).click();
  await page.getByLabel(/^Gepäck/).click();
  await page.getByRole('option', { name: 'Nur Handgepäck' }).click();
  await submit(page);

  await expect(page.getByRole('heading', { name: 'Deine Reise ist vorbereitet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Vorschläge prüfen' }).click();
  await expect(page.getByText('Online-Check-in durchführen')).toBeVisible();
  await expect(page.getByText('Gepäckbestimmungen prüfen')).toBeVisible();
  await page.getByText('Gepäckbestimmungen prüfen').click(); // abwählen
  await page.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(page.getByRole('heading', { name: 'Deine Reise ist vorbereitet.' })).toBeHidden();

  await tab(page, 'Erinnerungen');
  await expect(page.locator('.item', { hasText: 'Online-Check-in durchführen' })).toBeVisible();
  await expect(page.getByText('Gepäckbestimmungen prüfen')).toHaveCount(0);

  // „Vorschläge hinzufügen“ in der Packliste bietet nur noch, was fehlt
  await tab(page, 'Packlisten');
  await page.getByRole('button', { name: 'Vorschläge hinzufügen' }).click();
  await expect(page.getByRole('heading', { name: /Vorschläge für Flug nach Rom/ })).toBeVisible();
  await expect(page.locator('.suggestion-list')).not.toContainText('Online-Check-in durchführen');
  await axe(page);
});

test('participants: a solo trip starts owned by its creator alone, and the owner can add/remove a contact', async ({ page }) => {
  await page.goto('/demo/reisen');
  await page.waitForLoadState('networkidle');
  await newTrip(page, 'Allein unterwegs', 20, 22);
  await submit(page);
  await page.getByRole('button', { name: 'Überspringen', exact: true }).click();
  await tab(page, 'Reisen');
  await page.locator('.trip', { hasText: 'Allein unterwegs' }).click();
  await page.locator('.detail').getByRole('button', { name: /Teilnehmer/ }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: /Teilnehmer – Allein unterwegs/ })).toBeVisible();
  await expect(dialog.locator('.row', { hasText: 'Anna' })).toContainText('(Du)');
  await expect(dialog.locator('.row', { hasText: 'Anna' })).toContainText('Besitzer');
  await expect(dialog.locator('.row')).toHaveCount(1);

  // Hinzufügen aus den eigenen Kontakten, nicht per freier E-Mail-Eingabe.
  await dialog.getByLabel('Person').click();
  await page.getByRole('option', { name: 'Lena' }).click();
  await dialog.getByLabel('Rolle').click();
  await page.getByRole('option', { name: 'Bearbeiter' }).click();
  await dialog.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(dialog.locator('.row', { hasText: 'Lena' })).toContainText('Bearbeiter');
  await expect(dialog.locator('.row')).toHaveCount(2);

  await dialog.locator('.row', { hasText: 'Lena' }).getByRole('button', { name: /entfernen/ }).click();
  await expect(dialog.locator('.row', { hasText: 'Lena' })).toHaveCount(0);
  await expect(dialog.locator('.row')).toHaveCount(1);
  await axe(page);
});

test('overview: next trip, suggestion, key figures, to-dos and reminders without duplicates', async ({ page }) => {
  await page.goto('/demo/reisen');
  await page.waitForLoadState('networkidle');

  const next = page.locator('app-trip-overview .next');
  await expect(next.locator('h2')).toHaveText('Berlin Wochenende');
  await expect(next).toContainText('Bestätigt');
  await expect(next).toContainText('in 12 Tagen');
  // 12 von 24 gepackt (50%), 1 von 9 Aufgaben (11%), Budget (100%), Zeitraum (100%) → 65%
  await expect(next.locator('.prep .num')).toHaveText('65 %');
  await expect(next).toContainText('12 / 24');
  await expect(next).toContainText('8 offen');
  await expect(page.locator('.kpi__value')).toHaveText(['2', '8', '60 %']);

  // Reisevorschlag führt zur Packliste; „Später erinnern“ zeigt den nächsten Schritt
  const tip = page.locator('.tip');
  await expect(tip).toContainText('Packliste noch unvollständig');
  await tip.getByRole('button', { name: 'Später erinnern' }).click();
  await expect(tip).toContainText('8 Aufgaben sind noch offen');

  // To-do abhaken: verschwindet, Zähler sinkt
  const todos = page.locator('.lists .card').first();
  await expect(todos.locator('.row').first()).toContainText('Heute');
  await todos.getByLabel('Reiseversicherung prüfen').click();
  await expect(todos).not.toContainText('Reiseversicherung prüfen');
  await expect(page.locator('.kpi__value').nth(1)).toHaveText('7');

  const reminders = page.locator('.lists .card').nth(1);
  await expect(reminders).toContainText('Online Check-in öffnen');
  await expect(reminders).toContainText('Pflanzen gießen');
  await expect(reminders).not.toContainText('Hotel-Check-in bestätigen');

  await page.locator('.kpi', { hasText: 'Budgetstatus' }).click();
  await expect(page.locator('nav.tabs [aria-current]')).toContainText('Budget');
  await axe(page);
});

test('readiness reaches 100% once a brand-new trip is fully packed and its reminder done', async ({ page }) => {
  await page.goto('/demo/reisen');
  await page.waitForLoadState('networkidle');
  await newTrip(page, 'Rom Kurztrip', 40, 43);
  await submit(page);
  await page.getByRole('button', { name: 'Überspringen', exact: true }).click();

  await tab(page, 'Übersicht');
  const prep = page.locator('app-trip-overview .prep .num');
  await expect(prep).toHaveText('33 %');

  await tab(page, 'Packlisten');
  await headAction(page);
  await page.locator('#packing-item-title').fill('Sonnenbrille');
  await submit(page);
  await page.locator('.item', { hasText: 'Sonnenbrille' }).locator('.check').click();

  await tab(page, 'Erinnerungen');
  await headAction(page);
  await page.locator('#task-item-title').fill('Koffer packen');
  await submit(page);
  await page.locator('.item', { hasText: 'Koffer packen' }).getByRole('button', { name: /Aktionen zu/ }).click();
  await page.getByRole('button', { name: 'Als erledigt markieren' }).click();

  await tab(page, 'Übersicht');
  await expect(prep).toHaveText('100 %');
  // ohne Budget schlägt die Übersicht als Nächstes die Budgetplanung vor (Budget ist optional, zählt nicht mit)
  await expect(page.locator('.tip')).toContainText('Budget planen');
});

test('all five tabs fit at desktop and phone width without horizontal scroll', async ({ page }) => {
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const t of ['', 'reisen', 'packlisten', 'budget', 'erinnerungen']) {
      await page.goto(`/demo/reisen${t ? '?tab=' + t : ''}`);
      await page.waitForLoadState('networkidle');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${t} @ ${width}`).toBe(true);
    }
  }
});

// Echtes (angemeldetes) Konto ohne jede Reise: kein Fake-Trip, klarer Empty State.
test('a real account with zero trips gets the empty state, never a demo trip', async ({ page }) => {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 'test' } }));
  await page.route('**/api/v1/auth/refresh/', (r) =>
    r.fulfill({ json: { access: 'test', user: { name: 'Mira', email: 'mira@example.com' } } }),
  );
  await page.route('**/api/v1/onboarding/profile/', (r) =>
    r.fulfill({ json: { needs_onboarding: false, completed: true } }),
  );
  await page.route('**/api/v1/reisen/trips/**', (r) => r.fulfill({ json: [] }));
  await page.goto('/reisen');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Noch keine Reise geplant.' })).toBeVisible();
  await expect(page.getByText('Wohin soll es als Nächstes gehen?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Erste Reise planen' })).toBeVisible();
  await expect(page.getByText('Berlin Wochenende')).toHaveCount(0);
});
