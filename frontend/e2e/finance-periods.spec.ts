import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pickDate } from './helpers';

/** Finanzen › Übersicht: Zeitraum-Umschalter Heute · Woche · Monat · Benutzerdefiniert (Demo-Daten). */
for (const width of [390, 1440]) {
  test(`overview period views ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('http://localhost:8000/api/**', (r) => r.abort());
    await page.goto('/demo/finanzen');
    const switcher = page.getByRole('group', { name: 'Zeitraum der Übersicht' });
    // Standard: Monat — mit der Monatsauswahl unter dem Umschalter
    await expect(switcher.getByRole('button', { name: 'Monat' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#finance-month')).toBeVisible();

    // Heute: Summen, Buchungen, und der Monat bleibt im Blick — aber kein „Tagesbudget“
    await switcher.getByRole('button', { name: 'Tag', exact: true }).click();
    await expect(page.locator('#finance-month')).toHaveCount(0);
    const view = page.locator('app-finance-period');
    // Die Datumsauswahl steht unter dem Zeitraum-Umschalter, für jeden Zeitraum an derselben Stelle.
    const nav = page.locator('.date-row');
    const switchBox = (await switcher.boundingBox())!;
    expect((await nav.boundingBox())!.y).toBeGreaterThan(switchBox.y + switchBox.height - 1);
    // dieselben Begriffe wie im Monat — nur der Zeitraum darunter ändert sich
    await expect(view.locator('.kpi__label')).toHaveText(['Einnahmen', 'Ausgaben', 'Gespart']);
    await expect(view.locator('.kpi').nth(1)).toContainText('34,80 €');
    await expect(view.locator('.kpi').nth(1)).toContainText('heute');
    await expect(view.locator('.list-title')).toHaveText('Transaktionen heute');
    await expect(view.locator('.rows')).toContainText('REWE');
    await expect(view.locator('.rows')).toContainText('Bäckerei');
    await expect(view.locator('.month')).toContainText('Vom Monatsbudget übrig');
    await expect(view).not.toContainText(/Tagesbudget/i);
    await new AxeBuilder({ page }).include('app-finance-period').withTags(['wcag2a', 'wcag2aa']).analyze().then((r) => expect(r.violations).toEqual([]));

    // Ein Tag ohne Bewegungen: ein Satz statt leerer 0-€-Karten, und der Weg zu den Ausgaben
    await nav.getByRole('button', { name: 'Nächster Tag' }).click();
    await expect(view.locator('.empty')).toContainText('gab es keine Finanzbewegungen');
    await expect(view.locator('.kpi')).toHaveCount(0);
    // „Aktueller Tag“ steht abseits des Weiter-Pfeils (kein versehentliches Antippen beim Blättern)
    const next = (await nav.getByRole('button', { name: 'Nächster Tag' }).boundingBox())!;
    const back = (await nav.getByRole('button', { name: 'Aktueller Tag', exact: true }).boundingBox())!;
    const apart = Math.max(back.x - (next.x + next.width), back.y - (next.y + next.height));
    expect(apart).toBeGreaterThanOrEqual(12);
    await nav.getByRole('button', { name: 'Aktueller Tag', exact: true }).click();
    await expect(view.locator('.kpi').nth(1)).toContainText('34,80 €');

    // Woche: Kalenderwoche, Summen, Top-Kategorien
    await switcher.getByRole('button', { name: 'Woche' }).click();
    await expect(nav.locator('.week-label')).toHaveText(/^\d{2}\.\d{2}\.\d{4} – \d{2}\.\d{2}\.\d{4}$/);
    await expect(page.locator('main')).not.toContainText(/KW \d+/);
    await expect(view.locator('.kpi__label')).toHaveText(['Einnahmen', 'Ausgaben', 'Gespart']);
    await expect(view.locator('.kpi').nth(1)).toContainText('diese Woche');
    await expect(view.locator('.list-title')).toContainText('Transaktionen');
    await expect(view.getByRole('heading', { name: 'Top-Ausgabenkategorien' })).toBeVisible();

    // Benutzerdefiniert: falscher Zeitraum wird erklärt, kein Restbudget
    await switcher.getByRole('button', { name: 'Benutzerdefiniert' }).click();
    await expect(view.locator('.note')).toContainText('kein Restbudget');
    await expect(view.locator('.kpi__label')).toHaveText(['Einnahmen', 'Ausgaben', 'Gespart']);
    await expect(view.locator('.kpi').nth(1)).toContainText(/\d{2}\.\d{2}\.\d{4} – \d{2}\.\d{2}\.\d{4}/);

    // Zurück zum Monat: Budgetansicht wie bisher — mit denselben Begriffen
    await switcher.getByRole('button', { name: 'Monat' }).click();
    await expect(page.locator('#finance-month')).toBeVisible();
    await expect(page.locator('.finance-page > .kpis')).toContainText('Vom Monatsbudget übrig');
    await expect(page.locator('.finance-page > .kpis .kpi__label')).toContainText(['Einnahmen', 'Ausgaben', 'Gespart']);
    await expect(page.locator('#tx-h')).toContainText('Transaktionen');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('the day view switches to the expenses tab from the empty state', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (r) => r.abort());
  await page.goto('/demo/finanzen');
  const view = page.locator('app-finance-period');
  // Die Datumsauswahl steht unter dem Zeitraum-Umschalter, für jeden Zeitraum an derselben Stelle.
  const nav = page.locator('.date-row');
  await page.getByRole('group', { name: 'Zeitraum der Übersicht' }).getByRole('button', { name: 'Tag', exact: true }).click();
  await nav.getByRole('button', { name: 'Nächster Tag' }).click();
  await view.getByRole('button', { name: /Zu den Ausgaben/ }).click();
  await expect(page.locator('nav.tabs [aria-current]')).toContainText('Transaktionen');
  await expect(page.locator('.tx-switch [aria-pressed="true"]')).toHaveText('Ausgaben');
  await expect(page.getByRole('button', { name: 'Transaktion erfassen', exact: true })).toBeVisible();
});

test('another day never says "Heute": labels carry the date, and the month in view is named', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (r) => r.abort());
  await page.goto('/demo/finanzen');
  await page.getByRole('group', { name: 'Zeitraum der Übersicht' }).getByRole('button', { name: 'Tag', exact: true }).click();
  const view = page.locator('app-finance-period');
  // Die Datumsauswahl steht unter dem Zeitraum-Umschalter, für jeden Zeitraum an derselben Stelle.
  const nav = page.locator('.date-row');
  await expect(view.locator('.kpi').nth(1)).toContainText('heute');

  // einen Tag zurück — die Zahlen gehören zum gewählten Tag, nicht zu heute
  await nav.getByRole('button', { name: 'Vorheriger Tag' }).click();
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const label = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  const content = view.locator('.kpis, .empty');
  await expect(content.first()).toBeVisible();
  await expect(view.locator('.kpi__hint').first()).not.toHaveText('heute');
  if (await view.locator('.kpi').count()) {
    await expect(view.locator('.kpi').nth(1)).toContainText(`Ausgaben`);
    await expect(view.locator('.kpi').nth(1)).toContainText(`am ${label}`);
    await expect(view.locator('.list-title')).toHaveText(`Transaktionen am ${label}`);
  } else {
    await expect(view.locator('.empty')).toContainText(`Am ${label} gab es keine Finanzbewegungen.`);
  }

  // in den Vormonat: „Monat im Blick“ sagt nicht mehr „diesen Monat“
  const target = new Date();
  target.setDate(0); // letzter Tag des Vormonats
  const iso = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
  const steps = Math.round((new Date(new Date().toDateString()).getTime() - new Date(target.toDateString()).getTime()) / 86_400_000) - 1;
  for (let i = 0; i < steps; i++) await nav.getByRole('button', { name: 'Vorheriger Tag' }).click();
  const monthName = target.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  await expect(page.locator('#finance-day')).toContainText(`${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`);
  await expect(view.locator('.month')).toContainText(`im ${monthName}`);
  await expect(view.locator('.month')).not.toContainText('diesen Monat');
});


test('custom period: Bis before Von is refused, the future shows only booked items, and only a whole month has a budget', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (r) => r.abort());
  await page.goto('/demo/finanzen');
  await page.getByRole('group', { name: 'Zeitraum der Übersicht' }).getByRole('button', { name: 'Benutzerdefiniert' }).click();
  const view = page.locator('app-finance-period');
  // Die Datumsauswahl steht unter dem Zeitraum-Umschalter, für jeden Zeitraum an derselben Stelle.
  const nav = page.locator('.date-row');
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Bis vor Von: klare Meldung direkt unter dem Feld, mit dem Feld verknüpft; statt Zahlen ein Hinweis mit Ausweg
  const error = page.locator('#finance-range-error');
  await pickDate(page, page.locator('#finance-to'), iso(new Date(first.getFullYear(), first.getMonth() - 1, 15)));
  await expect(error).toHaveText('Das Enddatum liegt vor dem Startdatum.');
  await expect(error).toHaveAttribute('role', 'alert');
  await expect(nav.locator('.is-invalid')).toHaveCount(1);
  await expect(page.locator('#finance-to')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#finance-to')).toHaveAttribute('aria-describedby', 'finance-range-error');
  const errorBox = await error.boundingBox();
  const navBox = await nav.boundingBox();
  expect(errorBox!.y).toBeGreaterThanOrEqual(navBox!.y + navBox!.height - 1);
  expect(errorBox!.y - (navBox!.y + navBox!.height)).toBeLessThan(40);
  await expect(view.locator('.kpi')).toHaveCount(0);
  await expect(view.locator('.range-empty')).toContainText('Für diesen Zeitraum kann nichts angezeigt werden');
  // „Daten tauschen“ stellt den Zeitraum richtig
  await view.getByRole('button', { name: 'Daten tauschen' }).click();
  await expect(error).toHaveCount(0);
  await expect(view.locator('.kpi')).toHaveCount(3);
  await pickDate(page, page.locator('#finance-from'), iso(first));

  // genau der laufende Monat: echtes Restbudget dieses Monats, und Hinweis auf die Zukunft (bis Monatsende)
  await pickDate(page, page.locator('#finance-to'), iso(last));
  await expect(error).toHaveCount(0);
  if (iso(last) > iso(now)) await expect(view.locator('.note--info')).toContainText('nur Buchungen, die bereits erfasst sind');
  await expect(view.locator('.month')).toContainText('Vom Monatsbudget übrig');

  // ein Zeitraum, der kein ganzer Monat ist: kein Restbudget
  await pickDate(page, page.locator('#finance-from'), iso(new Date(first.getFullYear(), first.getMonth(), 2)));
  await expect(view.locator('.month')).toHaveCount(0);
  await expect(view.locator('.note').last()).toContainText('kein Restbudget');

  // nur in der Zukunft: erlaubt, aber ohne erfundene Buchungen
  await pickDate(page, page.locator('#finance-to'), iso(new Date(now.getFullYear() + 1, 1, 10)));
  await pickDate(page, page.locator('#finance-from'), iso(new Date(now.getFullYear() + 1, 1, 1)));
  await expect(error).toHaveCount(0);
  await expect(view.locator('.empty')).toContainText('keine Finanzbewegungen');
});

test('the jump-back button follows the period: current day, week or month', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/finanzen');
  const switcher = page.getByRole('group', { name: 'Zeitraum der Übersicht' });
  const nav = page.locator('.date-row');
  const jump = nav.locator('.to-today');
  for (const [period, step, label] of [
    ['Tag', 'Nächster Tag', 'Aktueller Tag'],
    ['Woche', 'Nächste Woche', 'Aktuelle Woche'],
    ['Monat', 'Nächster Monat', 'Aktueller Monat'],
  ]) {
    await switcher.getByRole('button', { name: period, exact: true }).click();
    await expect(jump).toHaveCount(0); // im aktuellen Zeitraum kein Knopf
    await nav.getByRole('button', { name: step }).click();
    await expect(jump).toHaveText(label);
    await jump.click();
    await expect(jump).toHaveCount(0);
  }
  // Auch in den anderen Reitern: Monat zurück auf den aktuellen
  await page.getByRole('button', { name: 'Budgets', exact: true }).click();
  await nav.getByRole('button', { name: 'Vorheriger Monat' }).click();
  await expect(jump).toHaveText('Aktueller Monat');
  await jump.click();
  await expect(jump).toHaveCount(0);
});

test('day, week and month share one date: zooming keeps you where you are', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/finanzen');
  const switcher = page.getByRole('group', { name: 'Zeitraum der Übersicht' });
  const nav = page.locator('.date-row');
  // Zwei Monate weiter, dann in die Woche: sie liegt im gewählten Monat (am 1.), nicht in der aktuellen Woche
  await nav.getByRole('button', { name: 'Nächster Monat' }).click();
  await nav.getByRole('button', { name: 'Nächster Monat' }).click();
  const target = await page.evaluate(() => {
    const d = new Date();
    const m = new Date(d.getFullYear(), d.getMonth() + 2, 1);
    return { day: `01.${String(m.getMonth() + 1).padStart(2, '0')}.${m.getFullYear()}`, month: m.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) };
  });
  await switcher.getByRole('button', { name: 'Woche', exact: true }).click();
  await expect(nav.locator('.week-label')).toContainText(target.day.slice(3)); // Monat und Jahr des 1.
  await expect(nav.locator('.to-today')).toHaveText('Aktuelle Woche');
  // Woche weiter blättern und zurück in den Monat: der Monat folgt der Woche
  await switcher.getByRole('button', { name: 'Tag', exact: true }).click();
  await expect(page.locator('#finance-day')).toContainText(target.day);
  await switcher.getByRole('button', { name: 'Monat', exact: true }).click();
  await expect(page.locator('#finance-month')).toContainText(target.month);
  await nav.locator('.to-today').click();
  await switcher.getByRole('button', { name: 'Tag', exact: true }).click();
  await expect(nav.locator('.to-today')).toHaveCount(0); // aktueller Monat → heute
});
