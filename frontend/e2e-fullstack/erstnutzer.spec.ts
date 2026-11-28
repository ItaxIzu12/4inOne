import { test, expect, Page, Browser } from '@playwright/test';
import { pickDate } from '../e2e/helpers';

/**
 * Vollständiger Testlauf als echte Erstnutzerin (21.11.2026): echte Oberfläche gegen echtes Django mit frischer
 * Test-Datenbank (playwright.fullstack.config.ts) — nichts nachgestellt. Sophie entdeckt Lumiknot zum ersten Mal,
 * registriert sich, richtet sich ein und legt in jedem Bereich alles an, was man anlegen kann. Danach prüft Max
 * (zweites, unabhängiges Konto), dass er davon nichts sieht. Demo-Besetzung wie überall: Sophie, Max.
 */
const PASSWORT = 'Mond!Fluss7Rabe';
const run = Date.now().toString(36);
const API = 'http://localhost:8010/api/v1';

test.describe.configure({ mode: 'serial' });
let sophie: Page;
const sophieMail = `sophie-${run}@example.test`;

async function newUser(browser: Browser, name: string, email: string): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto('/');
  await page.getByRole('link', { name: 'Konto erstellen' }).first().click();
  await expect(page).toHaveURL(/\/registrieren/);
  await page.getByLabel('Vorname').fill(name);
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORT);
  await expect(page.locator('.strength-label')).toContainText('Stark');
  await page.getByLabel('Passwort wiederholen').fill(PASSWORT);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
  return page;
}

test('1 · Registrierung und Onboarding mit erster echter Ausgabe', async ({ browser }) => {
  sophie = await newUser(browser, 'Sophie', sophieMail);
  const p = sophie;
  await expect(p.getByRole('heading', { name: 'Willkommen bei Lumiknot' })).toBeVisible();
  await p.getByLabel('Wie dürfen wir dich nennen?').fill('Sophie Weber');
  await p.getByRole('button', { name: 'Weiter' }).click();
  await expect(p.getByRole('heading', { name: 'Womit möchtest du anfangen?' })).toBeVisible();
  for (const area of ['Finanzen', 'Haushalt', 'Organisation', 'Reisen']) {
    const b = p.getByRole('button', { name: new RegExp(area) }).first();
    if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
  }
  await p.getByRole('button', { name: 'Weiter' }).click();
  await expect(p.getByRole('heading', { name: 'Deine erste Ausgabe' })).toBeVisible();
  await p.getByLabel('Betrag').fill('12,40');
  await p.getByLabel('Wofür?').fill('Bäckerei');
  await p.locator('.chip').first().click();
  await p.getByRole('button', { name: 'Speichern' }).click();
  await expect(p.getByRole('heading', { name: /Alles bereit/ })).toBeVisible();
  await expect(p.getByText('Bäckerei')).toBeVisible();
  await p.getByRole('button', { name: 'Zu Finanzen' }).click();
  await expect(p).toHaveURL(/\/finanzen/);
});

test('2 · Startseite erklärt die vier Bereiche und kennt die erste Ausgabe', async () => {
  const p = sophie;
  await p.goto('/');
  const start = p.locator('app-start-overview');
  await expect(start.getByRole('heading', { name: 'Dein Start mit Lumiknot' })).toBeVisible();
  await expect(start).toContainText('0 von 4 Bereichen eingerichtet');
  await expect(start.locator('.so__row', { hasText: 'Finanzen' })).toContainText('1 von 3 · als Nächstes: Monatsbudget');
  await expect(p.getByRole('heading', { name: /Sophie/ })).toBeVisible();
});

