import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Haushalt › Aufgaben im selben Aufbau wie Organisation: Ansichten, Suche, ruhige Liste.
// Läuft gegen die Demo (keine Backend-Aufrufe).

for (const width of [390, 820, 1280, 1440]) {
  test(`tasks tab is accessible and fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('http://localhost:8000/api/**', (route) => route.abort());
    await page.goto('/demo/haushalt?tab=aufgaben');

    await expect(page.getByLabel('Aufgaben durchsuchen')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Aufgaben anzeigen' }).getByRole('button')).toHaveText([
      /Alle/, /Heute/, /Überfällig/, /Wiederkehrend/, /Erledigt/,
    ]);
    await expect(page.locator('app-aufgaben-tab .task').first()).toContainText('Pflanzen gießen');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Keine Zeile ragt aus der Liste heraus
    expect(await page.locator('app-aufgaben-tab .list').evaluate((l) => l.scrollWidth <= l.clientWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include('app-aufgaben-tab').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/haushalt-aufgaben-${width}.png`, fullPage: true });
  });
}

test('search finds tasks by title, room and person; done shows its count', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/haushalt?tab=aufgaben');
  const search = page.getByLabel('Aufgaben durchsuchen');
  await search.fill('Küche'); // Raum Küche und Waschküche
  await expect(page.locator('app-aufgaben-tab .task__title')).toHaveText(['Küche sauber halten', 'Wäsche waschen', 'Kühlschrank reinigen']);
  await search.fill('nichts passt');
  await expect(page.getByText('Keine Aufgabe passt zu „nichts passt“.')).toBeVisible();
  await search.fill('');
  await page.getByRole('button', { name: 'Winterreifen-Termin vereinbaren als erledigt markieren' }).click();
  const done = page.getByRole('group', { name: 'Aufgaben anzeigen' }).getByRole('button').filter({ hasText: 'Erledigt' });
  await expect(done).toHaveText(/Erledigt\s*1/);
  await done.click();
  await page.getByRole('button', { name: 'Winterreifen-Termin vereinbaren wieder öffnen' }).click();
  await expect(done).not.toHaveText(/\d/);
});

test('each tasks tab says who sees the tasks and links to the other area', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/haushalt?tab=aufgaben');
  await expect(page.locator('app-aufgaben-tab app-scope-note')).toContainText('alle im Haushalt sehen');
  await page.getByRole('link', { name: 'Organisation → Aufgaben' }).click();
  await expect(page).toHaveURL(/\/demo\/organisation\?tab=tasks/);
  await expect(page.locator('app-org-tasks app-scope-note')).toContainText('nur für dich sichtbar');
  await page.getByRole('link', { name: 'Haushalt → Aufgaben' }).click();
  await expect(page).toHaveURL(/\/demo\/haushalt\?tab=aufgaben/);
});
