import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function session(page: Page, signedIn = false, onboarding = false) {
  let authenticated = signedIn;
  const auth = { access: 'test', user: { name: 'Mira', email: 'mira@example.com' } };
  const domainCalls: string[] = [];
  await page.route('**/api/v1/**', async (r) => {
    const url = new URL(r.request().url()).pathname;
    if (url.endsWith('/auth/csrf/')) return r.fulfill({ json: { csrfToken: 'test' } });
    if (url.endsWith('/auth/refresh/'))
      return r.fulfill({ status: authenticated ? 200 : 401, json: authenticated ? auth : {} });
    if (url.endsWith('/auth/login/') || url.endsWith('/auth/register/')) {
      authenticated = true;
      return r.fulfill({ json: auth });
    }
    if (url.endsWith('/auth/logout/')) {
      authenticated = false;
      return r.fulfill({ status: 204 });
    }
    if (url.endsWith('/onboarding/profile/'))
      return r.fulfill({ json: { needs_onboarding: onboarding, completed: !onboarding } });
    domainCalls.push(url);
    if (url.includes('/today/'))
      return r.fulfill({ json: { items: [], event_count: 0, task_count: 0 } });
    if (url.includes('/summary/'))
      return r.fulfill({
        json: {
          budget: null,
          total: null,
          available: null,
          saved: '0',
          saved_planned: '0',
          income: '0',
          expenses: '0',
          savings_target: '0',
          savings_current: '0',
          categories: [],
          recent: [],
          has_data: false,
        },
      });
    if (url.includes('/haushalt/')) return r.fulfill({ json: { open_tasks: 0 } });
    return r.fulfill({ json: [] });
  });
  return domainCalls;
}

