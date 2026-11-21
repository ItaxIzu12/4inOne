import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GuideService, GuideStatus } from '../../../core/onboarding/guide.service';
import { StartGuide } from './start-guide';

const NONE: GuideStatus['areas'] = {
  finanzen: { budget: false, transaction: false, goal: false },
  haushalt: { task: false, shopping: false, folder: false },
  organisation: { event: false, task: false, note: false },
  reisen: { trip: false, packing: false, budget: false, trip_id: null },
};

describe('Startleitfaden', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }));

  function render(done: [boolean, boolean, boolean]) {
    const f = TestBed.createComponent(StartGuide);
    f.componentRef.setInput('area', 'organisation');
    f.componentRef.setInput('heading', 'So startest du mit Organisation');
    f.componentRef.setInput('intro', 'Termine, Aufgaben und Notizen.');
    f.componentRef.setInput('demoPath', '/demo/organisation');
    f.componentRef.setInput('steps', [
      { key: 'event', title: 'Ersten Termin eintragen', hint: 'h', done: done[0] },
      { key: 'task', title: 'Eine Aufgabe festhalten', hint: 'h', done: done[1] },
      { key: 'note', title: 'Eine Notiz anlegen', hint: 'h', done: done[2], optional: true },
    ]);
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement };
  }

  it('zeigt Fortschritt, nummerierte Schritte und den nächsten Pflichtschritt als Hauptknopf', () => {
    const { el } = render([true, false, false]);
    expect(el.querySelector('h2')!.textContent).toContain('So startest du mit Organisation');
    expect(el.querySelector('.guide__count')!.textContent).toContain('1 von 3 erledigt');
    expect(el.querySelectorAll('.guide__bar li.is-done').length).toBe(1);
    expect(el.querySelector('.guide__list li.is-done')!.textContent).toContain('erledigt'); // für Screenreader
    expect(el.querySelector('.guide__cta')!.textContent).toContain('Eine Aufgabe festhalten');
    expect(el.querySelector('.guide__opt')!.textContent).toContain('optional');
    expect(el.querySelector('.guide__demo')!.getAttribute('href')).toBe('/demo/organisation');
    expect(el.querySelector('.guide__hide')!.getAttribute('aria-label')).toBe('So startest du mit Organisation ausblenden');
  });

  it('meldet Schritt und Ausblenden an den Bereich', () => {
    const { f, el } = render([false, false, false]);
    const picked: string[] = [];
    let hidden = false;
    f.componentInstance.pick.subscribe((k) => picked.push(k));
    f.componentInstance.hide.subscribe(() => (hidden = true));
    (el.querySelectorAll('.guide__item')[2] as HTMLButtonElement).click();
    (el.querySelector('.guide__cta') as HTMLButtonElement).click();
    (el.querySelector('.guide__hide') as HTMLButtonElement).click();
    expect(picked).toEqual(['note', 'event']);
    expect(hidden).toBe(true);
  });

  it('GuideService: eingerichtet = erste beiden Schritte; ausgeblendet bleibt weg; Ausblenden geht ans Konto', () => {
    const guide = TestBed.inject(GuideService);
    const http = TestBed.inject(HttpTestingController);
    expect(guide.shows('haushalt')).toBe(false); // ohne geladenen Stand nichts zeigen
    guide.load();
    http.expectOne('http://localhost:8000/api/v1/onboarding/guide/').flush({ areas: { ...NONE, haushalt: { task: true, shopping: false, folder: true } }, dismissed: [] });
    expect(guide.doneCount('haushalt')).toBe(2);
    expect(guide.isSetUp('haushalt')).toBe(false); // Einkauf fehlt noch
    expect(guide.shows('haushalt')).toBe(true);
    guide.hide('haushalt');
    expect(guide.shows('haushalt')).toBe(false);
    expect(http.expectOne((r) => r.method === 'PUT').request.body).toEqual({ area: 'haushalt', hidden: true });
  });
});
