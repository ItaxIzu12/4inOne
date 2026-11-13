import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Gemeinsame Kalender und Kalenderfreigabe (31.10.2026) in der Demo: filtern, Termin in „Familie“ eintragen bzw. mit
// einer Person teilen, Personen einladen und freigeben.
// Die Rechte prüft das Backend (backend/organisation/test_shared_calendars.py, test_calendar_shares.py); hier geht es um die Bedienung.

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
});

for (const width of [390, 1440]) {
  test(`shared calendar: filter, add an event for the family, invite someone (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/demo/organisation?tab=calendar');
    const filter = page.getByRole('group', { name: 'Welche Kalender anzeigen' });
    await expect(filter.getByRole('button')).toHaveText(['Alle', 'Nur meine', 'Familie', /Kalender von Lena\s*$/, 'Kalender teilen']);

    // Wochenansicht: gemeinsame Termine (in der Demo in 2 und 6 Tagen) tragen ihre Marke — bei Bedarf eine Woche weiter
    await page.getByRole('button', { name: 'Woche', exact: true }).click();
    const agenda = page.locator('app-org-calendar .agenda');
    // Erst zählen, wenn die Wochenagenda steht (vorher zeigt die Liste noch den ganzen Monat)
    await expect(page.locator('#agenda-h')).toContainText(/Woche|Termine \d/);
    if (!(await agenda.locator('.cal-tag').count())) await page.getByRole('button', { name: 'Nächste Woche' }).click();
    await expect(agenda.locator('.cal-tag').first()).toContainText('Familie');
    await expect(agenda).toContainText('von Max');
    await filter.getByRole('button', { name: 'Nur meine' }).click();
    // keine Marke eines geteilten Kalenders – eigene Einträge aus anderen Bereichen („Reise · …“, grau) dürfen bleiben
    await expect(agenda.locator('.cal-tag:not([data-color="slate"])')).toHaveCount(0);
    await filter.getByRole('button', { name: 'Familie' }).click();
    await expect(agenda.locator('.cal-tag').first()).toBeVisible();
    await expect(agenda.locator('.agenda__row:not(:has(.cal-tag))')).toHaveCount(0); // nur Familie

    // Im gefilterten Kalender ist „Familie“ beim neuen Termin vorgewählt, mit Hinweis, wer ihn sieht
    await page.getByRole('button', { name: 'Termin hinzufügen' }).first().click();
    const dialog = page.getByRole('dialog');
    const where = dialog.getByRole('group', { name: 'Wer sieht den Termin?' });
    await expect(where.getByRole('button', { name: 'Familie' })).toHaveAttribute('aria-pressed', 'true');
    // ohne Erklärtext unter den Chips – die gedrückte Auswahl sagt, wer den Termin sieht
    await expect(dialog).not.toContainText('sieht diesen Termin');
    await where.getByRole('button', { name: 'Nur ich' }).click();
    await expect(where.getByRole('button', { name: 'Nur ich' })).toHaveAttribute('aria-pressed', 'true');
    await expect(where.getByRole('button', { name: 'Familie' })).toHaveAttribute('aria-pressed', 'false');
    await where.getByRole('button', { name: 'Familie' }).click();
    await dialog.locator('#entry-title').fill('Kino mit allen');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(agenda.locator('.agenda__row', { hasText: 'Kino mit allen' }).locator('.cal-tag')).toHaveText('Familie');

    // Verwalten: Lena einladen (nur aus „Dein Kreis“), sie steht danach als „Eingeladen“ da
    await filter.getByRole('button', { name: 'Kalender teilen' }).click();
    const manage = page.getByRole('dialog');
    await expect(manage).toContainText('Private Termine sieht niemand');
    await manage.getByRole('button', { name: 'Person einladen' }).click();
    await manage.getByRole('group', { name: 'Wen einladen?' }).getByRole('button', { name: 'Lena' }).click();
    await manage.getByRole('group', { name: 'Darf die Person …' }).getByRole('button', { name: 'nur ansehen' }).click();
    await manage.getByRole('button', { name: 'Einladung senden' }).click();
    await expect(manage.getByRole('status')).toContainText('Lena ist eingeladen');
    await expect(manage.locator('.is-pending')).toContainText('Eingeladen · Kann ansehen');
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('a new shared calendar can be created and appears as a filter', async ({ page }) => {
  await page.goto('/demo/organisation?tab=calendar');
  await page.getByRole('button', { name: 'Kalender teilen' }).click();
  const manage = page.getByRole('dialog');
  await manage.getByLabel('Name').fill('WG');
  await manage.getByRole('group', { name: 'Farbe' }).getByRole('button', { name: 'Violett' }).click();
  await manage.getByRole('button', { name: 'Kalender anlegen' }).click();
  await expect(manage.getByRole('status')).toContainText('„WG“ ist angelegt');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: 'Welche Kalender anzeigen' }).getByRole('button', { name: 'WG' })).toBeVisible();
});

test('calendar sharing like Outlook: private by default, share one event, see someone else\'s calendar', async ({ page }) => {
  await page.goto('/demo/organisation?tab=calendar');
  const filter = page.getByRole('group', { name: 'Welche Kalender anzeigen' });

  // Neu ist privat; mit Max (Kalender für ihn freigegeben) teilen
  await page.getByRole('button', { name: 'Termin hinzufügen' }).first().click();
  const dialog = page.getByRole('dialog');
  const who = dialog.getByRole('group', { name: 'Wer sieht den Termin?' });
  await expect(who.getByRole('button', { name: 'Nur ich' })).toHaveAttribute('aria-pressed', 'true');
  await who.getByRole('button', { name: 'Max' }).click();
  await expect(who.getByRole('button', { name: 'Nur ich' })).toHaveAttribute('aria-pressed', 'false');
  await expect(who.getByRole('button', { name: 'Max' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.locator('#entry-title').fill('Kino mit Max');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toHaveCount(0);

  // Lenas Kalender: nur ihre geteilten Termine, nur ansehen
  await page.getByRole('button', { name: 'Woche', exact: true }).click();
  await filter.getByRole('button', { name: 'Kalender von Lena' }).click();
  await expect(filter.getByRole('button', { name: 'Kalender von Lena' })).toHaveAttribute('aria-pressed', 'true');
  const agenda = page.locator('app-org-calendar .agenda');
  // Lenas Termin liegt in der Demo in 4 Tagen — je nach Wochentag in dieser oder der nächsten Woche
  if (!(await agenda.getByText('Lenas Umzug').count())) await page.getByRole('button', { name: 'Nächste Woche' }).click();
  await expect(agenda.locator('.agenda__row')).toHaveCount(1);
  await agenda.locator('.agenda__row', { hasText: 'Lenas Umzug' }).click();
  await expect(page.getByRole('dialog')).toContainText('Lena hat diesen Termin mit dir geteilt');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Speichern' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Verwalten: Lena freigeben (Einladung), Freigabe für Max beenden
  await filter.getByRole('button', { name: 'Kalender teilen' }).click();
  const manage = page.getByRole('dialog');
  await manage.getByRole('button', { name: 'Person freigeben' }).click();
  await manage.getByRole('group', { name: 'Für wen freigeben?' }).getByRole('button', { name: 'Lena' }).click();
  await manage.getByRole('button', { name: 'Einladung senden' }).click();
  await expect(manage.getByRole('status')).toContainText('Lena ist eingeladen');
  await manage.getByRole('button', { name: 'Freigabe für Max beenden' }).click();
  await expect(manage.getByRole('status')).toContainText('Max sieht deinen Kalender ab sofort nicht mehr');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
});
