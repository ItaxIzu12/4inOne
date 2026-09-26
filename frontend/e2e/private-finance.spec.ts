import { test, expect } from '@playwright/test';
import { choose, pickDate, pickMonth } from './helpers';
import AxeBuilder from '@axe-core/playwright';
for (const width of [390, 1440]) {
  test(`private finance lifecycle ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 'test' } }));
    await page.route('**/api/v1/auth/refresh/', (r) =>
      r.fulfill({ json: { access: 'test', user: { name: 'Mira', email: 'mira@example.com' } } }),
    );
    await page.route('**/api/v1/onboarding/profile/', (r) =>
      r.fulfill({ json: { needs_onboarding: false, completed: true } }),
    );
    await page.route('**/api/v1/organisation/today/**', (r) =>
      r.fulfill({ json: { items: [], event_count: 0 } }),
    );
    const data: { [key: string]: any[] } = {
      transactions: [],
      budgets: [],
      goals: [],
      categories: [],
    };
    let next = 1;
    await page.route('**/api/v1/finanzen/private/**', async (r) => {
      // Vorschau vor dem Speichern eines Sparziels: hier ohne Warnung, und sie legt nichts an
      if (new URL(r.request().url()).pathname.endsWith('/preview/'))
        return r.fulfill({ json: { month_over: null, plan_alert: null } });
      const url = new URL(r.request().url()),
        parts = url.pathname.split('/').filter(Boolean),
        resource = parts[4],
        method = r.request().method();
      if (resource === 'summary') {
        const month = url.searchParams.get('month');
        const rows = data['transactions'].filter((t) => t.date.startsWith(month));
        const expense = rows
          .filter((t) => t.type === 'EXPENSE')
          .reduce((a, t) => a + Number(t.amount), 0);
        const income = rows
          .filter((t) => t.type === 'INCOME')
          .reduce((a, t) => a + Number(t.amount), 0);
        // wie backend MonthlyBudget.for_month: später beginnendes Budget gewinnt, sofern es den Monat abdeckt
        const budget = data['budgets']
          .filter((b) => {
            const start = b.month.slice(0, 7);
            return month >= start && (b.open_ended || month <= (b.end_month ? b.end_month.slice(0, 7) : start));
          })
          .sort((a, b) => b.month.localeCompare(a.month))[0];
        return r.fulfill({
          json: {
            month,
            currency: 'EUR',
            budget: budget?.amount || null,
            total: budget ? (Number(budget.amount) + income).toFixed(2) : null,
            // vereinfacht: das Gesparte aller Ziele zählt im laufenden Monat (das echte Backend rechnet über Einzahlungen)
            saved: data['goals'].reduce((a, g) => a + Number(g.current_amount), 0).toFixed(2),
            available: budget
              ? (
                  Number(budget.amount) +
                  income -
                  expense -
                  data['goals'].reduce((a, g) => a + Number(g.current_amount), 0)
                ).toFixed(2)
              : null,
            income: income.toFixed(2),
            expenses: expense.toFixed(2),
            savings_target: data['goals']
              .reduce((a, g) => a + Number(g.target_amount), 0)
              .toFixed(2),
            savings_current: data['goals']
              .reduce((a, g) => a + Number(g.current_amount), 0)
              .toFixed(2),
            has_data: !!(budget || rows.length || data['goals'].length),
            categories: expense ? [{ name: 'Lebensmittel', amount: expense.toFixed(2) }] : [],
            recent: rows.slice(0, 5),
          },
        });
      }
      if (parts.at(-1) === 'setup') {
        data['categories'] = [
          { id: 1, name: 'Lebensmittel' },
          { id: 2, name: 'Sonstiges' },
        ];
        return r.fulfill({ json: data['categories'] });
      }
      const covers = (g: any, m: string) => {
        if (!g.plan_month) return true;
        const start = g.plan_month.slice(0, 7);
        return m >= start && (g.plan_open_ended || m <= (g.plan_end_month ? g.plan_end_month.slice(0, 7) : start));
      };
      const rows = data[resource],
        id = Number(parts[5]);
      if (resource === 'goals' && method === 'GET' && url.searchParams.get('month'))
        return r.fulfill({ json: rows.filter((g) => covers(g, url.searchParams.get('month')!)) });
      if (method === 'POST') {
        const entry = { id: next++, ...r.request().postDataJSON() };
        rows.push(entry);
        return r.fulfill({ status: 201, json: entry });
      }
      if (method === 'PATCH') {
        const entry = rows.find((x) => x.id === id);
        Object.assign(entry, r.request().postDataJSON());
        return r.fulfill({ json: entry });
      }
      if (method === 'DELETE') {
        rows.splice(
          rows.findIndex((x) => x.id === id),
          1,
        );
        return r.fulfill({ status: 204 });
      }
      return r.fulfill({ json: rows });
    });
    await page.goto('/app/finanzen');
    await expect(page.getByRole('heading', { name: 'Finanzen', exact: true })).toBeVisible();
    await expect(page.getByText(/gibt es kein Budget\.\s+Lege eines fest/)).toBeVisible();
    await page.getByRole('button', { name: 'Budget erstellen', exact: true }).click();
    await page.getByLabel('Budgetbetrag in EUR').fill('3000,00');
    // Zeitraum: Endmonat vor dem Start wird abgelehnt, „bis auf Weiteres“ gilt auch im Folgemonat
    await choose(page, 'Gilt für', 'Mehrere Monate');
    // Monate vor dem Startmonat sind im Kalender nicht wählbar; ohne Endmonat wird nicht gespeichert
    await page.getByLabel('Bis einschließlich').click();
    await expect(page.getByRole('button', { name: 'Januar 2026', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Endmonat, der nicht vor dem Startmonat liegt');
    await choose(page, 'Gilt für', 'Bis auf Weiteres');
    await expect(page.getByLabel('Bis einschließlich')).toHaveCount(0);
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.month-card')).toContainText('3.000,00 €');
    const today = new Date();
    const following = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonth = `${following.getFullYear()}-${String(following.getMonth() + 1).padStart(2, '0')}`;
    await pickMonth(page, page.locator('#finance-month'), nextMonth);
    await expect(page.locator('.month-card')).toContainText('3.000,00 €');
    await page.getByRole('button', { name: 'Budgets', exact: true }).click();
    await expect(page.locator('.tl__bar.is-active')).toContainText(/unbefristet/);
    await pickMonth(page, page.locator('#finance-month'), `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
    await page.getByRole('button', { name: 'Neue Buchung', exact: true }).click();
    await page.getByLabel('Betrag in EUR', { exact: true }).fill('48,32');
    await page.getByRole('button', { name: 'Standardkategorien anlegen' }).click();
    await page.getByLabel('Notiz (optional)').fill('Supermarkt');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.locator('.month-card')).toContainText('2.951,68 €');
    await page.getByRole('button', { name: /Supermarkt/ }).click();
    await page.getByLabel('Betrag in EUR', { exact: true }).fill('50,00');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await page.getByRole('button', { name: 'Neue Buchung', exact: true }).click();
    await choose(page, 'Typ', 'Einnahme');
    await page.getByLabel('Betrag in EUR', { exact: true }).fill('3100');
    await page.getByLabel('Notiz (optional)').fill('Gehalt');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    // Einnahme erhöht das verfügbare Budget und wird sichtbar bestätigt
    await expect(page.locator('.month-card')).toContainText('6.050,00 €');
    const calc = page.locator('.month-card .calc');
    await expect(calc).toContainText('Budget3.000,00 €');
    await expect(calc).toContainText('+ Einnahmen3.100,00 €');
    await expect(calc).toContainText('− Ausgaben50,00 €');
    await expect(calc).toContainText('= Verfügbar6.050,00 €');
    await expect(page.getByRole('status').filter({ hasText: 'Einnahme' })).toContainText(
      'Einnahme von 3.100,00 € gespeichert. Verfügbar: 6.050,00 €.',
    );
    await page.getByRole('button', { name: 'Sparziele', exact: true }).click();
    await page.getByRole('button', { name: 'Sparziel erstellen', exact: true }).click();
    await page.getByLabel('Titel', { exact: true }).fill('Neue Waschmaschine');
    await page.getByLabel('Zielbetrag in EUR').fill('700');
    // Gespartes darf das Sparziel nicht überschreiten
    await page.getByLabel('Bereits gespart in EUR').fill('800');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(
      'Der gesparte Betrag darf das Sparziel nicht überschreiten. Erhöhe zuerst das Sparziel.',
    );
    await page.getByLabel('Bereits gespart in EUR').fill('480');
    // Sparrate mit Zeitraum: nicht höher als das Ziel, Zeitraum erscheint erst mit einer Rate
    // Der Zeitraum gehört zum Ziel und ist immer da, auch ohne Sparrate; Standard: nur dieser Monat
    await expect(page.getByLabel('Ab Monat')).toBeVisible();
    await expect(page.getByLabel('Gilt für', { exact: true })).toContainText('Nur diesen Monat');
    await page.getByLabel('Sparrate pro Monat').fill('800');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Die Sparrate darf nicht höher sein als das Sparziel.');
    await page.getByLabel('Sparrate pro Monat').fill('50');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.locator('.goal')).toContainText('69 % erreicht');
    await expect(page.locator('.goal .plan')).toContainText(/50,00 € pro Monat · Nur \d\d\.\d{4}/);
    // Ein Ziel gilt nur in seinem Zeitraum: im Folgemonat ist es weg …
    const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    await pickMonth(page, page.locator('#finance-month'), nextMonth);
    await expect(page.locator('.goal')).toHaveCount(0);
    await expect(page.getByText('Für diesen Monat gibt es noch kein Sparziel')).toBeVisible();
    // … außer man wählt ausdrücklich „Bis auf Weiteres“
    await pickMonth(page, page.locator('#finance-month'), thisMonth);
    await page.locator('.goal').click();
    await choose(page, 'Gilt für', 'Bis auf Weiteres');
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await pickMonth(page, page.locator('#finance-month'), nextMonth);
    await expect(page.locator('.goal')).toHaveCount(1);
    await expect(page.locator('.goal .plan')).toContainText(/Ab \d\d\.\d{4}, bis auf Weiteres/);
    await pickMonth(page, page.locator('#finance-month'), thisMonth);
    await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
    // Gespartes mindert das verfügbare Budget und steht in der Aufschlüsselung
    await expect(page.locator('.month-card')).toContainText('5.570,00 €');
    await expect(page.locator('.month-card .calc')).toContainText('− Gespart480,00 €');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `test-results/finance-${width}.png`, fullPage: true });
    await page.goto('/app');
    await expect(page.locator('.domain.finance')).toContainText('5.570,00 € verfügbar');
    await page.locator('.domain.finance').click();
    await page.getByRole('button', { name: /Supermarkt/ }).click();
    await page.getByRole('button', { name: 'Eintrag löschen', exact: true }).click();
    await page.getByRole('button', { name: 'Ja, löschen', exact: true }).click();
    await expect(page.locator('.month-card')).toContainText('5.620,00 €');
    await expect(page.getByRole('status').filter({ hasText: 'gelöscht' })).toContainText('Buchung gelöscht. Verfügbar: 5.620,00 €.');
  });
}

