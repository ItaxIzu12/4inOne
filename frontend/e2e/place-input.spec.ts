import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Ort-Feld mit Vorschlägen (01.11.2026, Demo: Beispielorte ohne externen Dienst). Datenschutz und Photon-Anbindung
// prüft das Backend: backend/core/test_places.py.

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
});

for (const width of [390, 1440]) {
  test(`event location suggests own places and addresses, free text still works (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/demo/organisation?tab=calendar');
    await page.getByRole('button', { name: 'Termin hinzufügen' }).first().click();
    const dialog = page.getByRole('dialog');
    const ort = dialog.getByRole('combobox', { name: /^Ort/ });

    // Fokus: zuletzt verwendete eigene Orte
    await ort.click();
    await expect(ort).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('group', { name: 'Deine Orte' }).getByRole('option').first()).toHaveText('Praxis Dr. Weber');

    // Ab 3 Zeichen: Orte, Auswahl per Tastatur übernimmt Name + Adresse
    await ort.fill('Alex');
    await expect(page.getByRole('option', { name: /Alexanderplatz/ })).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    await ort.press('ArrowDown');
    await expect(ort).toHaveAttribute('aria-activedescendant', /place-list-\d+-0/);
    await ort.press('Enter');
    await expect(ort).toHaveValue('Alexanderplatz, 10178 Berlin');
    await expect(dialog).toBeVisible(); // Enter hat den Vorschlag übernommen, nicht das Formular abgeschickt

    // Escape schließt nur die Liste, nicht den Dialog
    await ort.fill('Pra');
    await expect(ort).toHaveAttribute('aria-expanded', 'true');
    await ort.press('Escape');
    await expect(ort).toHaveAttribute('aria-expanded', 'false');
    await page.waitForTimeout(500); // auch eine nachlaufende Suche öffnet sie nicht wieder
    await expect(ort).toHaveAttribute('aria-expanded', 'false');
    await expect(dialog).toBeVisible();

    // Freitext bleibt erlaubt
    await ort.fill('bei Oma');
    await dialog.locator('#entry-title').fill('Kaffee bei Oma');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toHaveCount(0);
  });
}

// Ortsvorschläge in Reisen sind vorerst ausgeschaltet (Nutzerwunsch 13.11.2026) – die Tests kommen mit der Funktion zurück
test.skip('trip destination takes only the place name', async ({ page }) => {
  await page.goto('/demo/reisen');
  await page.getByRole('button', { name: /Reise erstellen|Neue Reise/ }).first().click();
  const ziel = page.getByRole('dialog').getByRole('combobox', { name: /Reiseziel/ });
  await ziel.fill('Zerm');
  await page.getByRole('option', { name: /Zermatt/ }).click();
  await expect(ziel).toHaveValue('Zermatt');
});

test.skip('accommodation searches lodgings near the destination and fills in the area', async ({ page }) => {
  await page.goto('/demo/reisen');
  await page.getByRole('button', { name: /Reise erstellen|Neue Reise/ }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: /Reiseziel/ }).fill('Berlin');
  await dialog.locator('#trip-title').click();
  await dialog.getByRole('button', { name: /Weitere Angaben/ }).click();
  const unterkunft = dialog.getByRole('combobox', { name: /Unterkunft/ });
  await unterkunft.click();
  await expect(page.getByRole('group', { name: 'Deine Unterkünfte' })).toContainText('Hotel Central');
  await unterkunft.fill('Pens');
  await page.getByRole('group', { name: 'Unterkünfte' }).getByRole('option', { name: /Pension Kreuzberg/ }).click();
  await expect(unterkunft).toHaveValue('Pension Kreuzberg');
  await expect(dialog.locator('#trip-accommodation-area')).toHaveValue('Berlin Kreuzberg');

  // Eine schon eingetragene Lage wird nicht überschrieben
  await dialog.locator('#trip-accommodation-area').fill('Nähe Bahnhof');
  await unterkunft.fill('Hotel am');
  await page.getByRole('option', { name: /Hotel am Alexanderplatz/ }).click();
  await expect(dialog.locator('#trip-accommodation-area')).toHaveValue('Nähe Bahnhof');
});
