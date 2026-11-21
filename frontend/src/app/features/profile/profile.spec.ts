import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Profil } from './profile';

describe('Profil', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [Profil],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }),
  );

  function render() {
    const fixture = TestBed.createComponent(Profil);
    fixture.detectChanges();
    return fixture;
  }

  it('Daten herunterladen: lädt das ZIP mit dem Namen vom Server und meldet Erfolg', () => {
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    (el.querySelector('.data-export__button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.data-export__button')!.textContent).toContain('Wird zusammengestellt');

    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/auth/export/'))
      .flush(new Blob(['zip']), { headers: { 'Content-Disposition': 'attachment; filename="4inone-daten-2026-11-15.zip"' } });
    fixture.detectChanges();
    expect(click).toHaveBeenCalled();
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('4inone-daten-2026-11-15.zip');
    expect(el.textContent).toContain('Die Datei wurde heruntergeladen.');
    click.mockRestore();
  });

  it('Daten herunterladen: zu oft hintereinander → verständlicher Hinweis statt Technik', () => {
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.data-export__button') as HTMLButtonElement).click();
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/auth/export/'))
      .flush(new Blob(['']), { status: 429, statusText: 'Too Many Requests' });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('warte eine Minute');
  });

  it('shows a "Konto löschen" button in its own danger zone, closed by default', () => {
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('.danger-zone')).toBeTruthy();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(el.textContent).toContain('Konto löschen');
  });

  it('opens a confirmation modal that warns about permanent, irreversible deletion before anything happens', () => {
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.danger-zone__button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const dialog = el.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.textContent).toContain('endgültig gelöscht');
    expect(dialog!.textContent).toContain('nicht rückgängig machen');
    // Die Glocke der Kopfzeile lädt Einladungen; gemeint ist hier: kein Aufruf zum Löschen o. Ä.
    TestBed.inject(HttpTestingController).expectNone((r) => !/\/(notifications|invitations)\//.test(r.url));
  });

  it('"Abbrechen" closes the modal without calling the backend', () => {
    const fixture = render();
    let el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.danger-zone__button') as HTMLButtonElement).click();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;

    (el.querySelector('.delete-account__cancel') as HTMLButtonElement).click();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    // Die Glocke der Kopfzeile lädt Einladungen; gemeint ist hier: kein Aufruf zum Löschen o. Ä.
    TestBed.inject(HttpTestingController).expectNone((r) => !/\/(notifications|invitations)\//.test(r.url));
  });

  it('confirming deletes the account and leaves the authenticated area', () => {
    const fixture = render();
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    let el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.danger-zone__button') as HTMLButtonElement).click();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    const pw = el.querySelector('#delete-confirm') as HTMLInputElement;
    pw.value = 'Sicher-Wald-27x';
    pw.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (el.querySelector('.delete-account__confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    const req = TestBed.inject(HttpTestingController).expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/auth/me/'));
    expect(req.request.body).toEqual({ password: 'Sicher-Wald-27x' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(nav).toHaveBeenCalledWith('/', expect.objectContaining({ replaceUrl: true }));
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]')).toBeNull();
  });

  it('a failed deletion shows a clear error and keeps the modal open, so nothing is silently lost', () => {
    const fixture = render();
    let el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.danger-zone__button') as HTMLButtonElement).click();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    const pw = el.querySelector('#delete-confirm') as HTMLInputElement;
    pw.value = 'Sicher-Wald-27x';
    pw.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (el.querySelector('.delete-account__confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    const req = TestBed.inject(HttpTestingController).expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/auth/me/'));
    req.flush({ detail: 'error' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[role="dialog"]')).toBeTruthy();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('nicht geklappt');
  });

  it('Konto löschen braucht das Passwort: ohne Eingabe kein Aufruf, falsches Passwort wird klar gemeldet', () => {
    const fixture = render();
    let el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.danger-zone__button') as HTMLButtonElement).click();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.delete-account__confirm') as HTMLButtonElement).click();
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectNone((r) => r.method === 'DELETE');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Bitte gib dein Passwort ein');
    const pw = el.querySelector('#delete-confirm') as HTMLInputElement;
    pw.value = 'falsch';
    pw.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (el.querySelector('.delete-account__confirm') as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectOne((r) => r.method === 'DELETE').flush({ password: ['x'] }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Das Passwort stimmt nicht');
    expect(el.querySelector('[role="dialog"]')).toBeTruthy();
  });
});
