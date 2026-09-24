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
  await page.goto('/app');await expect(page).toHaveURL(/\/app\/onboarding$/);
  await expect(page.getByRole('heading',{name:/Willkommen/})).toBeVisible();
  await page.screenshot({path:`test-results/onboarding-welcome-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:/Los geht/}).click();
  await page.getByRole('button',{name:/Nur für mich/}).click();await page.getByRole('button',{name:'Weiter'}).click();
  await page.getByRole('button',{name:/Finanzen/}).click();await page.getByRole('button',{name:/Haushalt/}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/onboarding-domains-${width}.png`,fullPage:true});
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button',{name:'Weiter'}).click();await expect(page.getByRole('heading',{name:'Dein 4inOne ist bereit'})).toBeVisible();
  await page.getByRole('button',{name:/Zum Dashboard/}).click();await expect(page).toHaveURL(/\/app$/);
  await page.reload();await expect(page).toHaveURL(/\/app$/);
  await page.goto('/app/onboarding');await expect(page).toHaveURL(/\/app$/);
 });
}
test('existing data bypasses onboarding',async({page})=>{
 await page.route('**/api/v1/auth/csrf/',r=>r.fulfill({json:{csrfToken:'test'}}));
 await page.route('**/api/v1/auth/refresh/',r=>r.fulfill({json:{access:'test',user:{name:'Mira',email:'mira@example.com'}}}));
 await page.route('**/api/v1/onboarding/profile/',r=>r.fulfill({json:{needs_onboarding:false,completed:false,usage:null,domains:[]}}));
 await page.goto('/app');await expect(page.getByRole('heading',{name:'Hallo Mira!'})).toBeVisible();await expect(page).toHaveURL(/\/app$/);
});
