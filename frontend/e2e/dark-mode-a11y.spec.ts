import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Dunkelmodus (22.11.2026): dieselbe WCAG-Prüfung wie im hellen Modus (axe-core, WCAG 2.0–2.2 A/AA, inkl. Farbkontrast)
 * auf allen Demo-Bereichen, den wichtigsten Dialogen sowie Anmelden/Registrieren – am Rechner und am Handy.
 * „Darstellung: Dunkel“ wird wie in den Einstellungen gesetzt (localStorage), Bewegung reduziert, damit axe nie eine
 * halb eingeblendete Seite misst.
 */
const PAGES = [
  '/demo',
  '/demo/finanzen',
  '/demo/finanzen?tab=transactions',
  '/demo/finanzen?tab=budgets',
  '/demo/finanzen?tab=goals',
  '/demo/haushalt',
  '/demo/haushalt?tab=aufgaben',
  '/demo/haushalt?tab=einkaufen',
  '/demo/haushalt?tab=zuhause',
  '/demo/organisation',
  '/demo/organisation?tab=calendar',
  '/demo/organisation?tab=tasks',
  '/demo/organisation?tab=notes',
  '/demo/reisen',
  '/demo/reisen?trip=1',
  '/demo/reisen?trip=1&tab=planung',
  '/demo/reisen?trip=1&tab=packliste',
  '/demo/reisen?trip=1&tab=budget',
  '/demo/familie',
  '/login',
  '/registrieren',
];

const DIALOGS: { path: string; open: (page: Page) => Promise<void>; name: string }[] = [
  { name: 'Transaktion', path: '/demo/finanzen?tab=transactions', open: (p) => p.getByRole('button', { name: /^Transaktion( erfassen)?$/ }).first().click() },
  { name: 'Aufgabe', path: '/demo/haushalt?tab=aufgaben', open: (p) => p.getByRole('button', { name: 'Aufgabe hinzufügen' }).first().click() },
  { name: 'Vertrag', path: '/demo/haushalt?tab=zuhause&bereich=vertraege', open: (p) => p.getByRole('button', { name: 'Vertrag hinzufügen' }).first().click() },
  { name: 'Kalender abonnieren', path: '/demo/organisation?tab=calendar', open: (p) => p.getByRole('button', { name: 'Kalender abonnieren' }).click() },
  { name: 'Reise bearbeiten', path: '/demo/reisen?trip=1', open: (p) => p.getByRole('button', { name: 'Bearbeiten' }).first().click() },
];

async function dark(page: Page) {
  await page.addInitScript(() => localStorage.setItem('4io-darstellung', 'dark'));
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.route('http://localhost:8000/api/**', (r) => r.abort());
}

async function axe(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const summary = results.violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 5).map((n) => `${n.target.join(' ')} – ${n.failureSummary?.split('\n')[1]?.trim()}`) }));
  expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
}

for (const width of [390, 1440]) {
  test.describe(`Dunkelmodus ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: 900 });
      await dark(page);
    });

    for (const path of PAGES) {
      test(`${path} ohne WCAG-Verstöße`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await axe(page);
      });
    }

    for (const d of DIALOGS) {
      test(`Dialog ${d.name} ohne WCAG-Verstöße`, async ({ page }) => {
        await page.goto(d.path);
        await page.waitForLoadState('networkidle');
        await d.open(page);
        await expect(page.getByRole('dialog').first()).toBeVisible();
        await axe(page);
      });
    }
  });
}