test('3 · Finanzen: Monatsbudget, Einnahme, Sparziel', async () => {
  const p = sophie;
  await p.getByRole('link', { name: /Finanzen/ }).first().click();
  const guide = p.locator('app-start-guide');
  await expect(guide).toContainText('1 von 3 erledigt');
  await guide.getByRole('button', { name: /^Monatsbudget festlegen/ }).click();
  await p.getByLabel('Monatsbudget in EUR').fill('800');
  await p.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(p.getByRole('dialog')).toHaveCount(0);
  // eingerichtet: Leitfaden weg, „Noch verfügbar“ aus echten Zahlen (800 − 12,40)
  await expect(p.locator('app-start-guide')).toHaveCount(0);
  await expect(p.locator('.kpis')).toContainText('787,60');

  await p.getByRole('tab', { name: 'Transaktionen', exact: true }).click();
  await p.locator('.tx-switch').getByRole('button', { name: 'Einnahmen', exact: true }).click();
  await p.getByRole('button', { name: 'Transaktion erfassen', exact: true }).click();
  await p.getByLabel('Betrag in EUR', { exact: true }).fill('2400');
  await p.getByLabel('Wofür? (optional)').fill('Gehalt');
  await p.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(p.getByRole('dialog')).toHaveCount(0);
  await expect(p.getByText('Gehalt').first()).toBeVisible();

  await p.getByRole('tab', { name: 'Sparziele', exact: true }).click();
  await p.getByRole('button', { name: 'Sparziel erstellen', exact: true }).click();
  await p.getByLabel('Titel', { exact: true }).fill('Urlaub Lissabon');
  await p.getByLabel('Zielbetrag in EUR').fill('900');
  await p.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(p.getByRole('dialog')).toHaveCount(0);
  await expect(p.getByText('Urlaub Lissabon').first()).toBeVisible();
});

test('4 · Haushalt: Aufgabe anlegen und erledigen, Einkauf, Gerät, Vertrag', async () => {
  const p = sophie;
  await p.goto('/haushalt');
  const guide = p.locator('app-start-guide');
  await expect(guide.getByRole('heading', { name: 'So startest du mit Haushalt' })).toBeVisible();
  await guide.getByRole('button', { name: /^Erste Aufgabe anlegen/ }).click();
  const task = p.getByRole('dialog', { name: 'Neue Aufgabe' });
  await task.getByLabel('Was ist zu tun?').fill('Bad putzen');
  await task.getByRole('button', { name: 'Speichern' }).click();
  await expect(task).toHaveCount(0);
  await p.getByRole('button', { name: 'Bad putzen als erledigt markieren' }).click();
  await p.getByRole('button', { name: /Erledigt/ }).first().click();
  await expect(p.getByText('Bad putzen').first()).toBeVisible();

  await p.goto('/haushalt');
  await p.locator('app-start-guide').getByRole('button', { name: /^Einkauf planen/ }).click();
  await p.getByLabel('Artikel', { exact: true }).fill('Milch');
  await p.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(p.getByRole('button', { name: /Milch abhaken/ })).toBeVisible();
  await p.getByRole('button', { name: /Milch abhaken/ }).click();
  await expect(p.getByRole('button', { name: /Milch zurück auf die Liste/ })).toBeVisible();

  await p.goto('/haushalt');
  await expect(p.locator('app-start-guide')).toHaveCount(0); // Aufgabe + Einkauf = eingerichtet
  await p.getByRole('tab', { name: 'Zuhause' }).click();
  await p.getByRole('button', { name: 'Gerät hinzufügen' }).first().click();
  const device = p.getByRole('dialog', { name: 'Neues Gerät' });
  await device.getByLabel('Name', { exact: true }).fill('Waschmaschine');
  await device.getByLabel('Hersteller (optional)').fill('Bosch');
  await device.getByRole('button', { name: 'Speichern' }).click();
  await expect(device).toHaveCount(0);
  await expect(p.getByText('Waschmaschine').first()).toBeVisible();

  await p.getByRole('button', { name: 'Verträge' }).first().click();
  await p.getByRole('button', { name: 'Vertrag hinzufügen' }).first().click();
  const contract = p.getByRole('dialog', { name: 'Neuer Vertrag' });
  await contract.getByLabel('Name', { exact: true }).fill('Strom');
  await contract.getByLabel('Anbieter (optional)').fill('Stadtwerke');
  await contract.getByLabel('Kosten (optional)').fill('64,90');
  await contract.getByRole('checkbox', { name: 'Verlängert sich automatisch' }).check();
  await contract.getByRole('button', { name: 'Speichern' }).click();
  await expect(contract).toHaveCount(0);
  await expect(p.getByText('Strom').first()).toBeVisible();
});

