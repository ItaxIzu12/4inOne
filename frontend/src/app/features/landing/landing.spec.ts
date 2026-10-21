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

  it('explains the app in this order: hero, the four areas, how it works, privacy, questions (no contact section)', () => {
    const { el } = render();
    const ids = Array.from(el.querySelectorAll('main section')).map((s) => s.id);
    expect(ids).toEqual(['', 'bereiche', 'so-gehts', 'privat', 'fragen']);
    expect(el.querySelector('h1')?.textContent).toContain('Alles verbunden.');
    expect(el.querySelector('.hero__lead')?.textContent).toContain('Finanzen, Haushalt, Termine und Reisen');
  });

  it('shows each area as its own card in its colour, with a real value from the demo and a way into it', () => {
    const { el } = render();
    const cards = Array.from(el.querySelectorAll('#bereiche .card'));
    expect(cards.map((c) => c.querySelector('h3')?.textContent)).toEqual(['Finanzen', 'Haushalt', 'Organisation', 'Reisen']);
    expect(cards.map((c) => [...c.classList].find((k) => k.startsWith('tone-')))).toEqual(['tone-finance', 'tone-household', 'tone-organisation', 'tone-travel']);
    expect(cards[0].querySelector('.fact__value')?.textContent).toContain('702,29 €');
    expect(cards.map((c) => c.querySelector('.card__link')?.getAttribute('href'))).toEqual(['/demo/finanzen', '/demo/haushalt', '/demo/organisation', '/demo/reisen']);
  });

  it('proves what a link is good for: device → savings goal → task → appointment, labelled as an example', () => {
    const { el } = render();
    const rows = Array.from(el.querySelectorAll('.chain__row b')).map((b) => b.textContent);
    expect(rows).toEqual(['Waschmaschine', 'Neue Waschmaschine', 'Angebote vergleichen', 'Lieferung']);
    expect(el.querySelectorAll('app-link-chain app-animated-beam')).toHaveLength(3);
    expect(el.querySelector('.chain figcaption')?.textContent).toContain('Vom Gerät direkt zum Sparziel und zur nächsten Aufgabe');
    expect(el.querySelector('.chain')?.textContent).toContain('Beispiel');
  });

  it('offers trying it without an account as a real second button', () => {
    const { el } = render();
    const second = el.querySelector('.hero .btn--outline');
    expect(second?.textContent?.trim()).toBe('Ohne Anmeldung ausprobieren');
    expect(second?.getAttribute('href')).toBe('/demo');
  });

  it('uses no italics anywhere', () => {
    const { el } = render();
    expect(el.querySelectorAll('em, i:not(:empty)')).toHaveLength(0);
  });

  it('has exactly one primary call to action in the hero, pointing to registration', () => {
    const { el } = render();
    const primary = el.querySelectorAll('.hero .btn--ink');
    expect(primary).toHaveLength(1);
    expect(primary[0].getAttribute('href')).toBe('/registrieren');
  });

  it('makes no invented claims: no testimonials, ratings, user numbers, prices or AI', () => {
    const { el } = render();
    const text = el.querySelector('main')!.textContent!;
    expect(text).not.toMatch(/Testimonial|Bewertung|Tausende|\d+\s?(k|K)?\+? Nutzer|kostenlos|gratis|€\s?\/\s?Monat|KI\b|Beta/);
  });

  it('shows what others see; finance can never be shared', () => {
    const { fixture, component, el } = render();
    const trip = component.rules.find((r) => r.key === 'reise')!;
    const finance = component.rules.find((r) => r.key === 'finanzen')!;
    expect(component.isOn(trip)).toBe(false);
    component.toggle(trip);
    fixture.detectChanges();
    expect(el.querySelector('#privat')?.textContent).toContain('Ben sieht genau diese Reise');
    component.toggle(finance);
    expect(component.isOn(finance)).toBe(false);
    expect(el.querySelector('[aria-labelledby="rule-finanzen"]')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('keeps the privacy promise the product actually enforces', () => {
    const { component } = render();
    const answers = component.faq.map((f) => f.a).join(' ');
    expect(answers).toContain('Deinen Finanzbereich kann niemand sonst sehen');
    expect(answers).toContain('4inOne verbindet sich nicht mit deiner Bank');
  });
});
