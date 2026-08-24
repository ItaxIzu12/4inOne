import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Automatisierter Accessibility-Check (axe-core) für Dashboard und
 * Login/Registrieren, siehe Aufgabenstellung Teil 3. Prüft gegen die
 * WCAG-2.1-A/AA-Regelsätze von axe-core, wie in ARCHITEKTUR.md §6 gefordert.
 *
 * Automatisierte Tools finden erfahrungsgemäß nur einen Teil der WCAG-
 * Probleme (siehe ARCHITEKTUR.md §3.8) — das ersetzt keinen manuellen
 * Screenreader-/Tastatur-Test vor dem Launch, ergänzt ihn aber sinnvoll.
 */

const PAGES = [
  { path: '/', name: 'Dashboard' },
  { path: '/login', name: 'Login' },
  { path: '/registrieren', name: 'Registrieren' },
  { path: '/passwort-vergessen', name: 'Passwort vergessen' },
  { path: '/einstellungen', name: 'Einstellungen' },
  { path: '/impressum', name: 'Impressum' },
  { path: '/datenschutz', name: 'Datenschutz' },
  { path: '/nutzungsbedingungen', name: 'Nutzungsbedingungen' },
  { path: '/barrierefreiheit', name: 'Barrierefreiheit' },
];

for (const { path, name } of PAGES) {
  test(`${name} (${path}) hat keine automatisiert erkennbaren WCAG-2.1-A/AA-Verstöße`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