test('5 · Organisation: Termin, Aufgabe, Notiz', async () => {
  const p = sophie;
  await p.goto('/organisation');
  const guide = p.locator('app-start-guide');
  await expect(guide.getByRole('heading', { name: 'So startest du mit Organisation' })).toBeVisible();
  await expect(p.locator('.day-hero')).toHaveCount(0);
  await guide.getByRole('button', { name: /^Ersten Termin eintragen/ }).click();
  const event = p.getByRole('dialog', { name: 'Termin hinzufügen' });
  await event.getByLabel('Titel', { exact: true }).fill('Elternabend');
  await event.getByRole('button', { name: 'Speichern' }).click();
  await expect(event).toHaveCount(0);
  await expect(p.locator('app-start-guide')).toContainText('1 von 3 erledigt');

  await p.locator('app-start-guide').getByRole('button', { name: /^Eine Aufgabe festhalten/ }).click();
  const task = p.getByRole('dialog', { name: 'Aufgabe hinzufügen' });
  const heute = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  await expect(task.getByRole('button', { name: /^Fällig am/ })).toContainText(heute); // aus dem Leitfaden: gleich heute
  await task.getByLabel('Titel', { exact: true }).fill('Steuererklärung');
  await task.getByLabel('Projekt (optional)').fill('Familie');
  await task.getByRole('button', { name: 'Speichern' }).click();
  await expect(task).toHaveCount(0);
  // Termin + Aufgabe = eingerichtet: Leitfaden weg, Tageskopf wieder da
  await expect(p.locator('app-start-guide')).toHaveCount(0);
  await expect(p.locator('.day-hero')).toBeVisible();
  await expect(p.getByRole('region', { name: /Aufgaben heute/ })).toContainText('Steuererklärung');

  await p.getByRole('tab', { name: 'Notizen', exact: true }).click();
  await p.getByRole('button', { name: /Notiz (hinzufügen|anlegen|erstellen)|Neue Notiz/ }).first().click();
  const note = p.getByRole('dialog', { name: 'Neue Notiz' });
  await note.getByLabel('Titel (optional)').fill('Geschenkideen');
  await note.getByLabel('Inhalt').fill('- Buch für Max\n- Pflanze');
  await note.getByRole('checkbox', { name: /Oben anheften/ }).check();
  await note.getByRole('button', { name: 'Speichern' }).click();
  await expect(note).toHaveCount(0);
  await expect(p.getByText('Geschenkideen').first()).toBeVisible();

  await p.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
  await expect(p.getByText('Steuererklärung').first()).toBeVisible();
  await p.getByRole('tab', { name: 'Kalender', exact: true }).click();
  await expect(p.getByRole('button', { name: /Elternabend – bearbeiten/ })).toBeVisible();
});

const iso = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