test('warns before an expense exceeds the available budget and books it only after confirmation', async ({ page }) => {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira', email: 'm@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  const spent: number[] = [];
  const total = () => spent.reduce((a, b) => a + b, 0);
  let posts = 0;
  await page.route('**/api/v1/finanzen/private/**', async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith('/summary/')) {
      return r.fulfill({
        json: {
          month: '2026-09', currency: 'EUR', budget: '100.00', total: '100.00', saved: '0.00', saved_planned: '0.00',
          available: (100 - total()).toFixed(2), income: '0.00', expenses: total().toFixed(2),
          savings_target: '0.00', savings_current: '0.00', has_data: true, categories: [], recent: [],
        },
      });
    }
    if (path.endsWith('/categories/')) return r.fulfill({ json: [{ id: 1, name: 'Wohnen' }] });
    if (path.endsWith('/transactions/') && r.request().method() === 'POST') {
      posts++;
      spent.push(Number(r.request().postDataJSON().amount));
      return r.fulfill({ status: 201, json: { id: posts } });
    }
    return r.fulfill({ json: [] });
  });

  await page.goto('/app/finanzen');
  await expect(page.locator('.month-card')).toContainText('100,00 €');
  await page.getByRole('button', { name: 'Neue Buchung', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Betrag in EUR', { exact: true }).fill('150');
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();

  // Nichts gebucht, dafür Warnung mit den Zahlen und ein bewusster Button
  await expect(dialog.getByRole('alert')).toContainText('überschreitet dein verfügbares Budget um 50,00 €');
  await expect(dialog.getByRole('alert')).toContainText('Verfügbar sind 100,00 €');
  await expect(dialog.getByRole('button', { name: 'Trotzdem buchen', exact: true })).toBeVisible();
  expect(posts).toBe(0);

  // Betrag ändern nimmt die Warnung zurück; ein Betrag im Rahmen wird ohne Rückfrage gebucht
  await dialog.getByLabel('Betrag in EUR', { exact: true }).fill('20');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(posts).toBe(1);
  await expect(page.locator('.month-card')).toContainText('80,00 €');
  await expect(page.locator('.overrun-note')).toHaveCount(0);
  await expect(page.locator('.month-card progress')).not.toHaveClass(/over/);

  // Jetzt 150 € bei 80 € verfügbar: Warnung, Bestätigung, gebucht — und danach deutlich sichtbar im Minus
  await page.getByRole('button', { name: 'Neue Buchung', exact: true }).click();
  await dialog.getByLabel('Betrag in EUR', { exact: true }).fill('150');
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('um 70,00 €');
  await dialog.getByRole('button', { name: 'Trotzdem buchen', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(posts).toBe(2);
  await expect(page.locator('.month-card .overrun-note')).toContainText('Budget überschritten');
  await expect(page.locator('.month-card .overrun-note')).toContainText('70,00 €');
  // Balken wird rot und sagt es auch in Worten (Farbe allein reicht nicht)
  await expect(page.locator('.month-card progress')).toHaveClass(/over/);
  await expect(page.locator('.month-card progress')).toHaveAttribute('aria-label', 'Verfügbares Budget überschritten');
  await expect(page.getByRole('status').filter({ hasText: 'Achtung' })).toContainText('Achtung: Du liegst 70,00 € über deinem verfügbaren Budget.');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});

test('an income never triggers the overrun warning', async ({ page }) => {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira', email: 'm@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  let posted = 0;
  await page.route('**/api/v1/finanzen/private/**', async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith('/summary/'))
      return r.fulfill({ json: { month: '2026-09', currency: 'EUR', budget: '10.00', total: '10.00', saved: '0.00', saved_planned: '0.00', available: '10.00', income: '0.00', expenses: '0.00', savings_target: '0.00', savings_current: '0.00', has_data: true, categories: [], recent: [] } });
    if (path.endsWith('/categories/')) return r.fulfill({ json: [{ id: 1, name: 'Wohnen' }] });
    if (path.endsWith('/transactions/') && r.request().method() === 'POST') { posted++; return r.fulfill({ status: 201, json: { id: 1 } }); }
    return r.fulfill({ json: [] });
  });
  await page.goto('/app/finanzen');
  await page.getByRole('button', { name: 'Neue Buchung', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await choose(page, 'Typ', 'Einnahme');
  await dialog.getByLabel('Betrag in EUR', { exact: true }).fill('5000');
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(posted).toBe(1);
});

test('warns when the savings rates together exceed the budget, even in a later month', async ({ page }) => {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira', email: 'm@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  let alert: { month: string; over: string; planned: string } | null = { month: '2026-11', over: '30.00', planned: '130.00' };
  let available = '100.00';
  await page.route('**/api/v1/finanzen/private/**', async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith('/summary/'))
      return r.fulfill({ json: { month: '2026-09', currency: 'EUR', budget: '100.00', total: '100.00', saved: '60.00', saved_planned: '60.00', available, plan_alert: alert, income: '0.00', expenses: '0.00', savings_target: '2000.00', savings_current: '0.00', has_data: true, categories: [], recent: [] } });
    if (path.endsWith('/budgets/')) return r.fulfill({ json: [{ id: 1, month: '2026-09-01', end_month: null, open_ended: true, amount: '100.00', currency: 'EUR' }] });
    return r.fulfill({ json: [] });
  });
  await page.goto('/app/finanzen');
  const note = page.locator('.month-card .overrun-note');
  await expect(note).toContainText('Sparraten zu hoch');
  await expect(note).toContainText('Im 11.2026 reichen Budget und Einnahmen nicht für alle Sparraten: Es fehlen 30,00 €.');
  await expect(page.locator('.month-card progress')).not.toHaveClass(/over/); // im Moment noch im Plus
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);

  await page.getByRole('button', { name: 'Budgets', exact: true }).click();
  await expect(page.locator('.overrun-note')).toContainText('Sparraten zu hoch');

  // Betrifft es den angezeigten Monat, sagt der Hinweis „In diesem Monat“
  alert = { month: '2026-09', over: '10.00', planned: '110.00' };
  await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
  await page.reload();
  await expect(page.locator('.month-card .overrun-note')).toContainText('In diesem Monat reichen Budget und Einnahmen nicht für alle Sparraten');

  // Kein Alarm: kein Hinweis. Und ist das Budget ohnehin im Minus, gilt nur die Überschreitungs-Meldung (kein Doppelhinweis)
  alert = null;
  await page.reload();
  await expect(page.locator('.month-card .overrun-note')).toHaveCount(0);
  alert = { month: '2026-09', over: '10.00', planned: '110.00' };
  available = '-10.00';
  await page.reload();
  await expect(page.locator('.month-card .overrun-note')).toHaveCount(1);
  await expect(page.locator('.month-card .overrun-note')).toContainText('Budget überschritten');
});


