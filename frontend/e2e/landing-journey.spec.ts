import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Die Startseite aus Sicht eines echten Erstbesuchers (24.10.2026): versteht er in Sekunden, was 4inOne ist und
 * warum, erlebt er den Kern (Verknüpfen) selbst, findet er ohne Umweg in die Demo — am Handy und am Rechner, mit Maus
 * und nur mit der Tastatur. Dazu Integrität (keine toten Links, keine Fehler in der Konsole, keine fremden Server)
 * und Sicherheit (keine Skript-Einschleusung über die Adresse, keine privaten Daten ohne Konto).
 */

/** Besucher ohne Konto: Backend nachgebildet; jede Anfrage an private Daten wird mitgeschrieben. */
async function visitor(page: Page) {
  const privateCalls: string[] = [];
  const foreignHosts = new Set<string>();
  const errors: string[] = [];
  page.on('request', (req) => {
    const host = new URL(req.url()).host;
    if (!['localhost:4210', 'localhost:8000'].includes(host) && !req.url().startsWith('data:')) foreignHosts.add(host);
  });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource|ERR_/.test(msg.text())) errors.push(msg.text());
  });
  await page.route('**/api/v1/**', async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith('/auth/csrf/')) return r.fulfill({ json: { csrfToken: 'test' } });
    if (path.endsWith('/auth/refresh/')) return r.fulfill({ status: 401, json: {} });
    if (path.endsWith('/site/pageview/')) return r.fulfill({ status: 204 });
    privateCalls.push(path);
    return r.fulfill({ status: 401, json: {} });
  });
  return { privateCalls, foreignHosts, errors };
}

