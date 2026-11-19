import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { OnboardingPage } from './onboarding-page';

function setup(status = { needs_onboarding: true, completed: false, usage: null, domains: [] }) {
  TestBed.configureTestingModule({ imports: [OnboardingPage], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(OnboardingPage);
  const http = TestBed.inject(HttpTestingController);
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  fixture.detectChanges();
  http.expectOne((r) => r.url.endsWith('/onboarding/profile/') && r.method === 'GET').flush(status);
  fixture.detectChanges();
  return { fixture, http, navigate, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('Onboarding (Neubau 19.11.2026)', () => {
  it('bestehendes Konto: kein Onboarding, direkt zur Startseite', () => {
    const { navigate } = setup({ needs_onboarding: false, completed: true, usage: null, domains: [] });
    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('Schritt 1: Willkommen, Name, Währung, Nutzung — „Schritt 1 von 3“', () => {
    const { el } = setup();
    expect(el.querySelector('h1')!.textContent).toContain('Willkommen');
    expect(el.querySelector('.progress__label')!.textContent).toContain('Schritt 1 von 3');
    expect(el.querySelector('#ob-name')).toBeTruthy();
    expect(el.textContent).toContain('Nur für mich');
  });

  it('Schritt 2 verlangt mindestens einen Bereich und speichert die Auswahl VOR dem ersten Eintrag', () => {
    const { c, http, fixture, el } = setup();
    c.profile.controls.name.setValue('');
    c.saveProfile();
    expect(c.step()).toBe(1); // Name fehlt
    c.profile.controls.name.setValue('Lena');
    c.saveProfile();
    http.expectOne((r) => r.url.endsWith('/auth/me/')).flush({ name: 'Lena', email: 'l@example.com' });
    expect(c.step()).toBe(2);
    c.saveAreas();
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('mindestens einen Bereich');
    c.toggle('reisen');
    c.toggle('finanzen');
    c.saveAreas();
    const save = http.expectOne((r) => r.url.endsWith('/onboarding/profile/') && r.method !== 'GET');
    expect(save.request.body).toEqual({ usage: 'personal', domains: ['finanzen', 'reisen'] }); // Reihenfolge der Bereiche
    save.flush({ needs_onboarding: false, completed: true, usage: 'personal', domains: ['finanzen', 'reisen'] });
    expect(c.step()).toBe(3);
    expect(c.entryArea()).toBe('finanzen');
  });

  it('Schritt 3 Finanzen: erste Ausgabe mit Kategorie; Fertig führt in den Bereich', () => {
    const { c, http, navigate, fixture, el } = setup();
    c.step.set(2);
    c.toggle('finanzen');
    c.saveAreas();
    http.expectOne((r) => r.url.endsWith('/onboarding/profile/') && r.method !== 'GET').flush({});
    http.expectOne((r) => r.url.endsWith('/finanzen/private/categories/')).flush([]);
    http.expectOne((r) => r.url.endsWith('/finanzen/private/categories/setup/')).flush([{ id: 7, name: 'Lebensmittel', color: '#17694f' }]);
    expect(c.category()).toBe(7);
    c.expenseForm.setValue({ amount: '12,40', note: 'Bäcker' });
    c.saveEntry();
    const post = http.expectOne((r) => r.url.endsWith('/finanzen/private/transactions/'));
    expect(post.request.body).toEqual(expect.objectContaining({ amount: '12.40', type: 'EXPENSE', category: 7, note: 'Bäcker' }));
    post.flush({ id: 1 });
    fixture.detectChanges();
    expect(c.step()).toBe(4);
    expect(el.textContent).toContain('Bäcker');
    c.finish();
    expect(navigate).toHaveBeenLastCalledWith('/finanzen', { replaceUrl: true });
  });

  it('Schritt 3 Reisen: Ende vor Beginn wird erklärt, nichts gesendet', () => {
    const { c, http } = setup();
    c.selected.set(['reisen']);
    c.entryArea.set('reisen');
    c.step.set(3);
    c.tripForm.setValue({ destination: 'Lissabon', start: '2030-06-10', end: '2030-06-01' });
    c.saveEntry();
    expect(c.error()).toContain('vor dem Beginn');
    http.expectNone((r) => r.url.includes('/reisen/trips/'));
  });

  it('„Ohne Eintrag weiter“ und „Überspringen“ funktionieren immer', () => {
    const { c, http, navigate } = setup();
    c.step.set(3);
    c.skipEntry();
    expect(c.step()).toBe(4);
    c.finish();
    expect(navigate).toHaveBeenLastCalledWith('/', { replaceUrl: true });
    c.step.set(1);
    c.skipAll();
    const save = http.expectOne((r) => r.url.endsWith('/onboarding/profile/') && r.method !== 'GET');
    expect(save.request.body.domains).toEqual(['finanzen', 'haushalt', 'organisation', 'reisen']);
    save.flush({});
  });

  it('Fehler beim Laden: Wiederholen statt leerer Seite', () => {
    TestBed.configureTestingModule({ imports: [OnboardingPage], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(OnboardingPage);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne((r) => r.url.endsWith('/onboarding/profile/')).flush(null, { status: 500, statusText: 'x' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Noch einmal versuchen');
  });
});