for (const width of [360, 820, 1440]) {
  test(`public landing explains the product before demo at ${width}px`, async ({ page }) => {
    const calls = await session(page);
    await page.setViewportSize({ width, height: 1000 });
    // Axe prüft den Endzustand: ohne Einblend-Animation, sonst misst es den Kontrast halbtransparenter Abschnitte
    // mitten im Übergang (zufällig, je nach Timing).
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Vier Bereiche für deinen Alltag – und was zusammengehört, ist verbunden.' })).toBeVisible();
    await expect(page.locator('app-dashboard')).toHaveCount(0);
    await expect(page.locator('.demo-banner')).toHaveCount(0);
    expect(calls).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
    await expect(page.getByText('Starte mit dem Bereich, den du brauchst.')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Privat ist die Grundeinstellung.' })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 700));
    expect(Math.abs((await page.locator('header.head').boundingBox())!.y)).toBeLessThan(2);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results/landing-${width}.png`, fullPage: true });
    await page.locator('.hero').getByRole('link', { name: 'Demo ohne Anmeldung testen' }).click();
    await expect(page).toHaveURL('/demo');
    await expect(page.locator('.demo-banner')).toBeVisible();
    await expect(page.getByRole('heading', { name: /^(Guten Morgen|Guten Tag|Guten Abend),? Sophie!$/ })).toBeVisible();
    expect(calls).toEqual([]);
  });
}

test('login returns to root, reload restores real dashboard, logout returns to landing', async ({
  page,
}) => {
  await session(page);
  await page.goto('/login');
  await page.locator('[formControlName="email"]').fill('mira@example.com');
  await page.locator('[formControlName="password"]').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: /^(Guten Morgen|Guten Tag|Guten Abend),? Mira!$/ })).toBeVisible();
  await expect(page.locator('.demo-banner')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: /^(Guten Morgen|Guten Tag|Guten Abend),? Mira!$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Kontomenü' }).click();
  await page.getByRole('menuitem', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('app-landing')).toBeVisible();
});

test('registration routes new accounts to onboarding without app prefix', async ({ page }) => {
  await session(page, false, true);
  await page.goto('/registrieren');
  for (const [field, value] of Object.entries({
    name: 'Mira',
    email: 'mira@example.com',
    password: 'TestPassword123!',
    confirmPassword: 'TestPassword123!',
  }))
    await page.locator(`[formControlName="${field}"]`).fill(value);
  await page.locator('[formControlName="acceptPrivacy"]').check();
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click();
  await expect(page).toHaveURL('/onboarding');
  await expect(page.getByRole('heading', { name: /Willkommen/ })).toBeVisible();
});

test('demo stays isolated for signed-in users and its links stay in demo', async ({ page }) => {
  const calls = await session(page, true);
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: /^(Guten Morgen|Guten Tag|Guten Abend),? Sophie!$/ })).toBeVisible();
  await page.getByRole('link', { name: 'Finanzen', exact: true }).first().click();
  await expect(page).toHaveURL('/demo/finanzen');
  await expect(page.locator('.demo-banner')).toBeVisible();
  expect(calls).toEqual([]);
  await page.goto('/finanzen');
  await expect(page.locator('.demo-banner')).toHaveCount(0);
  await expect(page.getByText('Für', { exact: false }).first()).toBeVisible();
  expect(calls.some((url) => url.includes('/finanzen/private/'))).toBe(true);
});

test('private links require login; legacy bookmarks retain query and fragment', async ({
  page,
}) => {
  await session(page);
  await page.goto('/finanzen');
  await expect(page).toHaveURL('/login');
  await page.goto('/app/finanzen');
  await expect(page).toHaveURL('/login');
  await page.unrouteAll({ behavior: 'wait' });
  await session(page, true);
  await page.goto('/app/finanzen?month=2026-10#budget');
  await expect(page).toHaveURL('/finanzen?month=2026-10#budget');
  await page.goto('/app');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: /^(Guten Morgen|Guten Tag|Guten Abend),? Mira!$/ })).toBeVisible();
});

test('landing: honest story in order, one hero action, real links, no invented claims', async ({ page }) => {
  await session(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Vier Bereiche für deinen Alltag – und was zusammengehört, ist verbunden.');
  const headings = await page.getByRole('heading', { level: 2 }).allInnerTexts();
  const order = ['Vier Apps wissen', 'Probier aus', 'Jeder Bereich hat', 'Privat ist', 'Häufige Fragen', 'Fang mit einem Bereich an'];
  expect(order.map((t) => headings.findIndex((h) => h.replace(/\s+/g, ' ').includes(t)))).toEqual([...order.keys()]);
  // Keine erfundenen Behauptungen: keine Stimmen, Sterne, Nutzerzahlen, Preise, KI
  await expect(page.locator('main')).not.toContainText(/KI|Testimonial|Bewertung|Tausende|kostenlos|gratis|Bank-level|automatisch gebucht/);
  // Ein klarer Aufruf im Hero, echte Ziele
  await expect(page.locator('.hero .btn--ink')).toHaveCount(1);
  // Hauptweg ist die Demo, Registrierung der zweite Weg
  await expect(page.locator('.hero .btn--ink')).toHaveAttribute('href', '/demo');
  await expect(page.locator('.closer').getByRole('link', { name: 'Konto erstellen' })).toHaveAttribute('href', '/registrieren');
  await expect(page.getByRole('link', { name: 'Anmelden' }).first()).toHaveAttribute('href', '/login');
  await expect(page.locator('.hero').getByRole('link', { name: 'Demo ohne Anmeldung testen' })).toHaveAttribute('href', '/demo');
  for (const href of ['/impressum', '/datenschutz', '/nutzungsbedingungen', '/barrierefreiheit'])
    await expect(page.locator(`footer a[href="${href}"]`)).toHaveCount(1);
  // Echte Produktbilder mit Alternativtext und festen Maßen (kein Springen beim Laden)
  for (const img of await page.locator('main img:not([aria-hidden="true"])').evaluateAll((els) => els.map((e) => [e.getAttribute('alt') ?? '', e.getAttribute('width'), e.getAttribute('height')])))
    expect(img[0].length > 20 && !!img[1] && !!img[2]).toBe(true);
});

test('landing: questions open with the keyboard; sharing is explained; no contact section', async ({ page }) => {
  await session(page);
  await page.goto('/');
  const question = page.locator('#fragen details').filter({ hasText: 'Wer sieht meine persönlichen Daten?' });
  await question.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(question).toHaveAttribute('open', '');
  await expect(question).toContainText('Deinen Finanzbereich kann niemand sonst sehen');
  // Die vier Bereiche: Umschalter per Tastatur (Pfeiltasten), jeder Bereich führt in seine Demo
  const tabs = page.getByRole('tablist', { name: 'Bereiche' }).getByRole('tab');
  await expect(tabs).toHaveCount(4);
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Haushalt' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Haushalt' })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('Gemeinsame Einkaufsliste');
  await expect(page.getByRole('tabpanel').getByRole('link', { name: 'Haushalt in der Demo ansehen' })).toHaveAttribute('href', '/demo/haushalt');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Reisen' })).toHaveAttribute('aria-selected', 'true');
  // Teilen: Finanzen sind nicht teilbar, Verknüpfen ändert keine Rechte (als Beispiel gezeigt)
  await expect(page.locator('#privat .share')).toContainText('Nicht teilbar');
  await expect(page.locator('#privat .share')).toContainText('ändert keine Rechte');
  // Kein Kontaktbereich mehr auf der Startseite und kein Kontakt-Link im Fuß
  await expect(page.locator('#kontakt')).toHaveCount(0);
  await expect(page.locator('footer a[href="/kontakt"]')).toHaveCount(0);
});

test('landing: nothing waits on motion; the product picture is visible at once, also with reduced motion', async ({ page }) => {
  await session(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  // Inhalte sind nie versteckt: die einzige Bewegung (Produktbild setzt sich) läuft nur über transform
  for (const sel of ['.hero h1', '.stage__desk', '.stage__phone', '#fragen .question'])
    await expect(page.locator(sel).first()).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  // Namen statt Anzahl: schlägt es fehl, steht direkt da, was sich bewegt
  // Gemeint ist Bewegung: reine Farbwechsel (Hintergrund, Schrift, Rand) beim Laden sind kein Bewegungsreiz
  const running = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === 'running')
      .filter((a) => !(a instanceof CSSTransition && /color|shadow/.test(a.transitionProperty)))
      // „Bewegung reduzieren“ setzt Übergänge global auf 0,01 ms – Safari meldet die kurz als laufend, sichtbar ist nichts
      .filter((a) => Number(a.effect?.getComputedTiming().duration ?? 0) >= 1)
      .map((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
        const name = a instanceof CSSTransition ? a.transitionProperty : a instanceof CSSAnimation ? a.animationName : a.id;
        return `${name} @ ${target?.tagName.toLowerCase()}.${target?.classList[0] ?? ''}`;
      }),
  );
  expect(running).toEqual([]);
  await expect(page.locator('.stage__desk')).toBeVisible();
});

test('landing on a phone (390 px): no sideways scrolling, big tap targets, the product and the example chain fit', async ({ page }) => {
  await session(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Am Handy zeigt die Bühne das Handy-Bild, und es beginnt schon im ersten Bildschirm; das Rechner-Bild entfällt
  expect(await page.locator('.stage__phone').evaluate((e) => e.getBoundingClientRect().top < innerHeight)).toBe(true);
  await expect(page.locator('.stage__desk')).toBeHidden();
  // Die Verknüpfungs-Probe bleibt im Bildschirm
  for (const box of await page.locator('#verknuepfen .sug, #verknuepfen .source').evaluateAll((els) => els.map((e) => e.getBoundingClientRect())))
    expect(box.left >= 0 && box.right <= 390).toBe(true);
  const small = await page.locator('main a, main button, main summary, header a').evaluateAll((els) =>
    // Links mitten im Fließtext sind ausgenommen (WCAG 2.5.8, Inline-Ausnahme)
    els.filter((e) => getComputedStyle(e).display !== 'inline' && e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 44).map((e) => e.textContent?.trim()),
  );
  expect(small).toEqual([]);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

test('landing: visitors link two entries themselves and see the line, the count and the reason', async ({ page }) => {
  await session(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const play = page.locator('#verknuepfen');
  // Erst die Reise anlegen, dann erscheinen die Vorschläge; der Fokus folgt
  await play.getByRole('button', { name: 'Reise anlegen' }).click();
  await expect(play.locator('.suggestions__label').first()).toBeFocused();
  const hotel = play.getByRole('button', { name: 'Verknüpfen: Hotel in Berlin bestätigen' });
  await hotel.click();
  await expect(play.getByRole('button', { name: 'Verbindung lösen: Hotel in Berlin bestätigen' })).toBeVisible();
  await expect(play.locator('.source__count')).toHaveText('Verknüpft mit 1 Eintrag');
  await expect(play.locator('app-animated-beam svg')).toHaveCount(1);
  await play.getByRole('button', { name: 'Ein Gerät' }).click();
  await expect(play.getByRole('button', { name: 'Ein Gerät' })).toHaveAttribute('aria-pressed', 'true');
  await expect(play.locator('.suggestions')).toContainText('Das Sparziel nennt das Gerät beim Namen.');
  await expect(play.locator('.sug--skipped')).toContainText('Neue Spülmaschine');
  // Farbwechsel der Auswahlknöpfe erst ausklingen lassen – sonst misst axe eine Zwischenfarbe (fiel in WebKit auf)
  await page.waitForFunction(() => document.getAnimations().every((a) => !(a instanceof CSSTransition) || a.playState !== 'running'));
  expect((await new AxeBuilder({ page }).include('#verknuepfen').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);
});