for (const [label, width, height] of [['Handy', 390, 844], ['Rechner', 1440, 900]] as const) {
  test.describe(`Erstbesuch am ${label} (${width} px)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
    });

    test('versteht im ersten Bildschirm, was 4inOne ist, warum, und wie es weitergeht', async ({ page }) => {
      const { privateCalls } = await visitor(page);
      await page.goto('/');
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toHaveText('Vier Bereiche für deinen Alltag – und was zusammengehört, ist verbunden.');
      // Darunter: die vier Bereiche und ein konkretes Beispiel für „verbunden“ (statt den Kernsatz zu wiederholen)
      const lead = page.locator('.hero__lead');
      await expect(lead).toContainText('Finanzen, Haushalt, Organisation und Reisen');
      await expect(lead).toContainText('Reisekasse weiß, zu welcher Reise sie gehört');
      // Der Hauptweg ist die Demo, im ersten Bildschirm sichtbar, mit der Zusage „ohne Konto“
      const demo = page.locator('.hero').getByRole('link', { name: 'Demo ohne Anmeldung testen' });
      await expect(demo).toHaveAttribute('href', '/demo');
      await expect(demo).toBeInViewport();
      await expect(page.locator('.hero__note')).toContainText('Ohne Registrierung');
      // „So funktioniert's“ führt zur Probe auf derselben Seite
      await expect(page.locator('.hero').getByRole('link', { name: 'So funktioniert’s' })).toHaveAttribute('href', '/#verknuepfen');
      expect(await demo.evaluate((a) => a.classList.contains('btn--ink'))).toBe(true);
      // Ohne Konto werden keine privaten Daten abgefragt
      expect(privateCalls).toEqual([]);
    });

    test('erlebt den Kern selbst: Reise anlegen, Vorschläge mit Grund, verknüpfen, weiter in die Demo', async ({ page }) => {
      const { privateCalls, errors } = await visitor(page);
      await page.goto('/');
      const play = page.locator('#verknuepfen');
      await play.scrollIntoViewIfNeeded();
      // Vorher: die Vorschläge sind als Vorschau zu sehen, aber ohne Knöpfe — und kein „Das war ein Ausschnitt“
      await expect(play.locator('.sug--preview')).toHaveCount(3);
      await expect(play.getByRole('button', { name: /^Verknüpfen:/ })).toHaveCount(0);
      await expect(play.locator('.play__next')).toContainText('Lieber gleich die ganze App sehen?');
      // Reise anlegen → Vorschläge mit Begründung, Fokus folgt
      await play.getByRole('button', { name: 'Reise anlegen' }).click();
      await expect(play.locator('.suggestions__label').first()).toBeFocused();
      await expect(play.locator('.sug__reason').first()).toContainText('„Berlin“');
      await expect(play.locator('.sug--skipped')).toContainText('Die Zeit allein reicht nie');
      // Verknüpfen: Zähler, Lichtlinie, Name folgt dem Zustand
      await play.getByRole('button', { name: 'Verknüpfen: Reisekasse Berlin' }).click();
      await expect(play.locator('.source__count')).toHaveText('Verknüpft mit 1 Eintrag');
      await expect(play.locator('app-animated-beam svg')).toHaveCount(1);
      await expect(play.getByRole('button', { name: 'Verbindung lösen: Reisekasse Berlin' })).toBeVisible();
      // Jetzt erst: „Das war ein Ausschnitt“ — und der Weg in die Demo
      await expect(play.locator('.play__next')).toContainText('Das war ein Ausschnitt.');
      await play.getByRole('link', { name: 'In der Demo weitermachen' }).click();
      await expect(page).toHaveURL('/demo');
      await expect(page.locator('.demo-banner')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^(Guten Morgen|Guten Tag|Guten Abend),? Sophie!$/);
      expect(privateCalls).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('kann Vorschläge ablehnen, das Beispiel wechseln und alles zurücksetzen', async ({ page }) => {
      await visitor(page);
      await page.goto('/');
      const play = page.locator('#verknuepfen');
      await play.getByRole('button', { name: 'Reise anlegen' }).click();
      // Schritt 3: je Vorschlag entscheiden — später, ablehnen; beides als Wort sichtbar, rückgängig machbar
      await play.getByRole('button', { name: 'Später: Zug nach Berlin' }).click();
      await expect(play.locator('.sug.is-later')).toContainText('Später prüfen');
      await play.getByRole('button', { name: 'Ablehnen: Hotel in Berlin bestätigen' }).click();
      await expect(play.locator('.sug.is-dismissed')).toContainText('Abgelehnt');
      await play.getByRole('button', { name: 'Verknüpfen: Reisekasse Berlin' }).click();
      // Schritt 4: Ergebnis je Bereich, ohne neue Einträge und ohne Zugriff
      await expect(play.locator('.stepper [aria-current="step"]')).toContainText('Ergebnis');
      await expect(play.locator('.outcome')).toContainText('Reisekasse Berlin');
      await expect(play.locator('.outcome')).toContainText('1 offen für später');
      await expect(play.locator('.outcome')).toContainText('niemand bekommt dadurch Zugriff');
      await play.getByRole('button', { name: 'Rückgängig: Hotel in Berlin bestätigen' }).click();
      await expect(play.locator('.sug.is-dismissed')).toHaveCount(0);
      await play.getByRole('button', { name: 'Ein Vertrag' }).click();
      await expect(play.getByRole('button', { name: 'Ein Vertrag' })).toHaveAttribute('aria-pressed', 'true');
      await expect(play.locator('.source')).toContainText('Strom, Stadtwerke');
      await expect(play.locator('.sug--skipped')).toContainText('Nur der Anbieter ist gleich');
      await play.getByRole('button', { name: 'Eine Reise' }).click();
      await play.getByRole('button', { name: 'Zurücksetzen' }).click();
      await expect(play.getByRole('button', { name: 'Reise anlegen' })).toBeVisible();
      await expect(play.locator('.sug--preview')).toHaveCount(3);
    });

    test('sieht jeden Bereich mit echtem Bild und kommt von dort in dessen Demo', async ({ page }) => {
      await visitor(page);
      await page.goto('/');
      const tabs = page.getByRole('tablist', { name: 'Bereiche' }).getByRole('tab');
      for (const [name, path] of [['Finanzen', 'finanzen'], ['Haushalt', 'haushalt'], ['Organisation', 'organisation'], ['Reisen', 'reisen']]) {
        await tabs.filter({ hasText: name }).click();
        const panel = page.getByRole('tabpanel');
        await expect(panel.getByRole('heading', { level: 3 })).toHaveText(name);
        const img = panel.locator('img');
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
        expect((await img.getAttribute('alt'))!.length).toBeGreaterThan(30);
        await expect(panel.getByRole('link', { name: `${name} in der Demo ansehen` })).toHaveAttribute('href', `/demo/${path}`);
      }
      await page.getByRole('tabpanel').getByRole('link', { name: 'Reisen in der Demo ansehen' }).click();
      await expect(page).toHaveURL('/demo/reisen');
      await expect(page.locator('.demo-banner')).toBeVisible();
    });

    test('findet Antworten auf typische Fragen und vertraut dem Datenschutz', async ({ page }) => {
      await visitor(page);
      await page.goto('/');
      for (const fact of ['Teilen und Verknüpfen sind zwei Dinge', 'Keine Bankverbindung nötig', 'Nur du', 'Nicht teilbar', 'ändert keine Rechte'])
        await expect(page.locator('#privat')).toContainText(fact);
      await expect(page.locator('#privat .share__head')).toContainText('Beispiel');
      const questions = page.locator('#fragen details');
      const count = await questions.count();
      expect(count).toBeGreaterThanOrEqual(5);
      for (let i = 0; i < count; i++) {
        await questions.nth(i).locator('summary').click();
        await expect(questions.nth(i)).toHaveAttribute('open', '');
        expect(((await questions.nth(i).locator('p').textContent()) ?? '').trim().length).toBeGreaterThan(40);
      }
    });

    test('hat keine toten Links und keine fehlenden Sprungziele', async ({ page }) => {
      const { errors } = await visitor(page);
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const hrefs = await page.locator('a[href]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!))]);
      for (const href of hrefs.filter((h) => h.startsWith('#'))) expect(await page.locator(href).count(), href).toBe(1);
      const pages = hrefs.filter((h) => h.startsWith('/'));
      expect(pages.length).toBeGreaterThan(8);
      for (const href of pages) {
        await page.goto(href);
        await expect(page.getByRole('heading', { level: 1 }), href).toBeVisible();
        await expect(page.getByText('Diese Seite gibt es nicht.'), href).toHaveCount(0);
        // erst weiter, wenn nichts mehr nachlädt – Safari meldet sonst abgebrochene Nachlade-Vorgänge als Fehler
        await page.waitForLoadState('networkidle');
      }
      // Keine externen Links, die ohne Schutz ein neues Fenster öffnen
      await page.goto('/');
      expect(await page.locator('a[target="_blank"]:not([rel~="noopener"])').count()).toBe(0);
      expect(errors).toEqual([]);
    });

    test('bleibt barrierefrei nach WCAG 2.2 AA, auch nach dem Ausprobieren', async ({ page }) => {
      await visitor(page);
      await page.goto('/');
      await page.locator('#verknuepfen').getByRole('button', { name: 'Reise anlegen' }).click();
      await page.getByRole('button', { name: 'Verknüpfen: Hotel in Berlin bestätigen' }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      // Tippziele: jeder Link und Knopf im Inhalt mindestens 44 px hoch (Inline-Links im Fließtext ausgenommen)
      const small = await page.locator('main a, main button, main summary, header a, footer a').evaluateAll((els) =>
        els
          .filter((e) => getComputedStyle(e).display !== 'inline' && e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 44)
          .map((e) => e.textContent?.trim()),
      );
      expect(small).toEqual([]);
    });
  });
}

// WCAG 1.4.10: 320 px entspricht 400 % Zoom bei 1280 px; 640 px etwa 200 %. Dazu Tablet und kleiner Laptop.
for (const width of [320, 640, 768, 1024]) {
  test(`bei ${width} px: nichts scrollt seitlich, nichts wird abgeschnitten, der Demo-Knopf ist im ersten Bildschirm`, async ({ page }) => {
    await visitor(page);
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Reise anlegen' }).click();
    await page.getByRole('button', { name: 'Verknüpfen: Reisekasse Berlin' }).click();
    // der Fokus wandert für Tastatur-Nutzer in dieselbe Zeile — erst danach nach oben
    await expect(page.getByRole('button', { name: 'Verbindung lösen: Reisekasse Berlin' })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll('main h1, main h2, main h3, main p, main a, main button, main dt, main dd')]
        // .sr-only ist absichtlich unsichtbar (Statuszeile für Screenreader)
        .filter((e) => !e.matches('.sr-only') && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible')
        .map((e) => e.textContent?.trim().slice(0, 30)),
    );
    expect(clipped).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('.hero').getByRole('link', { name: 'Demo ohne Anmeldung testen' })).toBeInViewport();
  });
}

test('nur mit der Tastatur: vom Seitenanfang über die Probe in die Demo', async ({ page, isMobile }) => {
  // Am iPhone gibt es keine Tab-Taste; Safari springt per Tab ohnehin nur zwischen Formularfeldern
  test.skip(isMobile, 'Tastatur-Weg nur am Rechner');
  await visitor(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // „Zum Inhalt springen“ ist der erste Tab-Stopp
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Zum Inhalt springen' })).toBeFocused();
  // Zur Probe: Tab bis „Reise anlegen“ (höchstens 40 Schritte), Enter
  for (let i = 0; i < 40 && !(await page.getByRole('button', { name: 'Reise anlegen' }).evaluate((b) => b === document.activeElement)); i++)
    await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Reise anlegen' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.suggestions__label').first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Verknüpfen: Hotel in Berlin bestätigen' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.source__count')).toHaveText('Verknüpft mit 1 Eintrag');
  // Der Knopf wechselt zu „Verknüpft“ — der Fokus bleibt in derselben Zeile (geht nicht verloren)
  await expect(page.getByRole('button', { name: 'Verbindung lösen: Hotel in Berlin bestätigen' })).toBeFocused();
  // Fokus ist immer sichtbar und nie unter dem festen Kopf
  const focus = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const cs = getComputedStyle(el);
    return { ring: cs.outlineStyle !== 'none' || cs.boxShadow !== 'none', top: el.getBoundingClientRect().top };
  });
  expect(focus.ring).toBe(true);
  expect(focus.top).toBeGreaterThan(72);
  // weiter zu „In der Demo weitermachen“ und Enter
  for (let i = 0; i < 15 && !(await page.getByRole('link', { name: 'In der Demo weitermachen' }).evaluate((a) => a === document.activeElement)); i++)
    await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/demo');
});

test('Sicherheit: Eingaben über die Adresse werden nie als Code ausgeführt, Rechtsseiten ohne private Daten', async ({ page }) => {
  const { privateCalls, foreignHosts } = await visitor(page);
  let dialog = false;
  page.on('dialog', async (d) => {
    dialog = true;
    await d.dismiss();
  });
  const payload = encodeURIComponent('<img src=x onerror=alert(1)><script>alert(2)</script>');
  for (const url of [`/?q=${payload}`, `/?ref=${payload}#${payload}`, `/impressum?x=${payload}`, `/${payload}`]) {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.locator('main img[src="x"], main script').count(), url).toBe(0);
  }
  expect(dialog).toBe(false);
  // Keine Zugriffe auf private Daten und keine Anfragen an fremde Server (Schriften selbst gehostet, kein Tracking)
  expect(privateCalls).toEqual([]);
  expect([...foreignHosts]).toEqual([]);
  // Keine Inline-Event-Handler oder javascript:-Links im ausgelieferten Markup
  await page.goto('/');
  expect(await page.locator('[onclick], [onerror], [onload], a[href^="javascript:"]').count()).toBe(0);
});

