import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Verknüpfungen sichtbar (31.10.2026): Reise › „Gehört zu dieser Reise“ und kleine Hinweise in den anderen Bereichen.
// In der Demo mit festem Beispielbestand (shared/connections/demo-connections-api.ts) — ohne Backend.

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
});

test('Reise zeigt, was dazugehört; ein angenommener Vorschlag erscheint danach auch in der Organisation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/demo/reisen?trip=1');
  const card = page.locator('app-trip-overview app-connections');
  await expect(card.getByRole('heading', { name: 'Gehört zu dieser Reise' })).toBeVisible();
  await expect(card.locator('li.connection .connection__title')).toHaveText(['Museumsinsel-Führung', 'Pflanzen gießen']);
  // Links bleiben in der Demo (nicht zur Anmeldung)
  await expect(card.locator('a.connection__link').first()).toHaveAttribute('href', /^\/demo\/organisation/);

  // Vorschlag mit Begründung; erst die Person entscheidet
  await expect(card).toContainText('Bahn-Tickets ausdrucken');
  await expect(card).toContainText('kurz vor deiner Reise fällig');
  await card.getByRole('button', { name: 'Mit „Bahn-Tickets ausdrucken“ verknüpfen' }).click();
  await expect(card.locator('li.connection .connection__title')).toHaveText(['Museumsinsel-Führung', 'Pflanzen gießen', 'Bahn-Tickets ausdrucken']);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  expect((await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

  // Ohne Neuladen in die Organisation: die Aufgabe trägt jetzt den Hinweis auf die Reise
  await page.getByRole('link', { name: 'Organisation' }).first().click();
  await page.locator('#org-tab-tasks').click();
  const row = page.locator('.task', { hasText: 'Bahn-Tickets ausdrucken' });
  await expect(row.locator('app-link-hints')).toContainText('Berlin Wochenende');
});

test('Hinweise in Haushalt und Finanzen: wohin ein Eintrag gehört', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo/haushalt');
  await expect(page.locator('.task', { hasText: 'Pflanzen gießen' }).locator('app-link-hints')).toContainText('Berlin Wochenende');
  await page.goto('/demo/finanzen?tab=goals');
  await expect(page.locator('.goal', { hasText: 'Badmintonschuhe' }).locator('app-link-hints')).toContainText('Badmintonschuhe vergleichen');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
