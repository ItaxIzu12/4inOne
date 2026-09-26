import { expect, Locator, Page } from '@playwright/test';

/** Bedienung der eigenen Auswahlfelder (Dropdown, Monat, Datum, Uhrzeit) — sie ersetzen die Browserfelder. */

export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** Wählt einen Eintrag im Dropdown (Combobox) mit dem gegebenen Feldnamen. */
export async function choose(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

/** Wählt einen Monat („JJJJ-MM“) im Monatsauswähler; `trigger` ist das Feld, das ihn öffnet. */
export async function pickMonth(page: Page, trigger: Locator, ym: string) {
  await trigger.click();
  const [year, month] = ym.split('-').map(Number);
  const panel = page.locator('.dp__panel:has(.dp__title)');
  const title = panel.locator('.dp__title');
  let shown = Number((await title.innerText()).trim());
  while (shown !== year) {
    const next = shown < year ? shown + 1 : shown - 1;
    await panel.getByRole('button', { name: shown < year ? 'Nächstes Jahr' : 'Vorheriges Jahr' }).click();
    // erst weiterklicken, wenn das neue Jahr angezeigt wird (Angular rendert asynchron nach dem Klick)
    await expect(title).toHaveText(String(next));
    shown = next;
  }
  await panel.getByRole('button', { name: `${MONTHS[month - 1]} ${year}`, exact: true }).click();
}

/** Wählt ein Datum („JJJJ-MM-TT“) im Kalender. */
export async function pickDate(page: Page, trigger: Locator, iso: string) {
  await trigger.click();
  const [year, month] = iso.split('-').map(Number);
  const panel = page.locator('.dp__panel:has(.dp__title)');
  const title = panel.locator('.dp__title');
  const wanted = `${MONTHS[month - 1]} ${year}`;
  for (let i = 0; i < 240 && (await title.innerText()).trim() !== wanted; i++) {
    const [name, y] = (await title.innerText()).trim().split(' ');
    const shown = Number(y) * 12 + MONTHS.indexOf(name);
    const target = year * 12 + (month - 1);
    const before = (await title.innerText()).trim();
    await panel.getByRole('button', { name: shown < target ? 'Nächster Monat' : 'Vorheriger Monat' }).click();
    await expect(title).not.toHaveText(before);
  }
  await panel.locator(`.dp__cell[data-iso="${iso}"]`).click();
}

/** Wählt eine Uhrzeit („HH:MM“, Minute in 5er-Schritten). */
export async function pickTime(page: Page, trigger: Locator, hhmm: string) {
  await trigger.click();
  const [h, m] = hhmm.split(':').map(Number);
  const panel = page.locator('.tp__panel:has(.tp__grid)');
  await panel.getByRole('button', { name: `${h} Uhr`, exact: true }).click();
  await panel.getByRole('button', { name: `${m} Minuten`, exact: true }).click();
}
