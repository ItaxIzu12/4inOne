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

test('Planung: Aufgabe hinzufügen und erledigen — der Zähler folgt überall', async ({ page }) => {
  await openDemo(page, '/demo/reisen?trip=1&tab=planung');
  await page.locator('#trip-task-quick').fill('Hotel buchen');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Offen 5/ })).toBeVisible();
  await page.locator('app-trip-planning .row', { hasText: 'Hotel buchen' }).getByRole('checkbox').check();
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
  await page.getByRole('button', { name: 'Budget festlegen' }).click();
  await page.locator('#plan-total').fill('700');
  await choose(page, 'Währung', 'Euro (€)');
  await submit(page);
  for (const [title, amount, date] of [['Hotel', '280', iso(-20)], ['Zug', '140', iso(-3)]]) {
    await page.locator('app-trip-budget').getByRole('button', { name: 'Ausgabe erfassen' }).click();
    await page.locator('#expense-title').fill(title);
    await page.locator('#expense-amount').fill(amount);
    await pickDate(page, page.getByLabel('Bezahlt am', { exact: true }), date);
    await submit(page);
    await expect(page.locator('app-trip-budget .exp', { hasText: title })).toBeVisible();
  }
  await expect(page.locator('app-trip-budget .kpis dd')).toHaveText(['700 €', '420 €', '280 €']);
  await expect(page.locator('app-trip-budget .exp', { hasText: 'Hotel' })).toContainText('vor der Reise');
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

test('Teilnehmer: verwalten in der Planung, Hinweis zur Privatsphäre', async ({ page }) => {
  await openDemo(page, '/demo/reisen?trip=1&tab=planung');
  await expect(page.locator('app-trip-planning .privacy')).toContainText('nie deine Finanzen, deinen Haushalt oder deinen Kalender');
  await page.getByRole('button', { name: 'Verwalten' }).click();
  await choose(page, 'Person', 'Lena');
  await page.locator('.participants-editor').getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.locator('.participants-editor')).toContainText('Lena');
  await page.getByRole('button', { name: 'Lena entfernen' }).click();
  await expect(page.locator('.participants-editor .row', { hasText: 'Lena' })).toHaveCount(0);
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