test('6 · Reisen: Reise, Packliste, Aufgabe, Budget', async () => {
  const p = sophie;
  await p.goto('/reisen');
  const guide = p.locator('app-start-guide');
  await expect(guide.getByRole('heading', { name: 'So startest du mit Reisen' })).toBeVisible();
  await guide.getByRole('button', { name: /^Erste Reise anlegen/ }).click();
  const trip = p.getByRole('dialog', { name: 'Reise erstellen' });
  await trip.getByLabel('Reiseziel').fill('Lissabon');
  await trip.getByLabel('Name der Reise').fill('Lissabon im Frühling');
  await pickDate(p, trip.getByRole('button', { name: /^Erster Tag/ }), iso(20));
  await pickDate(p, trip.getByRole('button', { name: /^Letzter Tag/ }), iso(24));
  await trip.getByRole('button', { name: 'Flugzeug' }).click();
  await trip.getByRole('button', { name: 'Reise erstellen' }).click();
  await expect(trip).toHaveCount(0);
  await expect(p.getByRole('heading', { name: 'Lissabon im Frühling', level: 1 })).toBeVisible();
  await p.getByRole('dialog', { name: 'Reise erstellt' }).getByRole('button', { name: 'Vorschläge ansehen' }).click();
  const sug = p.getByRole('dialog', { name: 'Vorschläge für Lissabon im Frühling' });
  await sug.getByRole('checkbox', { name: 'Wohnung vorbereiten' }).uncheck();
  await sug.getByRole('checkbox', { name: 'Versicherung' }).uncheck();
  await expect(sug).toContainText('33 von 35 ausgewählt');
  await sug.getByRole('button', { name: /33 Vorschläge übernehmen/ }).click();
  await expect(sug).toHaveCount(0);

  const nav = p.getByRole('tablist', { name: 'Bereiche dieser Reise' });
  await nav.getByRole('tab', { name: 'Packliste', exact: true }).click();
  await expect(p.getByRole('checkbox', { name: /Reisepass/ })).toBeVisible();
  await expect(p.getByRole('checkbox', { name: /Versicherung/ })).toHaveCount(0);
  await p.getByRole('checkbox', { name: /Reisepass/ }).check();
  await expect(p.getByRole('checkbox', { name: /Reisepass/ })).toBeChecked();

  await nav.getByRole('tab', { name: 'Planung', exact: true }).click();
  await expect(p.getByRole('checkbox', { name: /Unterkunft prüfen/ })).toBeVisible();
  await p.getByRole('checkbox', { name: /Unterkunft prüfen/ }).check();
  await p.waitForTimeout(500);

  await nav.getByRole('tab', { name: 'Budget', exact: true }).click();
  await p.waitForTimeout(700);
  await p.getByRole('button', { name: 'Gesamtbudget festlegen' }).click();
  const budget = p.getByRole('dialog', { name: 'Gesamtbudget festlegen' });
  await budget.getByLabel('Gesamtbudget').fill('900');
  await budget.getByLabel('Unterkunft').fill('400');
  await budget.getByRole('button', { name: 'Speichern' }).click();
  await expect(budget).toHaveCount(0);
  await p.getByRole('button', { name: 'Ausgabe hinzufügen' }).first().click();
  const expense = p.getByRole('dialog', { name: 'Ausgabe hinzufügen' });
  await expense.getByLabel('Beschreibung').fill('Flug');
  await expense.getByLabel('Betrag').fill('180');
  await expense.getByRole('group', { name: 'Kategorie' }).getByRole('button', { name: /Transport/ }).click();
  await expense.getByRole('button', { name: 'Speichern' }).click();
  await expect(expense).toHaveCount(0);
  await expect(p.locator('main')).toContainText('Flug');
  await expect(p.locator('main')).toContainText('720'); // 900 − 180 übrig

  // Übersicht: Lumiknot schlägt das Sparziel „Urlaub Lissabon“ zum Verknüpfen vor
  await nav.getByRole('tab', { name: 'Übersicht', exact: true }).click();
  await p.getByRole('button', { name: 'Mit „Urlaub Lissabon“ verknüpfen' }).click();
  await expect(p.getByRole('region', { name: 'Gehört zu dieser Reise' })).toContainText('Urlaub Lissabon');

  // zurück zur Liste: Reise + Packliste = eingerichtet, kein Leitfaden mehr
  await p.getByRole('button', { name: 'Meine Reisen' }).click();
  await expect(p.locator('app-start-guide')).toHaveCount(0);
  await expect(p.getByText('Lissabon im Frühling').first()).toBeVisible();
});

test('7 · Startseite nach dem Einrichten: echte Inhalte statt Leitfaden', async () => {
  const p = sophie;
  await p.goto('/');
  await expect(p.getByRole('heading', { name: 'Guten Tag, Sophie Weber!' }).or(p.getByRole('heading', { name: /Sophie Weber!/ }))).toBeVisible();
  await expect(p.locator('app-start-overview')).toHaveCount(0); // alle vier Bereiche eingerichtet
  await expect(p.getByRole('region', { name: 'Finanzen' })).toContainText('787,60', { timeout: 10_000 });
});

