import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Kernablauf gegen das echte Backend (playwright.fullstack.config.ts): Konto anlegen → Aufgabe speichern → nach dem
 * Neuladen noch da (Sitzung über das Refresh-Cookie) → eine zweite Person sieht sie nicht, auch nicht über die API.
 * Testkonten entstehen nur in der frischen Testdatenbank; das Passwort ist ein reiner Testwert.
 */
const PASSWORT = 'Testlauf-2026!';
const run = Date.now().toString(36);

async function registrieren(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/registrieren');
  await page.getByLabel('Vorname').fill(name);
  await page.getByLabel('E-Mail-Adresse').fill(`${name.toLowerCase()}-${run}@example.test`);
  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORT);
  await page.getByLabel('Passwort wiederholen').fill(PASSWORT);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).not.toHaveURL(/registrieren/, { timeout: 15_000 });
  return page;
}

async function aufgabeAnlegen(page: Page, titel: string) {
  await page.goto('/organisation');
  // Neue Konten landen beim ersten Aufruf ggf. im Onboarding – dann direkt weiter in die Organisation
  if (/onboarding/.test(page.url())) await page.goto('/organisation');
  await page.getByRole('button', { name: 'Aufgaben', exact: true }).click();
  await page.getByRole('button', { name: 'Aufgabe hinzufügen', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titel', { exact: true }).fill(titel);
  const gespeichert = page.waitForResponse((r) => r.url().includes('/api/v1/organisation/tasks/') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  const antwort = await gespeichert;
  expect(antwort.status()).toBe(201);
  await expect(page.locator('.task')).toContainText([titel]);
  return (await antwort.json()) as { id: number };
}

test('Konto, Aufgabe, Neuladen und Fremdzugriff – alles echt', async ({ browser }) => {
  const sophie = await registrieren(browser, 'Sophie');
  const titel = `Steuerunterlagen ${run}`;
  const { id } = await aufgabeAnlegen(sophie, titel);

  // Neuladen: Sitzung bleibt (Refresh-Cookie), die Aufgabe kommt aus der Datenbank
  await sophie.reload();
  await sophie.getByRole('button', { name: 'Aufgaben', exact: true }).click();
  await expect(sophie.locator('.task')).toContainText([titel]);

  // Zweite Person: eigene Liste ohne Sophies Aufgabe …
  const max = await registrieren(browser, 'Max');
  await max.goto('/organisation');
  if (/onboarding/.test(max.url())) await max.goto('/organisation');
  await max.getByRole('button', { name: 'Aufgaben', exact: true }).click();
  await expect(max.getByText(titel)).toHaveCount(0);

  // … und auch direkt über die API kein Zugriff: fremde ID → 404 (verrät nicht einmal, dass es sie gibt)
  const status = await max.evaluate(async (taskId) => {
    const refresh = await fetch('http://localhost:8000/api/v1/auth/csrf/', { credentials: 'include' });
    const { csrfToken } = (await refresh.json()) as { csrfToken: string };
    const tokenRes = await fetch('http://localhost:8000/api/v1/auth/refresh/', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRFToken': csrfToken, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const { access } = (await tokenRes.json()) as { access: string };
    const r = await fetch(`http://localhost:8000/api/v1/organisation/tasks/${taskId}/`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    return { refresh: tokenRes.status, task: r.status };
  }, id);
  expect(status).toEqual({ refresh: 200, task: 404 });

  // Ohne Anmeldung: geschützte Seiten führen zur Anmeldung, die API antwortet 401
  const fremd = await (await browser.newContext()).newPage();
  await fremd.goto('/organisation');
  await expect(fremd).toHaveURL(/login/);
  expect((await fremd.request.get('http://localhost:8000/api/v1/organisation/tasks/')).status()).toBe(401);
});
