import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Personen & Gruppen (01.11.2026): alle geteilten Bereiche einer Person aufklappbar, und in der Demo derselbe Stand wie
// unter Reisen › Personen (Entfernen und Einladen wirken in beiden Richtungen). Im echten System prüft das
// backend/reisen/tests.py::test_removing_a_participant_takes_away_access_and_personen_und_gruppen_updates.

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
});

/** Innerhalb der Demo navigieren, ohne neu zu laden (ein Neuladen setzt die Beispieldaten zurück). */
async function go(page: import('@playwright/test').Page, url: string) {
  await page.evaluate((u) => {
    history.pushState({}, '', u);
    dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, url);
}

test('all shared areas of a person can be expanded instead of a bare "+2"', async ({ page }) => {
  await page.goto('/demo/familie');
  const max = page.locator('.people-row', { hasText: 'Max' });
  await expect(max).not.toContainText('Kalender: Familie');
  const more = max.getByRole('button', { name: '+2 weitere mit Max' });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(max).toContainText('Kalender: Familie');
  await expect(max).toContainText('Kalenderfreigabe: Dein Kalender');
  await expect(max.getByRole('button', { name: 'Weniger mit Max' })).toHaveAttribute('aria-expanded', 'true');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
});

test('removing someone from a trip and inviting from Personen & Gruppen stay in sync', async ({ page }) => {
  await page.goto('/demo/familie');
  const lena = page.locator('.people-row', { hasText: 'Lena' });
  await expect(lena).toContainText('Reise: Italien Sommerurlaub');

  // Reisen › Italien › Personen: Lena entfernen
  await go(page, '/demo/reisen?trip=2&tab=planung');
  await page.getByRole('button', { name: 'Verwalten' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lena entfernen' }).click();
  await expect(page.getByRole('dialog')).not.toContainText('Lena');
  await page.keyboard.press('Escape');

  await go(page, '/demo/familie');
  await expect(lena).not.toContainText('Italien Sommerurlaub');

  // Personen & Gruppen: Lena zu Berlin einladen, Annahme simulieren → bei Reisen dabei
  await page.getByRole('button', { name: 'Mit Lena teilen' }).click();
  await page.getByRole('button', { name: 'Berlin Wochenende' }).click();
  await expect(lena).toContainText('Eingeladen · Berlin Wochenende');
  await lena.getByRole('button', { name: /Demo: annehmen lassen.*Berlin Wochenende/ }).click();
  await expect(lena).toContainText('Reise: Berlin Wochenende');

  await go(page, '/demo/reisen?trip=1&tab=planung');
  await expect(page.locator('app-trip-planning .people__name')).toHaveText(['Sophie (Du)', 'Max', 'Lena']);
});

test('calendar shares and shared calendars stay in sync with Personen & Gruppen', async ({ page }) => {
  await page.goto('/demo/familie');
  const max = page.locator('.people-row', { hasText: 'Max' });
  await max.getByRole('button', { name: /weitere mit Max/ }).click();
  await expect(max).toContainText('Kalender: Familie');
  await expect(max).toContainText('Kalenderfreigabe: Dein Kalender');

  // Organisation › Kalender teilen: Freigabe für Max beenden und ihn aus „Familie“ entfernen
  await go(page, '/demo/organisation?tab=calendar');
  await page.getByRole('button', { name: 'Kalender teilen' }).click();
  const manage = page.getByRole('dialog');
  await manage.getByRole('button', { name: 'Freigabe für Max beenden' }).click();
  await manage.getByRole('button', { name: 'Max entfernen' }).click();
  await expect(manage.getByRole('status')).toContainText('Max sieht „Familie“ ab sofort nicht mehr');
  await page.keyboard.press('Escape');

  await go(page, '/demo/familie');
  await expect(max).not.toContainText('Kalender: Familie');
  await expect(max).not.toContainText('Dein Kalender');

  // Personen & Gruppen: Lena zu „Familie“ einladen und annehmen lassen → in Organisation Mitglied
  const lena = page.locator('.people-row', { hasText: 'Lena' });
  await page.getByRole('button', { name: 'Mit Lena teilen' }).click();
  await page.getByRole('button', { name: 'Familie', exact: true }).click();
  await lena.getByRole('button', { name: /Demo: annehmen lassen.*Familie/ }).click();
  await expect(lena).toContainText('Kalender: Familie');
  await go(page, '/demo/organisation?tab=calendar');
  await page.getByRole('button', { name: 'Kalender teilen' }).click();
  await expect(page.getByRole('dialog').getByRole('list', { name: 'Mitglieder von Familie' })).toContainText('Lena');
});
