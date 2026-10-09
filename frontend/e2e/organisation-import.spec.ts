import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Kalender-Import in der Demo: ICS wählen → Vorschau → importieren → Termin steht im Kalender.
function stamp(offsetDays: number, hhmm: string | null) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return hhmm ? `${day}T${hhmm.replace(':', '')}00` : day;
}
const ics = () =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
    'BEGIN:VEVENT',
    `DTSTART;TZID=Europe/Berlin:${stamp(1, '17:30')}`,
    `DTEND;TZID=Europe/Berlin:${stamp(1, '18:30')}`,
    'SUMMARY:Elternabend',
    'LOCATION:Grundschule\\, Raum 4',
    'END:VEVENT',
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${stamp(3, null)}`,
    `DTEND;VALUE=DATE:${stamp(5, null)}`,
    'SUMMARY:Kurzurlaub',
    'END:VEVENT',
    'BEGIN:VEVENT',
    `DTSTART;TZID=Europe/Berlin:${stamp(2, '19:00')}`,
    'DURATION:PT1H',
    'SUMMARY:Chorprobe',
    'RRULE:FREQ=WEEKLY',
    'END:VEVENT',
    'BEGIN:VEVENT',
    `DTSTART;TZID=Europe/Berlin:${stamp(2, '07:00')}`,
    'SUMMARY:Sprachkurs',
    'RRULE:FREQ=WEEKLY;COUNT=6',
    'END:VEVENT',
    'BEGIN:VEVENT',
    `DTSTART;TZID=Europe/Berlin:${stamp(4, '10:00')}`,
    'SUMMARY:Abgesagt',
    'STATUS:CANCELLED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

for (const width of [390, 1440]) {
  test(`calendar import with preview at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('http://localhost:8000/api/**', (route) => route.abort());
    await page.goto('/demo/organisation');
    await page.getByRole('button', { name: 'Kalender importieren' }).click();
    const dialog = page.getByRole('dialog');
    await page.locator('#import-ics').setInputFiles({ name: 'kalender.ics', mimeType: 'text/calendar', buffer: Buffer.from(ics()) });

    await expect(dialog.locator('.imp-summary')).toContainText('4 Termine neu');
    await expect(dialog.locator('.imp-rows')).toContainText('Grundschule, Raum 4');
    await expect(dialog.locator('.imp-rows')).toContainText('wöchentlich');
    await expect(dialog.locator('.imp-note')).toContainText('1 Termin hat eine Wiederholung, die 4inOne nicht abbildet');
    await expect(dialog.locator('.imp-note')).toContainText('1 abgesagte Termine');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

    await dialog.getByRole('button', { name: '4 importieren' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('4 Termine importiert.')).toBeVisible();
  });
}

test('the imported events show in the calendar, and importing again finds them as duplicates', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/organisation');
  await page.getByRole('button', { name: 'Kalender importieren' }).click();
  await page.locator('#import-ics').setInputFiles({ name: 'kalender.ics', mimeType: 'text/calendar', buffer: Buffer.from(ics()) });
  await page.getByRole('dialog').getByRole('button', { name: '4 importieren' }).click();
  await page.getByRole('button', { name: 'Woche', exact: true }).click();
  await expect(page.locator('app-org-calendar')).toContainText('Elternabend');

  await page.getByRole('button', { name: 'Kalender importieren' }).click();
  await page.locator('#import-ics').setInputFiles({ name: 'kalender.ics', mimeType: 'text/calendar', buffer: Buffer.from(ics()) });
  await expect(page.getByRole('dialog').locator('.imp-summary')).toContainText('0 Termine neu');
  await expect(page.getByRole('dialog').locator('.imp-summary')).toContainText('4 schon im Kalender');
});

test('a file that is not a calendar gets a clear message', async ({ page }) => {
  await page.route('http://localhost:8000/api/**', (route) => route.abort());
  await page.goto('/demo/organisation');
  await page.getByRole('button', { name: 'Kalender importieren' }).click();
  await page.locator('#import-ics').setInputFiles({ name: 'liste.ics', mimeType: 'text/calendar', buffer: Buffer.from('Hallo') });
  await expect(page.getByText('Das ist keine Kalenderdatei (.ics).')).toBeVisible();
});
