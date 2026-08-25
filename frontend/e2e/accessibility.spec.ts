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
    // reduced motion: verifiziert nebenbei, dass die bestehende
    // prefers-reduced-motion-Variante (styles.css, dashboard.css, login.css)
    // greift — UND verhindert, dass axe-core auf Seiten mit der endlos
    // laufenden Aurora-Verlaufsanimation (Budget-Hero, Login-Markenseite)
    // durch die ständigen Repaints massiv verlangsamt wird (beobachtet:
    // ~90s statt ~7s pro Scan ohne reduced motion).
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // Das Dashboard bleibt selbst mit reduced motion spürbar langsamer als
    // alle anderen Seiten (~30s statt ~15s) — vermutlich der sticky Header
    // mit backdrop-filter über der großen Verlaufsfläche. Kein WCAG-Fehler,
    // aber ein Performance-Kandidat für ein separates Profiling; hier
    // bewusst nur mehr Zeit geben statt den Test daran scheitern zu lassen.
    if (name === 'Dashboard') {
      test.setTimeout(60_000);
    }

    await page.goto(path);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
