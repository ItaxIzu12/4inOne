import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Landing } from './landing';

describe('Landing', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [Landing], providers: [provideRouter([]), provideHttpClient()] });
    const fixture = TestBed.createComponent(Landing);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('tells the story in this order: product, statement, try linking, areas, privacy, questions, closer', () => {
    const { el } = render();
    const ids = Array.from(el.querySelectorAll('main > section')).map((s) => s.id);
    expect(ids).toEqual(['', 'produkt', 'verknuepfen', 'bereiche', 'privat', 'fragen', '']);
    expect(el.querySelector('h1')?.textContent).toBe('Dein ganzer Alltag auf einer Startseite.');
    expect(el.querySelector('.hero__lead')?.textContent).toContain('Budget, Termine, Haushalt und Reisen');
  });

  it('shows the real product right under the headline: desktop and phone screenshots with alt text and fixed size', () => {
    const { el } = render();
    const images = Array.from(el.querySelectorAll<HTMLImageElement>('.stage img'));
    expect(images.map((i) => i.getAttribute('src'))).toEqual(['images/landing/start.webp', 'images/landing/mobil@2x.webp']);
    for (const img of images) {
      expect(img.alt.length).toBeGreaterThan(20);
      expect(img.getAttribute('width')).toBeTruthy();
      expect(img.getAttribute('height')).toBeTruthy();
    }
    expect(el.querySelector('.stage figcaption')?.textContent).toContain('Beispieldaten');
  });

  it('switches between the four areas like tabs, each with its real screenshot and a way into the demo', () => {
    const { fixture, component, el } = render();
    const tabs = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Finanzen', 'Haushalt', 'Organisation', 'Reisen']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs.filter((t) => t.tabIndex === 0)).toHaveLength(1);
    tabs[3].click();
    fixture.detectChanges();
    const panel = el.querySelector('[role="tabpanel"]')!;
    expect(panel.getAttribute('aria-labelledby')).toBe('tab-reisen');
    expect(panel.querySelector('img')?.getAttribute('src')).toBe('images/landing/reisen.webp');
    expect(panel.querySelector('.panel__link')?.getAttribute('href')).toBe('/demo/reisen');
    // Pfeiltasten wandern weiter und springen am Ende an den Anfang
    component.onTabKey(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(component.selectedKey()).toBe('finanzen');
    component.onTabKey(new KeyboardEvent('keydown', { key: 'End' }));
    expect(component.selectedKey()).toBe('reisen');
  });

  it('lets visitors link entries themselves, with a reason for every suggestion and one honest non-suggestion', () => {
    const { fixture, component, el } = render();
    const play = el.querySelector('#verknuepfen')!;
    expect(Array.from(play.querySelectorAll('.pick')).map((b) => b.textContent?.trim())).toEqual(['Eine Reise', 'Ein Gerät', 'Ein Vertrag']);
    expect(play.querySelectorAll('.suggestions ul .sug')).toHaveLength(3);
    expect(play.querySelector('.sug__reason')?.textContent).toContain('„Berlin“');
    expect(play.querySelector('.sug--skipped')?.textContent).toContain('Die Zeit allein reicht nie');
    // Verknüpfen ist ein Umschalter; der Zähler sagt laut, was passiert ist
    (play.querySelector('.sug__link') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(play.querySelector('.sug__link')?.textContent?.trim()).toBe('Verknüpft');
    expect(play.querySelector('.sug__link')?.getAttribute('aria-label')).toBe('Verknüpft: Hotel in Berlin bestätigen, Verbindung lösen');
    expect(play.querySelector('.source__count')?.textContent).toContain('Verknüpft mit 1 Eintrag');
    // „Nicht relevant“ nimmt den Vorschlag weg; Zurücksetzen holt alles zurück
    (play.querySelectorAll<HTMLButtonElement>('.sug__dismiss')[0]).click();
    fixture.detectChanges();
    expect(component.visibleSuggestions()).toHaveLength(2);
    component.reset();
    fixture.detectChanges();
    expect(component.visibleSuggestions()).toHaveLength(3);
    expect(component.linkedCount()).toBe(0);
    // Ein anderes Beispiel: der Vertrag — nur der Anbieter reicht nicht
    component.chooseScenario('vertrag');
    fixture.detectChanges();
    expect(play.querySelector('.source strong')?.textContent).toBe('Strom, Stadtwerke');
    expect(play.querySelector('.sug--skipped')?.textContent).toContain('Nur der Anbieter ist gleich');
    expect(play.querySelector('.play__foot')?.textContent).toContain('gespeichert wird nichts');
  });

  it('has exactly one primary call to action in the hero, pointing to registration, and the demo as a real second button', () => {
    const { el } = render();
    const primary = el.querySelectorAll('.hero .btn--ink');
    expect(primary).toHaveLength(1);
    expect(primary[0].getAttribute('href')).toBe('/registrieren');
    const second = el.querySelector('.hero .btn--outline');
    expect(second?.textContent?.trim()).toBe('Ohne Anmeldung ausprobieren');
    expect(second?.getAttribute('href')).toBe('/demo');
  });

  it('avoids the generic page kit: no italics, no numbered steps, no checkmark lists, no blur-in', () => {
    const { el } = render();
    expect(el.querySelectorAll('em, i:not(:empty)')).toHaveLength(0);
    expect(el.querySelector('#so-gehts, .steps, .card__list, [data-hero]')).toBeNull();
  });

  it('makes no invented claims: no testimonials, ratings, user numbers, prices or AI', () => {
    const { el } = render();
    const text = el.querySelector('main')!.textContent!;
    expect(text).not.toMatch(/Testimonial|Bewertung|Tausende|\d+\s?(k|K)?\+? Nutzer|kostenlos|gratis|€\s?\/\s?Monat|KI\b|Beta/);
  });

  it('keeps the privacy promise the product actually enforces', () => {
    const { component, el } = render();
    expect(el.querySelector('#privat')?.textContent).toContain('Finanzen bleiben immer privat');
    const answers = component.faq.map((f) => f.a).join(' ');
    expect(answers).toContain('Deinen Finanzbereich kann niemand sonst sehen');
    expect(answers).toContain('4inOne verbindet sich nicht mit deiner Bank');
  });
});
