import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Profil } from './profil';

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
    (el.querySelector('.delete-account__confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    const req = TestBed.inject(HttpTestingController).expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/auth/me/'));
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
    (el.querySelector('.delete-account__confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    const req = TestBed.inject(HttpTestingController).expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/auth/me/'));
    req.flush({ detail: 'error' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[role="dialog"]')).toBeTruthy();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('nicht geklappt');
  });
});
