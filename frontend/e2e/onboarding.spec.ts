import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for(const width of [390,1440]){
 test(`new account onboarding ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  let completed=false;
  await page.route('**/api/v1/auth/csrf/',r=>r.fulfill({json:{csrfToken:'test-csrf'}}));
  await page.route('**/api/v1/auth/refresh/',r=>r.fulfill({json:{access:'test-access',user:{name:'Sophie',email:'sophie@example.com'}}}));
  await page.route('**/api/v1/onboarding/profile/',async r=>{
   if(r.request().method()==='PUT'){expect(r.request().postDataJSON()).toEqual({usage:'personal',domains:['finanzen','haushalt']});completed=true;}
   await r.fulfill({json:{needs_onboarding:!completed,completed,usage:null,domains:[]}});
  });
  await page.goto('/');await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('heading',{name:/Willkommen/})).toBeVisible();
  await page.screenshot({path:`test-results/onboarding-welcome-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:/Los geht/}).click();
  await page.getByRole('button',{name:/Nur für mich/}).click();await page.getByRole('button',{name:'Weiter'}).click();
  await page.getByRole('button',{name:/Finanzen/}).click();await page.getByRole('button',{name:/Haushalt/}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/onboarding-domains-${width}.png`,fullPage:true});
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button',{name:'Weiter'}).click();await expect(page.getByRole('heading',{name:'Dein 4inOne ist bereit'})).toBeVisible();
  await expect(page.getByRole('button',{name:'4inOne entdecken'})).toBeVisible();
  await page.getByRole('button',{name:/Mit meinen Daten starten/}).click();await expect(page).toHaveURL(/\/$/);
  await page.reload();await expect(page).toHaveURL(/\/$/);
  await page.goto('/onboarding');await expect(page).toHaveURL(/\/$/);
 });
}

// "4inOne entdecken" speichert dieselbe Auswahl, landet aber in der öffentlichen Demo statt im echten,
// leeren Arbeitsbereich (siehe onboarding-page.ts finish()). Mit genau einem gewählten Bereich geht es direkt
// zu dessen Demo-Seite statt zum generischen Demo-Dashboard (kürzester Weg vom Interesse zum Ergebnis).
test('"4inOne entdecken" with exactly one chosen area opens that area\'s demo page directly, not the generic demo dashboard', async ({ page }) => {
 let completed = false;
 await page.route('**/api/v1/auth/csrf/', r => r.fulfill({ json: { csrfToken: 'test-csrf' } }));
 await page.route('**/api/v1/auth/refresh/', r => r.fulfill({ json: { access: 'test-access', user: { name: 'Sophie', email: 'sophie@example.com' } } }));
 await page.route('**/api/v1/onboarding/profile/', async r => {
  if (r.request().method() === 'PUT') { completed = true; }
  await r.fulfill({ json: { needs_onboarding: !completed, completed, usage: null, domains: [] } });
 });
 await page.goto('/');
 await page.getByRole('button', { name: /Los geht/ }).click();
 await page.getByRole('button', { name: /Nur für mich/ }).click();
 await page.getByRole('button', { name: 'Weiter' }).click();
 await page.getByRole('button', { name: /Reisen/ }).click();
 await page.getByRole('button', { name: 'Weiter' }).click();
 await page.getByRole('button', { name: '4inOne entdecken' }).click();
 await expect(page).toHaveURL('/demo/reisen');
 await expect(page.locator('.demo-banner')).toBeVisible();
});

// Mit mehreren gewählten Bereichen gibt es keine eindeutige Priorität, also geht es zum (echten) Dashboard —
// das die Auswahl aber nicht verwirft, sondern die gewählten Kacheln vorne/hervorgehoben zeigt (dashboard.ts).
test('"Mit meinen Daten starten" with two chosen areas lands on the dashboard, which highlights exactly those two', async ({ page }) => {
 let completed = false;
 let savedDomains: string[] = [];
 await page.route('**/api/v1/auth/csrf/', r => r.fulfill({ json: { csrfToken: 'test-csrf' } }));
 await page.route('**/api/v1/auth/refresh/', r => r.fulfill({ json: { access: 'test-access', user: { name: 'Mira', email: 'mira@example.com' } } }));
 await page.route('**/api/v1/onboarding/profile/', async r => {
  if (r.request().method() === 'PUT') {
   completed = true;
   savedDomains = (r.request().postDataJSON() as { domains: string[] }).domains;
  }
  await r.fulfill({ json: { needs_onboarding: !completed, completed, usage: null, domains: savedDomains } });
 });
 await page.goto('/');
 await page.getByRole('button', { name: /Los geht/ }).click();
 await page.getByRole('button', { name: /Nur für mich/ }).click();
 await page.getByRole('button', { name: 'Weiter' }).click();
 await page.getByRole('button', { name: /Reisen/ }).click();
 await page.getByRole('button', { name: /Finanzen/ }).click();
 await page.getByRole('button', { name: 'Weiter' }).click();
 await page.getByRole('button', { name: /Mit meinen Daten starten/ }).click();
 await expect(page).toHaveURL('/');
 await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

 const highlighted = page.locator('.domain--highlighted h2');
 await expect(highlighted).toHaveCount(2);
 await expect(highlighted.nth(0)).toContainText('Reisen');
 await expect(highlighted.nth(1)).toContainText('Finanzen');
});
test('existing data bypasses onboarding',async({page})=>{
 await page.route('**/api/v1/auth/csrf/',r=>r.fulfill({json:{csrfToken:'test'}}));
 await page.route('**/api/v1/auth/refresh/',r=>r.fulfill({json:{access:'test',user:{name:'Mira',email:'mira@example.com'}}}));
 await page.route('**/api/v1/onboarding/profile/',r=>r.fulfill({json:{needs_onboarding:false,completed:false,usage:null,domains:[]}}));
 // Die Begrüßung ("Guten Morgen"/"Hallo"/"Guten Abend") hängt von der Tageszeit ab (siehe dashboard.ts
 // greeting) — hier geht es nur darum, dass die echte Dashboard-Seite mit dem echten Namen erscheint.
 await page.goto('/');await expect(page.getByRole('heading', { level: 1 })).toContainText('Mira!');await expect(page).toHaveURL(/\/$/);
});
