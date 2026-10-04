import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Haushalt › Routinen, Verträge, Einkaufslisten nach Entwurf. Läuft gegen die Demo (keine Backend-Aufrufe).

const TABS = [
  { key: 'routinen', component: 'app-routinen-tab', ready: 'Tägliche Routinen' },
  { key: 'ordner', component: 'app-ordner-tab', ready: 'Meine Verträge' },
  { key: 'einkauf', component: 'app-einkauf-tab', ready: 'Wocheneinkauf' },
];

for (const width of [390, 820, 1280, 1440]) {
  for (const tab of TABS) {
    test(`${tab.key} is accessible and fits at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('http://localhost:8000/api/**', (route) => route.abort());
      await page.goto(`/demo/haushalt?tab=${tab.key}`);
      await expect(page.locator(tab.component).getByText(tab.ready).first()).toBeAttached();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const result = await new AxeBuilder({ page }).include(tab.component).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(result.violations).toEqual([]);
      await page.screenshot({ path: `test-results/haushalt-${tab.key}-${width}.png`, fullPage: true });
    });
  }
}

test('routines: pausing via the switch and filtering paused ones', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/haushalt?tab=routinen');
  const toggle = page.getByRole('switch', { name: 'Küche sauber halten aktiv' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: /^Pausiert \(3\)/ }).click();
  await expect(page.locator('app-routinen-tab .title-text')).toHaveCount(3);
  // Menü: erledigen ist für pausierte Routinen gesperrt
  await page.getByRole('button', { name: 'Aktionen für Küche sauber halten' }).click();
  await expect(page.getByRole('menuitem', { name: /erledigt/i })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
});

test('shopping lists: switch list, add an item, create a list', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/haushalt?tab=einkauf');
  await page.locator('.list-card__main', { hasText: 'Drogerie' }).click();
  await expect(page.locator('#shopping-heading')).toHaveText('Drogerie');
  await page.getByPlaceholder('Artikel zur Liste hinzufügen …').fill('Zahnseide');
  await page.keyboard.press('Enter');
  await expect(page.locator('app-einkauf-tab .item__name', { hasText: 'Zahnseide' })).toBeVisible();
  await expect(page.locator('.list-card.is-active')).toContainText('3 von 10');

  await page.locator('.page-head__action').click();
  await page.locator('#list-name').fill('Baby');
  await page.getByRole('radio', { name: 'Party' }).click();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('#shopping-heading')).toHaveText('Baby');
  await expect(page.locator('.list-card b')).toHaveCount(6);
});

test('contracts: selecting a contract shows deadline details, mobile as a sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/haushalt?tab=ordner');
  await page.locator('.row__main', { hasText: 'Internet & Telefon' }).click();
  await expect(page.locator('#contract-detail-heading')).toHaveText('Internet & Telefon');
  await expect(page.locator('#contract-panel')).toContainText('3 Monate');
  await page.getByRole('tab', { name: 'Notizen' }).click();
  await page.getByRole('button', { name: 'Details schließen' }).click();
  await expect(page.locator('.detail')).toBeHidden();
  // Nur Verträge, kein Umschalter zu Geräten
  await expect(page.getByRole('button', { name: /^Geräte/ })).toHaveCount(0);
});

test('overview shows contracts instead of devices', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/haushalt');
  await expect(page.getByRole('heading', { name: 'Verträge' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Geräte-Status' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Alle Verträge' }).click();
  await expect(page.locator('#hh-tab-ordner')).toHaveAttribute('aria-selected', 'true');
});