test('8 · Bearbeiten und Löschen mit Bestätigung', async () => {
  const p = sophie;
  await p.goto('/organisation');
  await p.getByRole('tab', { name: 'Notizen', exact: true }).click();
  await p.getByRole('button', { name: /Geschenkideen/ }).first().click();
  const edit = p.getByRole('dialog', { name: 'Notiz bearbeiten' });
  await edit.getByLabel('Titel (optional)').fill('Geschenkideen Weihnachten');
  await edit.getByRole('button', { name: 'Speichern' }).click();
  await expect(edit).toHaveCount(0);
  await expect(p.getByRole('button', { name: /Geschenkideen Weihnachten/ }).first()).toBeVisible();

  await p.getByRole('button', { name: /Geschenkideen Weihnachten/ }).first().click();
  await p.getByRole('dialog', { name: 'Notiz bearbeiten' }).getByRole('button', { name: 'Notiz löschen' }).click();
  const dlg = p.getByRole('dialog', { name: 'Notiz bearbeiten' });
  await expect(dlg).toContainText('Wirklich löschen? Das lässt sich nicht rückgängig machen.');
  await dlg.getByRole('button', { name: 'Ja, löschen' }).click();
  await expect(dlg).toHaveCount(0);
  await expect(p.getByRole('button', { name: /Geschenkideen/ })).toHaveCount(0);
});

test('9 · Abmelden und wieder anmelden: alles ist noch da', async () => {
  const p = sophie;
  await p.goto('/');
  await p.getByRole('button', { name: 'Kontomenü' }).click();
  await p.getByRole('menuitem', { name: 'Abmelden' }).click();
  await expect(p.getByRole('link', { name: 'Konto erstellen' }).first()).toBeVisible();
  // geschützte Seite ohne Anmeldung → Anmeldung
  await p.goto('/finanzen');
  await expect(p).toHaveURL(/\/login/);
  await p.getByLabel('E-Mail-Adresse').fill(sophieMail);
  await p.getByLabel('Passwort', { exact: true }).fill('falsch-Passwort-1!');
  await p.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(p.getByRole('alert')).toBeVisible();
  await p.getByLabel('Passwort', { exact: true }).fill(PASSWORT);
  await p.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(p).not.toHaveURL(/\/login/, { timeout: 15_000 });
  await p.goto('/finanzen');
  await expect(p.locator('.kpis')).toContainText('787,60');
  await p.goto('/organisation');
  await p.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
  await expect(p.getByText('Steuererklärung').first()).toBeVisible();
  await p.goto('/reisen');
  await expect(p.getByText('Lissabon im Frühling').first()).toBeVisible();
});

