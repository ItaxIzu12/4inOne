import { test, expect, Page } from '@playwright/test';
import { choose, pickDate } from './helpers';
import AxeBuilder from '@axe-core/playwright';

// Reisen V1 (docs/REISEN_V1.md): Meine Reisen → eine Reise mit Übersicht, Planung, Packliste, Budget.

function iso(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
async function axe(page: Page) {
  // Erst prüfen, wenn Einblend-Animationen fertig sind (sonst misst axe Zwischenfarben).
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
}
async function noOverflow(page: Page, label: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label).toBe(true);
}
async function submit(page: Page) {
  await page.locator('app-modal-form form').evaluate((f: HTMLFormElement) => f.requestSubmit());
}
async function tab(page: Page, label: string) {
  await page.locator('nav.tabs button', { hasText: label }).click();
}
async function openDemo(page: Page, path = '/demo/reisen') {
  await page.route('http://localhost:8000/api/**', (r) => r.abort());
  await page.goto(path);
  await expect(page.locator('main h1')).toBeVisible();
}
/** „Reise erstellen“: am Rechner oben im Kopf, am Handy der feste Knopf unten. */
async function createTrip(page: Page, title: string, destination: string, from: string, to: string) {
  await page.locator('.page-heading .primary:visible, app-mobile-action button:visible').first().click();
  await page.locator('#trip-title').fill(title);
  await page.locator('#trip-destination').fill(destination);
  await pickDate(page, page.getByLabel('Erster Tag', { exact: true }), from);
  await pickDate(page, page.getByLabel('Letzter Tag', { exact: true }), to);
}