test('warns BEFORE saving a savings goal that exceeds the budget and saves only after confirmation', async ({ page }) => {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira', email: 'm@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  const previews: any[] = [];
  const created: any[] = [];
  await page.route('**/api/v1/finanzen/private/**', async (r) => {
    const path = new URL(r.request().url()).pathname;
    const method = r.request().method();
    if (path.endsWith('/goals/preview/')) {
      const body = r.request().postDataJSON();
      previews.push(body);
      // wie das Backend: 150 € Gespartes bei 100 € verfügbar sprengt das Budget, eine Rate ab nächstem Monat ebenfalls
      const over = Number(body.current_amount) > 100;
      return r.fulfill({
        json: {
          month_over: over ? { month: '2026-09', over: (Number(body.current_amount) - 100).toFixed(2) } : null,
          plan_alert: Number(body.monthly_amount) === 120 ? { month: '2026-11', over: '20.00', planned: '120.00' } : null,
        },
      });
    }
    if (path.endsWith('/goals/') && method === 'POST') {
      created.push(r.request().postDataJSON());
      return r.fulfill({ status: 201, json: { id: created.length, ...r.request().postDataJSON() } });
    }
    if (path.endsWith('/summary/'))
      return r.fulfill({ json: { month: '2026-09', currency: 'EUR', budget: '100.00', total: '100.00', saved: '0.00', saved_planned: '0.00', available: '100.00', plan_alert: null, income: '0.00', expenses: '0.00', savings_target: '0.00', savings_current: '0.00', has_data: true, categories: [], recent: [] } });
    return r.fulfill({ json: [] });
  });

  await page.goto('/app/finanzen');
  await page.getByRole('button', { name: 'Sparziele', exact: true }).click();
  await page.getByRole('button', { name: 'Sparziel erstellen', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titel', { exact: true }).fill('Auto');
  await dialog.getByLabel('Zielbetrag in EUR').fill('5000');
  await dialog.getByLabel('Bereits gespart in EUR').fill('150');
  // Es gibt nur noch den Zeitraum (Ab Monat / Gilt für), kein zweites „Zieldatum“
  await expect(dialog.getByLabel('Zieldatum')).toHaveCount(0);
  await expect(dialog.getByLabel('Gilt für')).toBeVisible();
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();

  // Warnung erscheint im Dialog, VOR dem Speichern: noch nichts angelegt
  await expect(dialog.getByRole('alert')).toContainText('Das überschreitet dein Budget.');
  await expect(dialog.getByRole('alert')).toContainText('In diesem Monat reicht dein verfügbares Budget dafür nicht: Es fehlen 50,00 €.');
  await expect(dialog.getByRole('button', { name: 'Trotzdem speichern', exact: true })).toBeVisible();
  expect(created).toHaveLength(0);
  expect((await new AxeBuilder({ page }).include('[role=dialog]').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

  // Betrag anpassen: Warnung weg; im Rahmen wird ohne Rückfrage gespeichert
  await dialog.getByLabel('Bereits gespart in EUR').fill('100');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(created).toHaveLength(1);
  expect(created[0].current_amount).toBe('100.00');

  // Sparrate, die in einem späteren Monat nicht mehr reicht → Warnung nennt den Monat; „Trotzdem speichern“ speichert
  await page.getByRole('button', { name: 'Sparziel erstellen', exact: true }).click();
  await dialog.getByLabel('Titel', { exact: true }).fill('Reise');
  await dialog.getByLabel('Zielbetrag in EUR').fill('5000');
  await dialog.getByLabel('Sparrate pro Monat').fill('120');
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Im 11.2026 reichen Budget und Einnahmen nicht für alle Sparraten: Es fehlen 20,00 €.');
  expect(created).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Trotzdem speichern', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(created).toHaveLength(2);
  expect(previews).toHaveLength(3);
});


test('a goal for another month is saved but not shown, and says so', async ({ page }) => {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira', email: 'm@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  const created: any[] = [];
  await page.route('**/api/v1/finanzen/private/**', async (r) => {
    const path = new URL(r.request().url()).pathname;
    const method = r.request().method();
    if (path.endsWith('/goals/preview/')) return r.fulfill({ json: { month_over: null, plan_alert: null } });
    if (path.endsWith('/goals/') && method === 'POST') {
      created.push(r.request().postDataJSON());
      return r.fulfill({ status: 201, json: { id: 1, ...r.request().postDataJSON() } });
    }
    if (path.endsWith('/goals/')) return r.fulfill({ json: [] }); // Liste des angezeigten Monats bleibt leer
    if (path.endsWith('/summary/'))
      return r.fulfill({ json: { month: '2026-09', currency: 'EUR', budget: null, total: null, saved: '0.00', saved_planned: '0.00', available: null, plan_alert: null, income: '0.00', expenses: '0.00', savings_target: '0.00', savings_current: '0.00', has_data: true, categories: [], recent: [] } });
    return r.fulfill({ json: [] });
  });
  await page.goto('/app/finanzen');
  await page.getByRole('button', { name: 'Sparziele', exact: true }).click();
  await page.getByRole('button', { name: 'Sparziel erstellen', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titel', { exact: true }).fill('Urlaub');
  await dialog.getByLabel('Zielbetrag in EUR').fill('900');
  await pickMonth(page, dialog.getByLabel('Ab Monat'), '2031-07');
  await choose(page, 'Gilt für', 'Mehrere Monate');
  // Vor dem Start liegende Monate sind im Kalender gar nicht wählbar
  await dialog.getByLabel('Bis einschließlich').click();
  await expect(page.getByRole('button', { name: 'Mai 2031', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Juli 2031', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape'); // schließt nur den Kalender, der Dialog bleibt
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(dialog).toContainText('einen Endmonat, der nicht davor liegt'); // ohne Endmonat kein Speichern
  expect(created).toHaveLength(0);
  await pickMonth(page, dialog.getByLabel('Bis einschließlich'), '2031-09');
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ plan_month: '2031-07-01', plan_end_month: '2031-09-01', plan_open_ended: false });
  await expect(page.getByRole('status').filter({ hasText: 'Sparziel gespeichert' })).toContainText(
    'Es gilt nicht im angezeigten Monat und erscheint erst im Zeitraum: 07.2031 bis 09.2031.',
  );
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});

// ---------------------------------------------------------------------------
// Ein Monatswähler für alle Reiter; Verhalten der Auswahlfenster
// ---------------------------------------------------------------------------

const SEP = '2026-09';
const OCT = '2026-10';

async function mockTwoMonths(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/auth/csrf/', (r) => r.fulfill({ json: { csrfToken: 't' } }));
  await page.route('**/api/v1/auth/refresh/', (r) => r.fulfill({ json: { access: 't', user: { name: 'Mira', email: 'm@example.com' } } }));
  await page.route('**/api/v1/onboarding/profile/', (r) => r.fulfill({ json: { needs_onboarding: false, completed: true } }));
  const tx = [
    { id: 1, amount: '10.00', type: 'EXPENSE', category: 1, date: `${SEP}-05`, note: 'Septemberkauf', currency: 'EUR' },
    { id: 2, amount: '20.00', type: 'EXPENSE', category: 1, date: `${OCT}-05`, note: 'Oktoberkauf', currency: 'EUR' },
  ];
  const goals = [
    { id: 1, title: 'Nur September', target_amount: '100.00', current_amount: '0.00', status: 'ACTIVE', currency: 'EUR', monthly_amount: null, plan_month: `${SEP}-01`, plan_end_month: null, plan_open_ended: false },
    { id: 2, title: 'Ab Oktober', target_amount: '200.00', current_amount: '0.00', status: 'ACTIVE', currency: 'EUR', monthly_amount: null, plan_month: `${OCT}-01`, plan_end_month: null, plan_open_ended: true },
  ];
  await page.route('**/api/v1/finanzen/private/**', async (r) => {
    const url = new URL(r.request().url());
    const path = url.pathname;
    const month = url.searchParams.get('month') ?? SEP;
    if (path.endsWith('/summary/')) {
      const spent = month === SEP ? 10 : 20;
      return r.fulfill({ json: { month, currency: 'EUR', budget: '100.00', total: '100.00', saved: '0.00', saved_planned: '0.00', available: (100 - spent).toFixed(2), plan_alert: null, income: '0.00', expenses: spent.toFixed(2), savings_target: '0.00', savings_current: '0.00', has_data: true, categories: [], recent: tx.filter((t) => t.date.startsWith(month)) } });
    }
    if (path.endsWith('/transactions/')) return r.fulfill({ json: tx });
    if (path.endsWith('/goals/')) {
      const covers = (g: (typeof goals)[number]) => month >= g.plan_month.slice(0, 7) && (g.plan_open_ended || month <= g.plan_month.slice(0, 7));
      return r.fulfill({ json: goals.filter(covers) });
    }
    if (path.endsWith('/budgets/')) return r.fulfill({ json: [{ id: 1, month: `${SEP}-01`, end_month: null, open_ended: true, amount: '100.00', currency: 'EUR' }] });
    if (path.endsWith('/categories/')) return r.fulfill({ json: [{ id: 1, name: 'Wohnen', color: '#a8452f' }] });
    return r.fulfill({ json: [] });
  });
}

test('there is exactly one month selector and every tab follows it', async ({ page }) => {
  await mockTwoMonths(page);
  await page.goto('/app/finanzen');
  const selector = page.locator('#finance-month');
  await expect(selector).toHaveCount(1);
  await expect(page.locator('.month-card')).toContainText('90,00 €'); // September: 100 − 10

  // Der Monat gilt für die ganze Seite und steht deshalb OBERHALB der Reiter
  const monthBox = (await selector.boundingBox())!;
  const tabsBox = (await page.locator('nav.tabs').boundingBox())!;
  expect(monthBox.y + monthBox.height).toBeLessThanOrEqual(tabsBox.y);

  for (const tab of ['Buchungen', 'Budgets', 'Sparziele', 'Übersicht']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(selector).toHaveCount(1); // in jedem Reiter derselbe, nie doppelt
  }

  await pickMonth(page, selector, OCT);
  await expect(selector).toContainText('Oktober 2026');
  await expect(page.locator('.month-card')).toContainText('80,00 €'); // Oktober: 100 − 20 (Übersicht)

  await page.getByRole('button', { name: 'Buchungen', exact: true }).click();
  await expect(page.getByRole('button', { name: /Oktoberkauf/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Septemberkauf/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Sparziele', exact: true }).click();
  await expect(page.locator('.goal')).toHaveCount(1);
  await expect(page.locator('.goal')).toContainText('Ab Oktober');

  await page.getByRole('button', { name: 'Budgets', exact: true }).click();
  await expect(page.locator('.card').first()).toContainText('Budget im Oktober 2026');
  await expect(page.locator('.card').first()).not.toContainText('Verfügbar');

  // zurück in den September: alles springt mit
  await pickMonth(page, selector, SEP);
  await page.getByRole('button', { name: 'Sparziele', exact: true }).click();
  await expect(page.locator('.goal')).toContainText('Nur September');
  await page.getByRole('button', { name: 'Buchungen', exact: true }).click();
  await expect(page.getByRole('button', { name: /Septemberkauf/ })).toBeVisible();
});

test('an empty goal list is centered on the whole card without touching the two-column grid', async ({ page }) => {
  await mockTwoMonths(page);
  await page.goto('/app/finanzen');
  await page.getByRole('button', { name: 'Sparziele', exact: true }).click();
  await pickMonth(page, page.locator('#finance-month'), '2027-05'); // kein Ziel gilt hier mehr? „Ab Oktober“ gilt offen → 2026-08 ist leer
  await pickMonth(page, page.locator('#finance-month'), '2026-08');
  const empty = page.locator('.goal-grid > .empty');
  await expect(empty).toContainText('Für diesen Monat gibt es noch kein Sparziel');
  const card = await page.locator('.goal-grid').boundingBox();
  const box = await empty.boundingBox();
  expect(Math.abs(box!.x + box!.width / 2 - (card!.x + card!.width / 2))).toBeLessThan(2); // mittig
  expect(box!.width).toBeGreaterThan(card!.width - 2); // über beide Spalten
});

test('month picker: the selected month stays readable on hover, presses that slip outside do not close it, scrolling closes it', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 420 }); // niedrig, damit die Seite scrollbar ist
  await mockTwoMonths(page);
  await page.goto('/app/finanzen');
  await page.locator('#finance-month').click();
  const panel = page.locator('.dp__panel:has(.dp__title)');
  await expect(panel).toBeVisible();

  // Hover auf dem gewählten Monat: Hintergrund bleibt das kräftige Grün, Schrift weiß
  const selected = panel.locator('.dp__cell.is-selected');
  await selected.hover();
  await expect(selected).toHaveCSS('background-color', 'rgb(30, 122, 77)');
  await expect(selected).toHaveCSS('color', 'rgb(255, 255, 255)');
  // andere Monate bekommen beim Hover den hellen Ton
  const other = panel.locator('.dp__cell:not(.is-selected):not(:disabled)').first();
  await other.hover();
  await expect(other).toHaveCSS('background-color', 'rgb(227, 246, 236)');

  // gedrückt im Kalender, losgelassen daneben: bleibt offen und wählt nichts
  const box = (await selected.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(20, 20);
  await page.mouse.up();
  await expect(panel).toBeVisible();
  await expect(page.locator('#finance-month')).toContainText('September 2026');

  // Klick wirklich daneben (gedrückt und losgelassen außerhalb) schließt weiterhin
  await page.mouse.click(20, 20);
  await expect(panel).toHaveCount(0);

  // Scrollen außerhalb schließt den Kalender, er bleibt nicht vom Feld gelöst stehen
  await page.locator('#finance-month').click();
  await expect(panel).toBeVisible();
  await page.waitForTimeout(350);
  await page.evaluate(() => window.scrollTo(0, 250));
  await expect(panel).toHaveCount(0);
});

test('budget timeline replaces the list: bar spans its months, click on the active bar edits, a dialog survives a click outside', async ({ page }) => {
  await mockTwoMonths(page);
  await page.goto('/app/finanzen');
  await page.getByRole('button', { name: 'Budgets', exact: true }).click();
  const timeline = page.locator('app-budget-timeline');
  await expect(timeline).toBeVisible();
  await expect(page.getByText('Alle Budgets')).toHaveCount(0);
  const bar = timeline.locator('.tl__bar.is-active');
  await expect(bar).toContainText('gilt im gewählten Monat');
  expect((await new AxeBuilder({ page }).include('app-budget-timeline').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([]);

  // Balken sind reine Anzeige: ein Klick darauf öffnet nichts (kein Fehlgriff auf falsche Werte)
  await bar.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Dialog nur über „Budget ändern“; Klick daneben schließt ihn NICHT, Escape schon
  await page.getByRole('button', { name: 'Budget ändern', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('a new booking proposes a date inside the selected month', async ({ page }) => {
  await mockTwoMonths(page);
  await page.goto('/app/finanzen');
  const selector = page.locator('#finance-month');
  for (const [month, expected] of [['2099-03', '01.03.2099'], ['2020-02', '29.02.2020']]) {
    await pickMonth(page, selector, month);
    await page.getByRole('button', { name: 'Neue Buchung', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(expected);
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }
});

test('saving a booking dated outside the shown month says where it went, inside the month it stays quiet', async ({ page }) => {
  await mockTwoMonths(page);
  await page.goto('/app/finanzen');
  await pickMonth(page, page.locator('#finance-month'), '2099-03');
  const notice = page.locator('app-save-feedback');

  await page.getByRole('button', { name: 'Neue Buchung', exact: true }).click();
  await page.getByLabel('Betrag in EUR', { exact: true }).fill('12');
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(notice).toContainText('Ausgabe von 12,00 € gespeichert.');
  await expect(notice).not.toContainText('nicht in der aktuellen Liste');

  await page.getByRole('button', { name: 'Neue Buchung', exact: true }).click();
  await page.getByLabel('Betrag in EUR', { exact: true }).fill('7');
  await pickDate(page, page.getByRole('dialog').getByLabel('Datum', { exact: true }), '2099-04-10');
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(notice).toContainText('Sie liegt im April 2099 und steht deshalb nicht in der aktuellen Liste.');
});

test('a savings goal without a budget for its months is refused with a clear message, nothing is saved', async ({ page }) => {
  await mockTwoMonths(page);
  const message = 'Für Oktober 2026 bis Dezember 2026 gibt es noch kein Budget. Lege zuerst ein Budget für den Zeitraum des Sparziels an.';
  let posts = 0;
  await page.route('**/api/v1/finanzen/private/goals/**', async (r) => {
    if (r.request().method() === 'POST') {
      if (r.request().url().includes('/preview/')) return r.fulfill({ status: 400, json: { plan_month: [message] } });
      posts++;
    }
    return r.fallback();
  });
  await page.goto('/app/finanzen');
  await page.getByRole('button', { name: 'Sparziele', exact: true }).click();
  await page.getByRole('button', { name: 'Neues Sparziel', exact: true }).or(page.getByRole('button', { name: 'Sparziel erstellen', exact: true })).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titel', { exact: true }).fill('Auto');
  await dialog.getByLabel('Zielbetrag in EUR').fill('500');
  await dialog.getByLabel('Bereits gespart in EUR').fill('450');
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('gibt es noch kein Budget');
  await expect(dialog).toBeVisible();
  expect(posts).toBe(0);
});

test('changing a budget keeps its start month locked, and a new budget can be started from the dialog', async ({ page }) => {
  await mockTwoMonths(page);
  await page.goto('/app/finanzen');
  await page.getByRole('button', { name: 'Budgets', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Budget erstellen', exact: true })).toHaveCount(0); // ein Button genügt
  await page.getByRole('button', { name: 'Budget ändern', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const month = dialog.getByLabel('Startmonat');
  await expect(month).toBeDisabled();
  await expect(dialog).toContainText('nicht der angezeigte Monat');
  await expect(dialog.getByLabel('Budgetbetrag in EUR')).toBeEnabled();

  // stattdessen ein neues Budget ab dem angezeigten Monat
  await dialog.getByRole('button', { name: /Stattdessen ab September 2026 ein neues Budget anlegen/ }).click();
  await expect(month).toBeEnabled();
  await expect(month).toContainText('September 2026');
  await expect(dialog.getByLabel('Budgetbetrag in EUR')).toHaveValue('');
  await expect(dialog.getByRole('button', { name: /Stattdessen/ })).toHaveCount(0);
});

test('a budget that another budget overrides warns in the dialog and shows one value per month in the timeline', async ({ page }) => {
  await mockTwoMonths(page);
  await page.route('**/api/v1/finanzen/private/budgets/', (r) =>
    r.request().method() === 'GET'
      ? r.fulfill({ json: [
          { id: 1, month: '2099-03-01', end_month: null, open_ended: true, amount: '3000.00', currency: 'EUR' },
          { id: 2, month: '2099-08-01', end_month: null, open_ended: false, amount: '3500.00', currency: 'EUR' },
        ] })
      : r.fallback(),
  );
  await page.goto('/app/finanzen');
  await pickMonth(page, page.locator('#finance-month'), '2099-04');
  await page.getByRole('button', { name: 'Budgets', exact: true }).click();

  // Zeitleiste: drei Strecken (März–Juli, August, September–Dezember), nie zwei Beträge in einer Spalte
  const bars = page.locator('app-budget-timeline .tl__bar');
  await expect(bars).toHaveCount(3);
  const boxes = await bars.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [Math.round(r.left), Math.round(r.right), Math.round(r.top)]));
  expect(new Set(boxes.map((b) => b[2])).size).toBe(1); // alle in einer Zeile
  for (let i = 1; i < boxes.length; i++) expect(boxes[i][0]).toBeGreaterThanOrEqual(boxes[i - 1][1] - 8);

  // Dialog: Hinweis, Speichern bleibt möglich
  await page.getByRole('button', { name: 'Budget ändern', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('status')).toContainText('Im August 2099 gilt bereits ein anderes Budget und hat dort Vorrang');
  await expect(dialog.getByRole('button', { name: 'Speichern', exact: true })).toBeEnabled();
});

test('the budget dialog says what stays without a budget, and the overview names the missing budget', async ({ page }) => {
  await mockTwoMonths(page);
  await page.route('**/api/v1/finanzen/private/budgets/1/impact/', (r) => r.fulfill({ json: { transactions: 12, goals: 1 } }));
  await page.goto('/app/finanzen');
  await page.getByRole('button', { name: 'Budgets', exact: true }).click();
  await page.getByRole('button', { name: 'Budget ändern', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Löschst du dieses Budget, gibt es für 12 Buchungen und 1 Sparziel kein Budget mehr. Sie bleiben erhalten, aber es wird nichts verrechnet.');
});

test('without a budget the overview keeps bookings and says so', async ({ page }) => {
  await mockTwoMonths(page);
  await page.route('**/api/v1/finanzen/private/summary/**', (r) =>
    r.fulfill({ json: { month: '2026-09', currency: 'EUR', budget: null, total: null, saved: '0.00', saved_planned: '0.00', available: null, plan_alert: null, income: '0.00', expenses: '10.00', savings_target: '0.00', savings_current: '0.00', has_data: true, categories: [], recent: [] } }),
  );
  await page.goto('/app/finanzen');
  await expect(page.locator('.month-card')).toContainText('gibt es kein Budget. Deine Einnahmen und Ausgaben bleiben gespeichert');
});