test('10 · Einstellungen: Profil, Datenexport, Startleitfäden', async () => {
  const p = sophie;
  await p.goto('/einstellungen');
  await expect(p.getByRole('region', { name: 'Startleitfäden' })).toContainText('Eingerichtet – wird nicht mehr gebraucht');
  await p.goto('/einstellungen/profil');
  await expect(p.getByLabel('Name', { exact: true })).toHaveValue('Sophie Weber');
  const download = p.waitForEvent('download');
  await p.getByRole('button', { name: 'Daten herunterladen' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);
});

test('11 · Max (zweites Konto) sieht nichts von Sophie — weder in der App noch über die API', async ({ browser }) => {
  const max = await newUser(browser, 'Max', `max-${run}@example.test`);
  await max.getByRole('button', { name: 'Überspringen' }).click();
  await expect(max).not.toHaveURL(/onboarding/);
  await expect(max.locator('app-start-overview')).toContainText('0 von 4 Bereichen eingerichtet');
  for (const [path, heading] of [['/finanzen', 'Finanzen'], ['/haushalt', 'Haushalt'], ['/organisation', 'Organisation'], ['/reisen', 'Reisen']]) {
    await max.goto(path);
    await expect(max.locator('app-start-guide')).toContainText('0 von 3 erledigt');
    // Seiteninhalt ohne den Leitfaden (dessen Beispiele wie „z. B. Bad putzen“ sind kein fremder Eintrag)
    await max.waitForTimeout(600);
    const text = await max.locator('main').evaluate((el) => {
      const copy = el.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('app-start-guide').forEach((n) => n.remove());
      return copy.textContent ?? '';
    });
    expect(text).not.toMatch(/Bäckerei|Gehalt|Urlaub Lissabon|Bad putzen|Milch|Waschmaschine|Strom|Elternabend|Steuererklärung|Lissabon im Frühling/);
    expect(heading).toBeTruthy();
    await expect(max.getByRole('button', { name: /Bad putzen als erledigt/ })).toHaveCount(0);
  }
  // fremde IDs direkt abfragen: 404 (verrät nicht einmal, dass es sie gibt)
  const ids = await sophie.evaluate(async (api) => {
    const csrf = (await (await fetch(`${api}/auth/csrf/`, { credentials: 'include' })).json()).csrfToken;
    const { access } = await (await fetch(`${api}/auth/refresh/`, { method: 'POST', credentials: 'include', headers: { 'X-CSRFToken': csrf, 'Content-Type': 'application/json' }, body: '{}' })).json();
    const get = async (u: string) => (await (await fetch(`${api}${u}`, { headers: { Authorization: `Bearer ${access}` } })).json());
    const pick = (x: unknown) => { const list = Array.isArray(x) ? x : (x as { results?: unknown[] }).results ?? []; return (list[0] as { id: number } | undefined)?.id; };
    return { task: pick(await get('/organisation/tasks/')), trip: pick(await get('/reisen/trips/')), goal: pick(await get('/finanzen/private/goals/')) };
  }, API);
  expect(ids.task && ids.trip && ids.goal).toBeTruthy();
  const statuses = await max.evaluate(async ({ api, ids }) => {
    const csrf = (await (await fetch(`${api}/auth/csrf/`, { credentials: 'include' })).json()).csrfToken;
    const { access } = await (await fetch(`${api}/auth/refresh/`, { method: 'POST', credentials: 'include', headers: { 'X-CSRFToken': csrf, 'Content-Type': 'application/json' }, body: '{}' })).json();
    const st = async (u: string, method = 'GET') => (await fetch(`${api}${u}`, { method, headers: { Authorization: `Bearer ${access}` } })).status;
    return {
      task: await st(`/organisation/tasks/${ids.task}/`),
      trip: await st(`/reisen/trips/${ids.trip}/`),
      goal: await st(`/finanzen/private/goals/${ids.goal}/`),
      deleteTask: await st(`/organisation/tasks/${ids.task}/`, 'DELETE'),
    };
  }, { api: API, ids });
  expect(statuses).toEqual({ task: 404, trip: 404, goal: 404, deleteTask: 404 });
  await max.goto('/einstellungen/profil');
  await max.getByRole('button', { name: 'Konto löschen' }).click();
  const dialog = max.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Konto wirklich löschen?' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Konto endgültig löschen' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Bitte gib dein Passwort ein');
  await dialog.getByLabel('Zur Bestätigung: dein Passwort').fill('falsch-Passwort-1!');
  await dialog.getByRole('button', { name: 'Konto endgültig löschen' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Das Passwort stimmt nicht');
  await dialog.getByLabel('Zur Bestätigung: dein Passwort').fill(PASSWORT);
  await dialog.getByRole('button', { name: 'Konto endgültig löschen' }).click();
  await expect(max).toHaveURL(/localhost:4211\/$/);
  // gelöscht heißt gelöscht: Anmeldung klappt nicht mehr, Sophies Konto bleibt unberührt
  await max.goto('/login');
  await max.getByLabel('E-Mail-Adresse').fill(`max-${run}@example.test`);
  await max.getByLabel('Passwort', { exact: true }).fill(PASSWORT);
  await max.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(max.getByRole('alert')).toBeVisible();
  await sophie.goto('/reisen');
  await expect(sophie.getByText('Lissabon im Frühling').first()).toBeVisible();
});