// Vorgerendert (app.routes.server.ts): Inhalt steht schon im HTML — ohne JavaScript lesbar, für Suchmaschinen und
// schnelle Handys. Kein ausführbares Inline-Skript, sonst blockiert die strenge CSP (deploy/nginx) die Seite.
test('öffentliche Seiten kommen fertig gerendert, ohne Inline-Skript und ohne persönliche Daten', async ({ request }) => {
  for (const [path, heading] of [
    ['/', 'Vier Bereiche für deinen Alltag'],
    ['/impressum', 'Impressum'],
    ['/datenschutz', 'Datenschutz'],
  ]) {
    const html = await (await request.get(path)).text();
    expect(html, path).toContain(heading);
    expect(html, path).toMatch(/<h1[^>]*>/);
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].map((m) => m[1]);
    expect(inline.every((attrs) => /type="application\/json"/.test(attrs)), `${path}: ${inline.join(' | ')}`).toBe(true);
    expect(html, path).not.toMatch(/"access"\s*:|refresh_token|@example\.com/);
  }
});

// Hover am Rechner (nur Zugabe, nie Pflicht): Vorschau der Verbindung, wandernde Tab-Markierung, Pfeil im Hauptknopf.
test('am Rechner zeigt Überfahren, was passieren würde — ohne etwas zu entscheiden', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Touch-Geräte haben kein Überfahren');
  await visitor(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const play = page.locator('#verknuepfen');
  await play.getByRole('button', { name: 'Reise anlegen' }).click();
  const link = play.getByRole('button', { name: 'Verknüpfen: Reisekasse Berlin' });
  await link.hover();
  await expect(play.locator('app-animated-beam svg.is-preview')).toHaveCount(1); // gestrichelte Vorschau
  await expect(play.locator('.sug.is-linked')).toHaveCount(0); // nichts entschieden
  await page.mouse.move(5, 5);
  await expect(play.locator('app-animated-beam')).toHaveCount(0);
  await link.hover();
  await link.click();
  await expect(play.locator('app-animated-beam svg.is-preview')).toHaveCount(0);
  await expect(play.locator('app-animated-beam svg')).toHaveCount(1); // jetzt die echte Linie

  const tabs = page.getByRole('tablist', { name: 'Bereiche' });
  await tabs.getByRole('tab', { name: 'Reisen' }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const glider = document.querySelector<HTMLElement>('.tabs__glider')!;
        const tab = document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')!;
        return glider.style.transform === `translateX(${tab.offsetLeft}px)` && glider.style.width === `${tab.offsetWidth}px`;
      }),
    )
    .toBe(true);

  const go = page.locator('.hero').getByRole('link', { name: 'Demo ohne Anmeldung testen' }); // Pfeil ändert den Namen nicht
  await go.hover();
  await expect.poll(() => go.locator('app-icon').evaluate((i) => getComputedStyle(i).transform)).toBe('matrix(1, 0, 0, 1, 4, 0)');
});