for (const width of [390, 1440]) {
  test(`Reise anlegen, öffnen, bearbeiten, absagen und löschen (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openDemo(page);

    await createTrip(page, 'Städtetrip Wien', 'Wien', iso(60), iso(63));
    await page.getByRole('button', { name: /Weitere Angaben/ }).click();
    await page.locator('#trip-departure').fill('DUS');
    await page.locator('#trip-accommodation').fill('Hotel Sacher');
    await submit(page);

    // Neue Reise öffnet sich direkt; Vorschläge sind optional.
    await expect(page.getByRole('heading', { name: 'Reise erstellt' })).toBeVisible();
    await page.getByRole('button', { name: 'Ohne Vorschläge starten' }).click();
    await expect(page.locator('main h1')).toHaveText('Städtetrip Wien');
    await expect(page.locator('nav.tabs button')).toHaveText(['Übersicht', 'Planung', 'Packliste', 'Budget']);
    await expect(page.locator('app-trip-overview .facts')).toContainText('DUS');
    await expect(page.locator('app-trip-overview .countdown')).toContainText('In 60 Tagen');

    await page.getByRole('button', { name: 'Reise bearbeiten' }).click();
    await page.locator('#trip-title').fill('Städtetrip Wien lang');
    await choose(page, 'Status', 'Abgesagt');
    await submit(page);
    await expect(page.locator('main h1')).toHaveText('Städtetrip Wien lang');
    await expect(page.locator('.trip-heading .status')).toHaveText('Abgesagt');

    await page.getByRole('button', { name: 'Meine Reisen' }).click();
    await page.getByRole('button', { name: /Abgesagt/ }).click();
    await expect(page.locator('app-trip-list .trip', { hasText: 'Städtetrip Wien lang' })).toBeVisible();
    await noOverflow(page, `Meine Reisen @ ${width}`);
    await axe(page);

    await page.locator('app-trip-list .trip', { hasText: 'Städtetrip Wien lang' }).click();
    await page.getByRole('button', { name: 'Reise bearbeiten' }).click();
    await page.getByRole('button', { name: 'Reise löschen' }).click();
    await expect(page.getByText('Wirklich löschen?')).toBeVisible();
    await page.getByRole('button', { name: 'Ja, löschen' }).click();
    await expect(page.locator('app-trip-list')).toBeVisible();
    await expect(page.getByText('Städtetrip Wien lang')).toHaveCount(0);
  });
}

test('Datum: Ende vor Beginn wird am Feld erklärt; eine vergangene Reise ist erlaubt', async ({ page }) => {
  await openDemo(page);
  // Der Kalender bietet für das Ende nur Tage ab dem Beginn an — der Fehler entsteht, wenn der Beginn später verschoben wird.
  await createTrip(page, 'Falsch', 'Hamburg', iso(20), iso(27));
  await pickDate(page, page.getByLabel('Erster Tag', { exact: true }), iso(30));
  await submit(page);
  await expect(page.getByText('Das Ende darf nicht vor dem Beginn liegen.')).toBeVisible();
  await pickDate(page, page.getByLabel('Erster Tag', { exact: true }), iso(-30));
  await pickDate(page, page.getByLabel('Letzter Tag', { exact: true }), iso(-27));
  await submit(page);
  await page.getByRole('button', { name: 'Ohne Vorschläge starten' }).click();
  await expect(page.locator('app-trip-overview .countdown')).toContainText('Vorbei');
});

test('Überschneidung wird erklärt; „Daten prüfen“ führt zurück, „Trotzdem speichern“ speichert', async ({ page }) => {
  await openDemo(page);
  await createTrip(page, 'Potsdam', 'Potsdam', iso(13), iso(14));
  await submit(page);
  await expect(page.getByRole('alert')).toContainText('Diese Reise überschneidet sich mit „Berlin Wochenende“');
  await page.getByRole('button', { name: 'Daten prüfen' }).click();
  await expect(page.locator('#trip-title')).toHaveValue('Potsdam');
  await submit(page);
  await page.getByRole('button', { name: 'Trotzdem speichern' }).click();
  await page.getByRole('button', { name: 'Ohne Vorschläge starten' }).click();
  await expect(page.locator('main h1')).toHaveText('Potsdam');
});

test('Wetter am Ziel: nach Reisemonat vorgeschlagen, Wintersport → Schnee, eigene Wahl bleibt — und prägt die Vorschläge', async ({ page }) => {
  await openDemo(page);
  await createTrip(page, 'Bergwoche', 'Arlberg', iso(60), iso(64));
  await page.getByRole('button', { name: /Weitere Angaben/ }).click();
  const month = Number(iso(60).slice(5, 7));
  const expected = month >= 6 && month <= 8 ? 'Warm' : month >= 11 || month <= 2 ? 'Kalt' : 'Mild';
  const weather = page.getByLabel(/^Wetter am Ziel/);
  await expect(weather).toContainText(expected);
  await expect(page.getByText('Geschätzt nach Reisemonat – bitte prüfen')).toBeVisible();

  await choose(page, 'Reiseart (optional)', 'Wintersport');
  await expect(weather).toContainText('Schnee');
  await expect(page.getByText('Aus „Wintersport“ übernommen – bitte prüfen')).toBeVisible();

  // Eigene Wahl: bleibt, auch wenn sich das Datum ändert.
  await weather.click();
  await page.getByRole('option', { name: 'Mild', exact: true }).click();
  await expect(page.getByText(/bitte prüfen/)).toHaveCount(0);
  await pickDate(page, page.getByLabel('Erster Tag', { exact: true }), iso(61));
  await expect(weather).toContainText('Mild');

  await submit(page);
  await page.getByRole('button', { name: 'Vorschläge ansehen' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Passend zu Wintersport · Mild');
  await expect(dialog).toContainText('Skibrille');
  await expect(dialog).toContainText('Regenjacke');
  await expect(dialog).toContainText('Skipass kaufen');
});

test('Gepäck ist kombinierbar: Handgepäck und Aufgabegepäck, bleibt beim Bearbeiten erhalten und prägt die Vorschläge', async ({ page }) => {
  await openDemo(page);
  await createTrip(page, 'Mallorca', 'Palma, Spanien', iso(40), iso(47));
  await page.getByRole('button', { name: /Weitere Angaben/ }).click();
  const group = page.getByRole('group', { name: /Gepäck/ });
  await expect(group.getByRole('button')).toHaveText(['Handgepäck', 'Aufgabegepäck', 'Gepäck im Auto']);
  await expect(page.getByText('Nur Handgepäck')).toHaveCount(0);
  await group.getByRole('button', { name: 'Handgepäck', exact: true }).click();
  await group.getByRole('button', { name: 'Aufgabegepäck' }).click();
  await expect(group.getByRole('button', { name: 'Handgepäck', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(group.getByRole('button', { name: 'Aufgabegepäck' })).toHaveAttribute('aria-pressed', 'true');
  await expect(group.getByRole('button', { name: 'Gepäck im Auto' })).toHaveAttribute('aria-pressed', 'false');
  await submit(page);

  await page.getByRole('button', { name: 'Vorschläge ansehen' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Kofferanhänger');
  await expect(dialog).toContainText('Handgepäck-Maße und Flüssigkeitsregel prüfen');
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();

  await page.getByRole('button', { name: 'Reise bearbeiten' }).click();
  await page.getByRole('button', { name: /Weitere Angaben/ }).click();
  await expect(page.getByRole('group', { name: /Gepäck/ }).locator('[aria-pressed="true"]')).toHaveText(['Handgepäck', 'Aufgabegepäck']);
});

test('Vorschläge: aus der Planung nur Aufgaben, aus der Packliste nur Packstücke — angehakt wird übernommen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDemo(page, '/demo/reisen?trip=3&tab=planung');
  await page.getByRole('button', { name: 'Vorschläge ansehen' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Vorschläge für die Planung' })).toBeVisible();
  await expect(dialog).toContainText('Unterkunft prüfen');
  await expect(dialog).not.toContainText('Reisepass');
  await expect(dialog).toContainText(/(\d+) von \1 ausgewählt/);
  await axe(page);

  await dialog.getByRole('button', { name: 'Alle abwählen' }).click();
  await expect(dialog.getByRole('button', { name: 'Nichts ausgewählt' })).toBeDisabled();
  await dialog.getByRole('checkbox', { name: 'Unterkunft prüfen' }).check();
  await dialog.getByRole('checkbox', { name: /^Koffer packen/ }).check();
  await dialog.getByRole('button', { name: '2 Aufgaben übernehmen' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('app-trip-planning .row', { hasText: 'Unterkunft prüfen' })).toBeVisible();
  await expect(page.locator('app-trip-planning .row', { hasText: 'Koffer packen' })).toBeVisible();

  await tab(page, 'Packliste');
  await page.getByRole('button', { name: 'Vorlage verwenden' }).click();
  await expect(dialog.getByRole('heading', { name: 'Vorschläge für die Packliste' })).toBeVisible();
  await expect(dialog).toContainText('Reisepass / Ausweis');
  await expect(dialog).not.toContainText('Unterkunft prüfen');
  await expect(dialog.getByRole('heading', { name: /Wichtige Dokumente/ })).toBeVisible();
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(dialog).toHaveCount(0);
});

test('Planung: Aufgabe hinzufügen und erledigen — der Zähler folgt überall', async ({ page }) => {
  await openDemo(page, '/demo/reisen?trip=1&tab=planung');
  await page.locator('#trip-task-quick').fill('Hotel buchen');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Offen 5/ })).toBeVisible();
  // Erledigt verschwindet die Aufgabe aus „Offen“ — deshalb klicken statt check() (das auf das Kästchen wartet).
  await page.locator('app-trip-planning .row', { hasText: 'Hotel buchen' }).getByRole('checkbox').click();
  await expect(page.getByRole('button', { name: /Offen 4/ })).toBeVisible();
  await tab(page, 'Übersicht');
  await expect(page.locator('app-trip-overview .tile-card').first()).toContainText('4 Aufgaben offen');

  // Mit Datum, Uhrzeit und Zuständigkeit über das Formular.
  await tab(page, 'Planung');
  await page.locator('#trip-task-quick').fill('Online Check-in Rückflug');
  await page.getByRole('button', { name: 'Mit Datum, Uhrzeit und Zuständigkeit hinzufügen' }).click();
  await expect(page.locator('#task-item-title')).toHaveValue('Online Check-in Rückflug');
  await pickDate(page, page.getByLabel(/^Fällig am/), iso(13));
  await page.getByLabel(/^Wer kümmert sich\?/).click();
  await page.getByRole('option', { name: 'Tom Schulz', exact: true }).click();
  await submit(page);
  await expect(page.locator('app-trip-planning .row', { hasText: 'Online Check-in Rückflug' })).toContainText('Tom Schulz');
});

test('Packliste: Reisepass, Ladekabel, Jacke — zwei abgehakt ergibt 2 von 3', async ({ page }) => {
  await openDemo(page, '/demo/reisen?trip=3&tab=packliste');
  await expect(page.getByRole('heading', { name: 'Noch keine Packliste' })).toBeVisible();
  await page.getByRole('button', { name: 'Artikel hinzufügen' }).click();
  await page.locator('#packing-item-title').fill('Reisepass');
  await submit(page);
  for (const item of ['Ladekabel', 'Jacke']) {
    await page.locator('#packing-quick').fill(item);
    await page.keyboard.press('Enter');
    await expect(page.locator('app-trip-packing .item', { hasText: item })).toBeVisible();
  }
  for (const item of ['Reisepass', 'Ladekabel']) await page.locator('app-trip-packing .item', { hasText: item }).getByRole('checkbox').check();
  await expect(page.locator('#pk-progress')).toHaveText('2 von 3 gepackt');
  await page.locator('app-trip-packing .item', { hasText: 'Reisepass' }).getByRole('checkbox').uncheck();
  await expect(page.locator('#pk-progress')).toHaveText('1 von 3 gepackt');
});

test('Budget: 700 € Budget, Hotel 280 € und Zug 140 € ergeben 420 € ausgegeben, 280 € übrig — auch vor der Reise', async ({ page }) => {
  await openDemo(page, '/demo/reisen?trip=3&tab=budget');
  await expect(page.getByRole('heading', { name: 'Noch kein Reisebudget' })).toBeVisible();
  await page.getByRole('button', { name: 'Gesamtbudget festlegen' }).click();
  await page.locator('#plan-total').fill('700');
  await choose(page, 'Währung', 'EUR – Euro');
  await submit(page);
  for (const [title, amount, date] of [['Hotel', '280', iso(-20)], ['Zug', '140', iso(-3)]]) {
    await page.locator('app-trip-budget').getByRole('button', { name: 'Ausgabe hinzufügen' }).click();
    await page.locator('#expense-title').fill(title);
    await page.locator('#expense-amount').fill(amount);
    await pickDate(page, page.getByLabel('Bezahlt am', { exact: true }), date);
    await submit(page);
    await expect(page.locator('app-trip-budget .exp', { hasText: title })).toBeVisible();
  }
  await expect(page.locator('app-trip-budget .kpis dd')).toHaveText(['700 €', '420 €', '280 €']);
  await expect(page.locator('app-trip-budget .exp', { hasText: 'Hotel' })).toContainText('vor der Reise');
});

test('Reisebudget: leer speichern erklärt, was fehlt; „1.500“ wird 1.500 und bleibt sichtbar', async ({ page }) => {
  await openDemo(page, '/demo/reisen?trip=3&tab=budget');
  await page.getByRole('button', { name: 'Budget festlegen' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(page.locator('#plan-total')).toBeFocused();
  await expect(page.getByText(/Bitte gib/)).toHaveCount(0);
  await page.getByLabel('Währung', { exact: true }).click();
  const options = page.getByRole('option');
  await expect(options).toHaveCount(30);
  await expect(options.filter({ hasText: 'JPY – Japanischer Yen' })).toHaveCount(1);
  await expect(options.filter({ hasText: 'GBP – Britisches Pfund' })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await submit(page);
  await expect(dialog).toBeVisible();
  await expect(page.getByText('Bitte gib ein Gesamtbudget größer als 0 ein.').first()).toBeVisible();

  await page.locator('#plan-total').pressSequentially('1.500');
  await expect(page.getByText('Bitte gib ein Gesamtbudget größer als 0 ein.')).toHaveCount(0);
  // Umrechnung live, als Richtkurs gekennzeichnet (Demo: Beispielkurs).
  await expect(dialog.locator('app-fx-hint')).toContainText('≈ 1.595,74 € in deiner Heimatwährung');
  await expect(dialog.locator('app-fx-hint')).toContainText('Der tatsächliche Wechselkurs deiner Bank, Karte oder Wechselstube kann abweichen.');
  await submit(page);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('app-trip-budget .kpis')).toContainText('1.500 CHF');
  await expect(page.locator('app-trip-budget .kpis')).toContainText('≈ 1.596 €');
});

test('Budget-Kategorie: Zeile antippen, Betrag ändern und Planung wieder entfernen', async ({ page }) => {
  await openDemo(page, '/demo/reisen?trip=3&tab=budget');
  await page.getByRole('button', { name: 'Budget festlegen' }).first().click();
  await page.locator('#plan-total').pressSequentially('1000');
  await page.locator('#plan-UNTERKUNFT').pressSequentially('300');
  await submit(page);
  const row = page.getByRole('button', { name: /^Unterkunft: .*Planung bearbeiten$/ });
  await expect(row).toContainText('von 300 CHF');

  await row.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Unterkunft planen' })).toBeVisible();
  await expect(page.locator('#cat-plan-amount')).toHaveValue('300,00');
  await expect(page.locator('#cat-plan-amount')).toBeFocused();
  await page.locator('#cat-plan-amount').fill('450');
  await submit(page);
  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText('von 450 CHF');

  await row.click();
  await dialog.getByRole('button', { name: 'Planung entfernen' }).click();
  await dialog.getByRole('button', { name: 'Ja, löschen' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Unterkunft: / })).toHaveCount(0);
});

test('Japan: Reisewährung aus dem Ziel, Ausgaben in Yen und Euro, ohne Budget nur „Bisher ausgegeben“', async ({ page }) => {
  await openDemo(page);
  await createTrip(page, 'Japanreise', 'Tokio, Japan', iso(200), iso(209));
  await submit(page);
  await page.getByRole('button', { name: 'Ohne Vorschläge starten' }).click();
  await tab(page, 'Budget');

  // Ausgabe ohne Budget: Yen vorausgewählt, Euro-Gegenwert live.
  await page.locator('app-trip-budget').getByRole('button', { name: 'Ausgabe hinzufügen' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Währung', { exact: true })).toContainText('JPY – Japanischer Yen');
  await page.locator('#expense-title').fill('Restaurant');
  await page.locator('#expense-amount').pressSequentially('8.500');
  await expect(dialog.locator('app-fx-hint')).toContainText('≈ 48,71 € in deiner Heimatwährung');
  await choose(page, 'Kategorie', 'Essen');
  await submit(page);
  await expect(dialog).toHaveCount(0);
  const budget = page.locator('app-trip-budget');
  await expect(budget.getByRole('heading', { name: 'Noch kein Gesamtbudget' })).toBeVisible();
  await expect(budget.locator('.kpis')).toContainText('Bisher ausgegeben');
  await expect(budget.locator('.kpis')).toContainText('8.500 ¥');
  await expect(budget).not.toContainText(/Verbleibend|Über Budget|verbraucht/);
  await expect(budget.locator('.exp li', { hasText: 'Restaurant' })).toContainText('8.500 ¥');
  await expect(budget.locator('.exp li', { hasText: 'Restaurant' })).toContainText('≈ 48,71 €');

  // Flug vorab in Euro bezahlt: bleibt 100 €, zählt mit 17.450 JPY ins Budget — nie 8.500 + 100.
  await budget.getByRole('button', { name: 'Ausgabe hinzufügen' }).click();
  await page.locator('#expense-title').fill('Flug');
  await page.locator('#expense-amount').pressSequentially('100');
  await choose(page, 'Währung', 'EUR – Euro');
  // In der Heimatwährung bezahlt: keine redundante „≈ … €“-Zeile; der Yen-Wert fürs Budget entsteht intern.
  await expect(dialog.locator('app-fx-hint .fx')).toHaveCount(0);
  await submit(page);
  await expect(budget.locator('.exp li', { hasText: 'Flug' })).toContainText('100,00 €');
  await expect(budget.locator('.exp li', { hasText: 'Flug' })).not.toContainText('≈');

  await budget.getByRole('button', { name: 'Budget festlegen' }).click();
  await expect(dialog.getByLabel('Währung', { exact: true })).toContainText('JPY – Japanischer Yen');
  // Ohne Tausenderpunkt getippt — beim Verlassen formatiert.
  await page.locator('#plan-total').pressSequentially('250000');
  await page.keyboard.press('Tab');
  await expect(page.locator('#plan-total')).toHaveValue('250.000');
  await submit(page);
  await expect(budget.locator('.kpis dd.num:not(.approx)')).toHaveText(['250.000 ¥', '25.950 ¥', '224.050 ¥']);
  await expect(budget.locator('.rate-note')).toContainText('Beispielkurs (Demo)');
});

// ---------- Echtes Konto mit anderer Heimatwährung (keine Währung ist bevorzugt) ----------

async function liveTrip(page: Page, home: string, trip: { currency: string; budget_amount?: string | null; destination?: string }) {
  const data = {
    id: 7, title: 'Testreise', destination: trip.destination ?? 'Tokio, Japan', departure: '', start_date: iso(30), end_date: iso(35), notes: '',
    status: 'PLANNED', travel_type: '', transport_type: '', baggage: [], climate: '', budget_amount: trip.budget_amount ?? null,
    currency: trip.currency, accommodation: '', accommodation_area: '', transport_note: '', created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z', packing_total: 0, packing_packed: 0, tasks_open: 0, tasks_total: 0, events_count: 0,
    budget_spent: '0.00', participants: [], my_role: 'OWNER',
  };
  await page.route('**/api/v1/**', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira', email: 'mira@example.com', home_currency: home } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true, domains: [] } }));
  await page.route('**/api/v1/fx/rates/', (r) =>
    r.fulfill({ json: { available: true, base: 'EUR', rate_date: iso(-1), source: 'EZB-Referenzkurs', rates: { EUR: '1', CHF: '0.94', JPY: '174.5', USD: '1.10' } } }),
  );
  await page.route('**/api/v1/reisen/trips/**', (r) => r.fulfill({ json: /trips\/7\/$/.test(r.request().url()) ? data : [data] }));
  await page.goto('/reisen?trip=7&tab=budget');
  await expect(page.locator('main h1')).toHaveText('Testreise');
}

test('Heimatwährung CHF: 120 € werden in Franken umgerechnet, das Budget ebenso — nichts nimmt Euro an', async ({ page }) => {
  await liveTrip(page, 'CHF', { currency: 'JPY', budget_amount: '250000.00' });
  const budget = page.locator('app-trip-budget');
  await expect(budget.locator('.kpis')).toContainText('250.000 ¥');
  await expect(budget.locator('.kpis')).toContainText('≈ 1.347 CHF');
  await expect(budget.locator('.kpis')).not.toContainText('≈ 0');
  await expect(budget.locator('.kpis')).not.toContainText('€');
  await expect(budget.locator('.rate-note')).toContainText('Umrechnung nach aktuellem Richtkurs (EZB-Referenzkurs');

  await budget.getByRole('button', { name: 'Ausgabe hinzufügen' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Währung', { exact: true })).toContainText('JPY – Japanischer Yen');
  await page.locator('#expense-amount').pressSequentially('120');
  await choose(page, 'Währung', 'EUR – Euro');
  const hint = dialog.locator('app-fx-hint');
  await expect(hint).toContainText('≈ 112,80 CHF in deiner Heimatwährung');
  await expect(hint).toContainText('1 EUR ≈ 0,94 CHF');
  await expect(hint).toContainText('Der tatsächliche Wechselkurs deiner Bank, Karte oder Wechselstube kann abweichen.');
  // In der Heimatwährung bezahlt: keine Umrechnungszeile.
  await choose(page, 'Währung', 'CHF – Schweizer Franken');
  await expect(hint.locator('.fx')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(dialog).toHaveCount(0);
});

for (const width of [360, 390, 430]) {
  test(`Umrechnung am Handy (${width}px): kein Querscrollen, barrierearm`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await liveTrip(page, 'CHF', { currency: 'JPY', budget_amount: '250000.00' });
    await noOverflow(page, 'Budget');
    await page.locator('app-trip-budget').getByRole('button', { name: 'Ausgabe hinzufügen' }).first().click();
    await page.locator('#expense-title').fill('Restaurant');
    await page.locator('#expense-amount').pressSequentially('8.500');
    await expect(page.getByRole('dialog').locator('app-fx-hint')).toContainText('≈ 45,79 CHF');
    await noOverflow(page, 'Ausgabe-Dialog');
    await axe(page);
  });
}

test('Heimatwährung JPY: 100 € erscheinen als Yen-Wert', async ({ page }) => {
  await liveTrip(page, 'JPY', { currency: 'EUR', destination: 'Lissabon, Portugal' });
  await page.locator('app-trip-budget').getByRole('button', { name: 'Ausgabe hinzufügen' }).click();
  const dialog = page.getByRole('dialog');
  await page.locator('#expense-amount').pressSequentially('100');
  await expect(dialog.locator('app-fx-hint')).toContainText('≈ 17.450 ¥ in deiner Heimatwährung');
  await expect(dialog.locator('app-fx-hint')).toContainText('1 EUR ≈ 174,5 JPY');
});

test('Kurs nicht verfügbar: Betrag bleibt erfassbar, kein geratener Wert', async ({ page }) => {
  await liveTrip(page, 'EUR', { currency: 'JPY' });
  await page.route('**/api/v1/fx/rates/', (r) => r.fulfill({ json: { available: false, base: 'EUR', rate_date: null, rates: {} } }));
  await page.reload();
  await page.locator('app-trip-budget').getByRole('button', { name: 'Ausgabe hinzufügen' }).click();
  const dialog = page.getByRole('dialog');
  await page.locator('#expense-amount').pressSequentially('8.500');
  await expect(dialog.locator('app-fx-hint')).toContainText('Umrechnung derzeit nicht verfügbar.');
  await expect(dialog.locator('app-fx-hint')).not.toContainText('≈');
});

test('Ausgabe: Fehler erst nach „Ausgabe speichern“, live korrigiert; Abbrechen prüft nichts', async ({ page }) => {
  await openDemo(page, '/demo/reisen?trip=3&tab=budget');
  const open = () => page.locator('app-trip-budget').getByRole('button', { name: 'Ausgabe hinzufügen' }).click();
  await open();
  const dialog = page.getByRole('dialog');
  await page.locator('#expense-title').click();
  await page.locator('#expense-amount').click();
  await dialog.getByRole('heading').click();
  await expect(dialog.locator('.field__error')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(dialog).toHaveCount(0);

  await open();
  await dialog.getByRole('button', { name: 'Ausgabe speichern' }).click();
  await expect(dialog.locator('.field__error')).toHaveText(['Bitte Beschreibung angeben.', 'Bitte gib einen Betrag ein.']);
  await expect(page.locator('#expense-title')).toBeFocused();
  await page.locator('#expense-amount').pressSequentially('12');
  await expect(dialog.locator('.field__error')).toHaveText(['Bitte Beschreibung angeben.']);
  await page.locator('#expense-title').fill('Kaffee');
  await expect(dialog.locator('.field__error')).toHaveCount(0);
});

test('alle Ansichten passen bei 360, 390, 430, Tablet und Desktop ohne Querscrollen und sind barrierearm', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (r) => r.abort());
  const paths = ['', '?trip=1', '?trip=1&tab=planung', '?trip=1&tab=packliste', '?trip=1&tab=budget'];
  for (const width of [360, 390, 430, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(`/demo/reisen${path}`);
      await expect(page.locator('main h1')).toBeVisible();
      await noOverflow(page, `${path || 'Meine Reisen'} @ ${width}`);
    }
  }
  for (const path of paths.slice(1)) {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`/demo/reisen${path}`);
    await expect(page.locator('main h1')).toBeVisible();
    await axe(page);
  }
});

test('Teilnehmer: einladen und verwalten in der Planung, Hinweis zur Privatsphäre', async ({ page }) => {
  await openDemo(page, '/demo/reisen?trip=1&tab=planung');
  await expect(page.locator('app-trip-planning .privacy')).toContainText('nie deine Finanzen, deinen Haushalt oder deinen Kalender');
  await page.getByRole('button', { name: 'Verwalten' }).click();
  await choose(page, 'Person', 'Lena');
  await page.locator('.participants-editor').getByRole('button', { name: 'Einladen' }).click();
  // Einladung statt sofortiger Teilnahme: Lena ist erst dabei, wenn sie annimmt.
  await expect(page.locator('.participants-editor')).toContainText('Einladung gesendet. Lena ist dabei, sobald Lena annimmt.');
  await expect(page.locator('.participants-editor .row', { hasText: 'Lena' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tom Schulz entfernen' }).click();
  await expect(page.locator('.participants-editor .row', { hasText: 'Tom Schulz' })).toHaveCount(0);
});

// Echtes (angemeldetes) Konto ohne jede Reise: kein Fake-Trip, klarer Leerzustand.
test('ein echtes Konto ohne Reisen sieht „Noch keine Reisen“, nie eine Demo-Reise', async ({ page }) => {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 'test' } }));
  await page.route('**/api/v1/auth/refresh/', (r) =>
    r.fulfill({ json: { access: 'test', user: { name: 'Mira', email: 'mira@example.com' } } }),
  );
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  await page.route('**/api/v1/reisen/trips/**', (r) => r.fulfill({ json: [] }));
  await page.goto('/reisen');
  await expect(page.getByRole('heading', { name: 'Noch keine Reisen' })).toBeVisible();
  await expect(page.getByText('Plane deine erste Reise')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reise erstellen' })).toHaveCount(1);
  await expect(page.getByText('Berlin Wochenende')).toHaveCount(0);
});

test('eine fremde oder gelöschte Reise verrät nichts', async ({ page }) => {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 'test' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 'test', user: { name: 'Mira', email: 'mira@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  await page.route('**/api/v1/reisen/trips/**', (r) => r.fulfill({ json: [] }));
  await page.goto('/reisen?trip=42');
  await expect(page.getByRole('heading', { name: 'Reise nicht gefunden' })).toBeVisible();
  await expect(page.getByText('oder du hast keinen Zugriff darauf')).toBeVisible();
});
