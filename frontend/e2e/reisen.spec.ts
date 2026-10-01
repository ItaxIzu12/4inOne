import { test, expect } from '@playwright/test';
import { pickDate } from './helpers';
import AxeBuilder from '@axe-core/playwright';

function iso(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Demo-Route (öffentlich, DemoReisenApi): vollständiger CRUD-Durchlauf einmal mobil, einmal am Desktop.
for (const width of [390, 1440]) {
  test(`reisen CRUD lifecycle ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/demo/reisen');
    await page.waitForLoadState('networkidle');

    // CREATE
    await page.getByRole('button', { name: 'Neue Reise' }).click();
    await page.locator('#trip-title').fill('Städtetrip Wien');
    await pickDate(page, page.getByLabel('Beginn', { exact: true }), iso(60));
    await pickDate(page, page.getByLabel('Ende', { exact: true }), iso(63));
    await page.locator('app-modal-form form').evaluate((f: HTMLFormElement) => f.requestSubmit());

    // Smart Setup erscheint nach jedem Erstellen (siehe trip-suggestions.ts) — hier übersprungen, eigener Test weiter unten.
    await expect(page.getByRole('heading', { name: 'Deine Reise ist vorbereitet.' })).toBeVisible();
    await page.getByRole('button', { name: 'Überspringen', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Deine Reise ist vorbereitet.' })).toBeHidden();

    // Kein Reiseziel angegeben → der Detail-Header fällt auf den Titel zurück (siehe reisen.html trip-detail).
    await expect(page.locator('.trip-detail h2')).toHaveText('Städtetrip Wien');

    // READ: Übersicht zeigt sie, "Reisen"-Reiter zeigt sie mit Bearbeiten-Zugang
    await page.getByRole('button', { name: 'Reisen', exact: true }).click();
    const row = page.locator('.trip-row-wrap', { hasText: 'Städtetrip Wien' });
    await expect(row).toBeVisible();

    // UPDATE: vorhandene Werte müssen korrekt geladen sein
    await row.locator('.edit-icon-btn').click();
    await expect(page.locator('#trip-title')).toHaveValue('Städtetrip Wien');
    await page.locator('#trip-title').fill('Städtetrip Wien (verlängert)');
    await page.locator('app-modal-form form').evaluate((f: HTMLFormElement) => f.requestSubmit());
    await expect(page.getByText('Städtetrip Wien (verlängert)')).toBeVisible();

    // DELETE: Bestätigungsdialog
    await page.locator('.trip-row-wrap', { hasText: 'Städtetrip Wien (verlängert)' }).locator('.edit-icon-btn').click();
    await page.getByRole('button', { name: 'Reise löschen' }).click();
    await expect(page.getByText('Wirklich löschen?')).toBeVisible();
    await page.getByRole('button', { name: 'Ja, löschen' }).click();
    await expect(page.locator('.modal-panel')).toBeHidden();
    await expect(page.getByText('Städtetrip Wien (verlängert)')).toHaveCount(0);

    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
  });
}

test('packing list at mobile width: grouped by category, big touch targets, full add/check/edit/delete', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo/reisen');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Packliste', exact: true }).click();

  // Kategorien sichtbar, Häkchen-Button groß genug zum Antippen (mind. 44x44 px).
  await expect(page.getByRole('heading', { name: 'Dokumente', level: 3 })).toBeVisible();
  const check = page.locator('.row', { hasText: 'Reisepass' }).locator('.completion');
  const box = await check.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);

  // Hinzufügen
  await page.getByRole('button', { name: 'Artikel hinzufügen' }).click();
  await page.locator('#packing-item-title').fill('Regenschirm');
  await page.getByLabel('Kategorie').click();
  await page.getByRole('option', { name: 'Sonstiges' }).click();
  await page.locator('app-modal-form form').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await expect(page.getByRole('heading', { name: 'Sonstiges', level: 3 })).toBeVisible();
  await expect(page.getByText('Regenschirm')).toBeVisible();

  // Abhaken
  await page.locator('.row', { hasText: 'Regenschirm' }).locator('.completion').click();
  await expect(page.locator('.row', { hasText: 'Regenschirm' }).locator('.row__title')).toHaveClass(/row__title--done/);

  // Bearbeiten
  await page.locator('.row', { hasText: 'Regenschirm' }).locator('.row__link').click();
  await page.locator('#packing-item-title').fill('Faltschirm');
  await page.locator('app-modal-form form').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await expect(page.getByText('Faltschirm')).toBeVisible();

  // Löschen
  await page.locator('.row', { hasText: 'Faltschirm' }).locator('.row__link').click();
  await page.getByRole('button', { name: 'Artikel löschen' }).click();
  await page.getByRole('button', { name: 'Ja, löschen' }).click();
  await expect(page.getByText('Faltschirm')).toHaveCount(0);

  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

test('trip tasks at mobile width: big touch targets, full add/complete/reopen/edit/delete', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo/reisen');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Aufgaben', exact: true }).click();

  const check = page.locator('.row', { hasText: 'Zugtickets buchen' }).locator('.completion');
  const box = await check.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);

  // Hinzufügen mit Fälligkeit und Notiz
  await page.getByRole('button', { name: 'Aufgabe hinzufügen' }).click();
  await page.locator('#task-item-title').fill('Visum beantragen');
  await pickDate(page, page.getByLabel('Fällig am'), iso(5));
  await page.locator('#task-item-note').fill('Braucht ca. 2 Wochen');
  await page.locator('app-modal-form form').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await expect(page.getByText('Visum beantragen')).toBeVisible();
  await expect(page.getByText('Braucht ca. 2 Wochen')).toBeVisible();

  // Erledigen und wieder öffnen — nichts bleibt fälschlich als erledigt stehen.
  const visaCheck = page.locator('.row', { hasText: 'Visum beantragen' }).locator('.completion');
  await visaCheck.click();
  await expect(page.locator('.row', { hasText: 'Visum beantragen' }).locator('.row__title')).toHaveClass(/row__title--done/);
  await visaCheck.click();
  await expect(page.locator('.row', { hasText: 'Visum beantragen' }).locator('.row__title')).not.toHaveClass(/row__title--done/);

  // Bearbeiten
  await page.locator('.row', { hasText: 'Visum beantragen' }).locator('.row__link').click();
  await page.locator('#task-item-title').fill('Visum verlängern');
  await page.locator('app-modal-form form').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await expect(page.getByText('Visum verlängern')).toBeVisible();

  // Löschen
  await page.locator('.row', { hasText: 'Visum verlängern' }).locator('.row__link').click();
  await page.getByRole('button', { name: 'Aufgabe löschen' }).click();
  await page.getByRole('button', { name: 'Ja, löschen' }).click();
  await expect(page.getByText('Visum verlängern')).toHaveCount(0);

  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

test('trip budget at mobile width: plan amounts per category, currency-aware, big touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo/reisen');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Budget', exact: true }).click();
  await page.locator('.budget-category-label').first().waitFor();

  const labels = await page.locator('.budget-category-label').allTextContents();
  expect(labels).toEqual(['Transport', 'Unterkunft', 'Essen', 'Aktivitäten', 'Shopping', 'Sonstiges', 'Reserve']);

  // Shopping ist noch nicht geplant -> jetzt eine Summe eintragen.
  const shoppingRow = page.locator('.budget-category-row', { hasText: 'Shopping' });
  const shoppingInput = shoppingRow.locator('input');
  const box = await shoppingInput.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(40);
  await shoppingInput.fill('120');
  await shoppingInput.blur();
  await expect(shoppingInput).toHaveValue('120.00');
  await expect(page.locator('.budget-category-sum')).toContainText('Geplant gesamt');

  // Wieder leeren entfernt die Planung.
  await shoppingInput.fill('');
  await shoppingInput.blur();
  await expect(shoppingInput).toHaveValue('');

  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

test('a trip budget can use a different currency than euro, without touching private finances', async ({ page }) => {
  await page.goto('/demo/reisen');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Neue Reise' }).click();
  await page.locator('#trip-title').fill('USA-Reise');
  await pickDate(page, page.getByLabel('Beginn', { exact: true }), iso(80));
  await pickDate(page, page.getByLabel('Ende', { exact: true }), iso(90));
  await page.locator('#trip-budget').fill('2000');
  await page.getByLabel('Währung').click();
  await page.getByRole('option', { name: 'US-Dollar ($)' }).click();
  await page.locator('app-modal-form form').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await page.getByRole('button', { name: 'Überspringen', exact: true }).click();

  await page.getByRole('button', { name: 'Budget', exact: true }).click();
  await expect(page.getByText('$ 2.000,00')).toBeVisible();
  await expect(page.getByText('nicht automatisch mit Finanzen verbunden')).toBeVisible();
});

test('creating a trip without dates fails with a clear message, nothing is saved', async ({ page }) => {
  await page.goto('/demo/reisen');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Neue Reise' }).click();
  await page.locator('#trip-title').fill('Ohne Datum');
  await page.locator('app-modal-form form').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await expect(page.locator('.modal-form__error')).toHaveText('Bitte gib Beginn und Ende der Reise an.');
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByText('Ohne Datum')).toHaveCount(0);
});

test('smart setup: a flight with hand luggage suggests check-in tasks and a compact-packing hint, and lets you deselect one before accepting', async ({ page }) => {
  await page.goto('/demo/reisen');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Neue Reise' }).click();
  await page.locator('#trip-title').fill('Flug nach Rom');
  await pickDate(page, page.getByLabel('Beginn', { exact: true }), iso(45));
  await pickDate(page, page.getByLabel('Ende', { exact: true }), iso(48));
  await page.getByLabel('Transportart').click();
  await page.getByRole('option', { name: 'Flugzeug' }).click();
  await page.getByLabel('Gepäck').click();
  await page.getByRole('option', { name: 'Nur Handgepäck' }).click();
  await page.locator('app-modal-form form').evaluate((f: HTMLFormElement) => f.requestSubmit());

  await expect(page.getByRole('heading', { name: 'Deine Reise ist vorbereitet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Vorschläge prüfen' }).click();
  await expect(page.getByText('Online-Check-in durchführen')).toBeVisible();
  await expect(page.getByText('Gepäckbestimmungen prüfen')).toBeVisible();
  await expect(page.getByText('Handgepäck-Maße und Flüssigkeitsregel prüfen')).toBeVisible();

  await page.getByText('Gepäckbestimmungen prüfen').click(); // abwählen
  await page.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(page.getByRole('heading', { name: 'Deine Reise ist vorbereitet.' })).toBeHidden();

  await page.getByRole('button', { name: 'Aufgaben', exact: true }).click();
  await expect(page.getByText('Online-Check-in durchführen')).toBeVisible();
  await expect(page.getByText('Gepäckbestimmungen prüfen')).toHaveCount(0);

  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

test('participants: a solo trip starts owned by its creator alone, and the owner can add/remove a contact', async ({ page }) => {
  await page.goto('/demo/reisen');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Reisen', exact: true }).click();

  const row = page.locator('.trip-row-wrap', { hasText: 'Berlin Wochenende' });
  await row.getByRole('button', { name: /Teilnehmer verwalten/ }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: /Teilnehmer – Berlin Wochenende/ })).toBeVisible();
  // Solo: der Ersteller ist sofort der einzige Teilnehmer, keine Gruppe/Haushalt-Pflicht.
  await expect(dialog.locator('.row', { hasText: 'Anna' })).toContainText('(Du)');
  await expect(dialog.locator('.row', { hasText: 'Anna' })).toContainText('Besitzer');
  await expect(dialog.locator('.row')).toHaveCount(1);

  // Hinzufügen aus den eigenen Kontakten, nicht per freier E-Mail-Eingabe.
  await dialog.getByLabel('Person').click();
  await page.getByRole('option', { name: 'Max' }).click();
  await dialog.getByLabel('Rolle').click();
  await page.getByRole('option', { name: 'Bearbeiter' }).click();
  await dialog.getByRole('button', { name: 'Hinzufügen' }).click();

  await expect(dialog.locator('.row', { hasText: 'Max' })).toContainText('Bearbeiter');
  await expect(dialog.locator('.row')).toHaveCount(2);

  // Entfernen: der Ersteller darf jeden entfernen, ohne die Reise selbst zu verlieren.
  await dialog.locator('.row', { hasText: 'Max' }).getByRole('button', { name: /entfernen/ }).click();
  await expect(dialog.locator('.row', { hasText: 'Max' })).toHaveCount(0);
  await expect(dialog.locator('.row')).toHaveCount(1);

  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

test('trip detail overview: header, countdown/status and readiness checklist reflect the real trip data', async ({ page }) => {
  await page.goto('/demo/reisen');
  await page.waitForLoadState('networkidle');

  const detail = page.locator('.trip-detail');
  await expect(detail.locator('h2')).toHaveText('Berlin, Deutschland');
  await expect(detail).toContainText('Berlin Wochenende');
  await expect(detail).toContainText('Geplant');
  await expect(detail).toContainText('Nur du');

  // Demo-Daten: 1 von 3 gepackt (33%), 1 von 2 Aufgaben erledigt (50%), Budget gesetzt (100%), Zeitraum (100%)
  // → Schnitt 71% (siehe trip-readiness.spec.ts für die Berechnungsregel).
  await expect(detail.locator('.readiness__percent')).toHaveText('71 %');
  await expect(detail.locator('.readiness__list')).toContainText('Reisezeitraum vollständig');
  await expect(detail.locator('.readiness__list')).toContainText('1 von 3 Packitems');
  await expect(detail.locator('.readiness__list')).toContainText('1 von 2 Aufgaben');
  await expect(detail.locator('.readiness__list')).toContainText('Budget festgelegt');
  await expect(detail.locator('.readiness__list')).toContainText('Noch offene Vorbereitung');

  await expect(detail.locator('.trip-cards__item--aufgaben')).toContainText('Zugtickets buchen');
  await expect(detail.locator('.trip-cards__item--packliste')).toContainText('1 von 3 gepackt');
  await expect(detail.locator('.trip-cards__item--budget')).toContainText('90,00 €');
  await expect(detail.locator('.trip-cards__item--teilnehmer')).toContainText('Nur du');

  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

test('readiness reaches 100% once a brand-new trip is fully packed, tasked and budgeted', async ({ page }) => {
  await page.goto('/demo/reisen');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'Neue Reise' }).click();
  await page.locator('#trip-title').fill('Rom Kurztrip');
  await pickDate(page, page.getByLabel('Beginn', { exact: true }), iso(40));
  await pickDate(page, page.getByLabel('Ende', { exact: true }), iso(43));
  await page.locator('app-modal-form form').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await page.getByRole('button', { name: 'Überspringen', exact: true }).click();

  // Neu angelegt, noch nichts vorbereitet außer dem Zeitraum: (100+0+0)/3 = 33% (kein Budget → ausgeklammert).
  const detail = page.locator('.trip-detail');
  await expect(detail.locator('.readiness__percent')).toHaveText('33 %');
  await expect(detail.locator('.readiness__list')).toContainText('Noch keine Packliste');
  await expect(detail.locator('.readiness__list')).toContainText('Noch keine Aufgaben');
  await expect(detail.locator('.readiness__list')).not.toContainText('Budget festgelegt');

  await page.getByRole('button', { name: 'Packliste', exact: true }).click();
  await page.getByRole('button', { name: 'Artikel hinzufügen' }).click();
  await page.locator('#packing-item-title').fill('Sonnenbrille');
  await page.locator('app-modal-form form').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await page.locator('.row', { hasText: 'Sonnenbrille' }).locator('.completion').click();

  await page.getByRole('button', { name: 'Aufgaben', exact: true }).click();
  await page.getByRole('button', { name: 'Aufgabe hinzufügen' }).click();
  await page.locator('#task-item-title').fill('Koffer packen');
  await page.locator('app-modal-form form').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await page.locator('.row', { hasText: 'Koffer packen' }).locator('.completion').click();

  await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
  // Zeitraum 100, Packliste 100, Aufgaben 100, weiterhin kein Budget (ausgeklammert) → 100%, ohne je ein
  // Budget hinterlegt zu haben (das optionale Feature darf nicht unnötig bestrafen).
  await expect(detail.locator('.readiness__percent')).toHaveText('100 %');
  await expect(detail.locator('.readiness__list')).toContainText('Alles vorbereitet');
});

// Mobile: Reiseheader → Countdown/Status → Reisebereitschaft → Aufgaben → Packliste → Budget → Teilnehmer,
// einspaltig. Desktop darf die vier Karten nebeneinander anordnen (kein strikter 1-Spalten-Zwang).
test('trip detail overview: mobile stacks sections in the prescribed order, desktop may use a multi-column grid', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/demo/reisen');
  await page.waitForLoadState('networkidle');

  const aufgabenCard = page.locator('.trip-cards__item--aufgaben');
  const packlisteCard = page.locator('.trip-cards__item--packliste');
  const budgetCard = page.locator('.trip-cards__item--budget');
  const teilnehmerCard = page.locator('.trip-cards__item--teilnehmer');

  const yOf = async (locator: typeof aufgabenCard) => (await locator.boundingBox())!.y;
  const [headerY, readinessY, aufgabenY, packlisteY, budgetY, teilnehmerY] = await Promise.all([
    yOf(page.locator('.trip-detail__header')),
    yOf(page.locator('.readiness')),
    yOf(aufgabenCard),
    yOf(packlisteCard),
    yOf(budgetCard),
    yOf(teilnehmerCard),
  ]);
  expect(headerY).toBeLessThan(readinessY);
  expect(readinessY).toBeLessThan(aufgabenY);
  expect(aufgabenY).toBeLessThan(packlisteY);
  expect(packlisteY).toBeLessThan(budgetY);
  expect(budgetY).toBeLessThan(teilnehmerY);

  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

  await page.setViewportSize({ width: 1440, height: 1000 });
  // Am Desktop dürfen sich Aufgaben- und Packlisten-Karte eine Zeile teilen (2-Spalten-Grid), statt wie am
  // Handy strikt untereinander zu stehen.
  const [aufgabenYDesktop, packlisteYDesktop] = await Promise.all([yOf(aufgabenCard), yOf(packlisteCard)]);
  expect(Math.abs(aufgabenYDesktop - packlisteYDesktop)).toBeLessThan(5);
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