// Einblenden beim Scrollen (landing-end.scss): nur Überschrift und Bild, an die Scroll-Position gebunden. Inhalt darf
// dabei nie unsichtbar bleiben — mitten im Bild, nach einem Ankersprung und beim Zurückscrollen ist alles voll da.
test('beim Scrollen blenden Überschriften und Bilder ein — und bleiben nie unsichtbar', async ({ page }) => {
  await visitor(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const selectors = ['#problem-title', '#play-title', '#areas-title', '#privacy-title', '#faq-title', '#closer-title', '.compare', '.panel__shot', '.share'];
  const result = await page.evaluate(async (sels) => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const go = async (y: number) => {
      scrollTo({ top: y, behavior: 'instant' });
      await frame();
    };
    const opacity = (el: Element) => +getComputedStyle(el).opacity;
    const out: Record<string, number[]> = {};
    for (const sel of sels) {
      const el = document.querySelector(sel)!;
      await go(0);
      const top = el.getBoundingClientRect().top + scrollY;
      await go(top - innerHeight + 10); // gerade erst angeschnitten
      const entering = opacity(el);
      await go(top - innerHeight / 2); // mitten im Bild
      const middle = opacity(el);
      await go(top + 1500);
      await go(top - 40); // von unten zurück
      out[sel] = [entering, middle, opacity(el)];
    }
    await go(0);
    document.querySelector('#privat')!.scrollIntoView({ behavior: 'instant' });
    await frame();
    out['anker'] = [opacity(document.querySelector('#privacy-title')!)];
    return out;
  }, selectors);
  for (const sel of selectors) {
    const [entering, middle, back] = result[sel];
    expect(entering, `${sel} beginnt eingeblendet zu werden`).toBeLessThan(1);
    expect(middle, `${sel} mitten im Bild`).toBe(1);
    expect(back, `${sel} beim Zurückscrollen`).toBe(1);
  }
  expect(result['anker'][0]).toBe(1);
});

test('mit „Bewegung reduzieren“ wird nichts eingeblendet', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const sel of ['#areas-title', '.panel__shot']) {
    await expect(page.locator(sel)).toHaveCSS('opacity', '1');
    expect(await page.locator(sel).evaluate((e) => e.getAnimations().length)).toBe(0);
  }
});
