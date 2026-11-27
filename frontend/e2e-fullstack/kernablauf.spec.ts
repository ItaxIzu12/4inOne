import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
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
  await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
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
  await sophie.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
  await expect(sophie.locator('.task')).toContainText([titel]);

  // Zweite Person: eigene Liste ohne Sophies Aufgabe …
  const max = await registrieren(browser, 'Max');
  await max.goto('/organisation');
  if (/onboarding/.test(max.url())) await max.goto('/organisation');
  await max.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
  await expect(max.getByText(titel)).toHaveCount(0);

  // … und auch direkt über die API kein Zugriff: fremde ID → 404 (verrät nicht einmal, dass es sie gibt)
  const status = await max.evaluate(async (taskId) => {
    const refresh = await fetch('http://localhost:8010/api/v1/auth/csrf/', { credentials: 'include' });
    const { csrfToken } = (await refresh.json()) as { csrfToken: string };
    const tokenRes = await fetch('http://localhost:8010/api/v1/auth/refresh/', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRFToken': csrfToken, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const { access } = (await tokenRes.json()) as { access: string };
    const r = await fetch(`http://localhost:8010/api/v1/organisation/tasks/${taskId}/`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    return { refresh: tokenRes.status, task: r.status };
  }, id);
  expect(status).toEqual({ refresh: 200, task: 404 });

  // Ohne Anmeldung: geschützte Seiten führen zur Anmeldung, die API antwortet 401
  const fremd = await (await browser.newContext()).newPage();
  await fremd.goto('/organisation');
  await expect(fremd).toHaveURL(/login/);
  expect((await fremd.request.get('http://localhost:8010/api/v1/organisation/tasks/')).status()).toBe(401);
});

/** Mini-Entpacker für den Test (nur „gespeichert“ und „deflate“, wie Pythons zipfile sie schreibt). */
function unzip(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let at = 0;
  while (buffer.readUInt32LE(at) === 0x04034b50) {
    const method = buffer.readUInt16LE(at + 8);
    const size = buffer.readUInt32LE(at + 18);
    const nameLength = buffer.readUInt16LE(at + 26);
    const extraLength = buffer.readUInt16LE(at + 28);
    const name = buffer.toString('utf8', at + 30, at + 30 + nameLength);
    const start = at + 30 + nameLength + extraLength;
    const data = buffer.subarray(start, start + size);
    files.set(name, method === 8 ? inflateRawSync(data) : data);
    at = start + size;
  }
  return files;
}

test('Datenexport (DSGVO): eigene Aufgabe steckt im ZIP, fremde nicht, keine Geheimnisse', async ({ browser }) => {
  const lena = await registrieren(browser, 'Lena');
  const eigene = `Reisepass verlängern ${run}`;
  await aufgabeAnlegen(lena, eigene);
  const jonas = await registrieren(browser, 'Jonas');
  const fremde = `Geheime Aufgabe ${run}`;
  await aufgabeAnlegen(jonas, fremde);

  await lena.goto('/einstellungen/profil');
  const download = lena.waitForEvent('download');
  await lena.getByRole('button', { name: 'Daten herunterladen' }).click();
  const datei = await download;
  expect(datei.suggestedFilename()).toMatch(/^veyora-daten-\d{4}-\d{2}-\d{2}\.zip$/);
  await expect(lena.getByText('Die Datei wurde heruntergeladen.')).toBeVisible();

  const zip = unzip(readFileSync((await datei.path())!));
  expect([...zip.keys()]).toEqual(expect.arrayContaining(['LIESMICH.txt', 'konto.json', 'organisation.json', 'finanzen.json']));
  const organisation = JSON.parse(zip.get('organisation.json')!.toString()) as { aufgaben: { title: string }[] };
  expect(organisation.aufgaben.map((a) => a.title)).toEqual([eigene]);
  const alles = [...zip.values()].map((b) => b.toString()).join('\n');
  expect(alles).not.toContain(fremde);
  expect(alles).not.toContain('argon2'); // kein Passwort-Hash
  expect(JSON.parse(zip.get('konto.json')!.toString()).profil.email).toBe(`lena-${run}@example.test`);
});
