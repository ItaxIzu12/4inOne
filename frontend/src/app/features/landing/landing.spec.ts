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

  it('tells the story in this order: product, problem, try linking, areas, privacy, questions, closer', () => {
    const { el } = render();
    const ids = Array.from(el.querySelectorAll('main > section')).map((s) => s.id);
    expect(ids).toEqual(['', 'produkt', 'verknuepfen', 'bereiche', 'privat', 'fragen', '']);
    expect(el.querySelector('h1')?.textContent).toBe('Vier Bereiche für deinen Alltag – und was zusammengehört, ist verbunden.');
    expect(el.querySelector('.hero__lead')?.textContent).toContain('Reisekasse weiß, zu welcher Reise sie');
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

  it('leads to the demo first; the second way explains (to the live example) instead of asking for data', () => {
    const { el } = render();
    const primary = el.querySelectorAll('.hero .btn--ink');
    expect(primary).toHaveLength(1);
    expect(primary[0].getAttribute('href')).toBe('/demo');
    expect(primary[0].textContent?.trim()).toBe('Demo ohne Anmeldung testen');
    expect(el.querySelector('.hero .btn--outline')?.getAttribute('href')).toBe('/#verknuepfen');
    expect(el.querySelector('.hero__note')?.textContent).toContain('Ohne Registrierung');
    expect(el.querySelector('.head .btn--ink')?.getAttribute('href')).toBe('/demo');
    expect(el.querySelector('.closer .btn--light')?.textContent?.trim()).toBe('Demo ausprobieren');
  });

  it('states the problem briefly, with two before/after examples, and leads into the live example', () => {
    const { el } = render();
    const problem = el.querySelector('#produkt')!;
    expect(problem.querySelector('h2')?.textContent).toBe('Vier Apps wissen nichts voneinander. Dein Alltag schon.');
    expect(problem.querySelectorAll('.compare__item')).toHaveLength(2);
    expect(problem.querySelectorAll('.compare__before dt')[0]?.textContent).toBe('Vorher');
    expect(problem.querySelector('.problem__next')?.getAttribute('href')).toBe('/#verknuepfen');
  });

  it('walks through the four steps: create, suggestions with reasons, decide each (link · later · reject), result', () => {
    const { fixture, component, el } = render();
    const play = el.querySelector('#verknuepfen')!;
    const current = () => play.querySelector('.stepper [aria-current="step"]')?.textContent?.trim();
    expect(Array.from(play.querySelectorAll('.pick')).map((b) => b.textContent?.trim())).toEqual(['Eine Reise', 'Ein Gerät', 'Ein Vertrag']);
    // 1 · Anlegen: vorher nur eine Vorschau der Titel, ohne Knöpfe und ohne „Das war ein Ausschnitt“
    expect(current()).toContain('Anlegen');
    expect(play.querySelectorAll('.preview .sug--preview')).toHaveLength(3);
    expect(play.querySelectorAll('.sug__link, .sug__reason')).toHaveLength(0);
    expect(play.querySelector('.play__next')?.textContent).toContain('Lieber gleich die ganze App sehen?');
    // vorher nur ein leiser Ausweg: „Reise anlegen“ ist die einzige Hauptaktion, nichts zum Zurücksetzen
    expect(play.querySelectorAll('.play__next .btn')).toHaveLength(0);
    expect(play.querySelector('.play__foot button')).toBeNull();
    (play.querySelector('.draft__go') as HTMLButtonElement).click();
    fixture.detectChanges();
    // 2 · Vorschläge mit Begründung
    expect(current()).toContain('Vorschläge');
    expect(play.querySelectorAll('.suggestions ul .sug')).toHaveLength(3);
    expect(play.querySelector('.sug__reason')?.textContent).toContain('„Berlin“');
    expect(play.querySelector('.sug--skipped')?.textContent).toContain('Die Zeit allein reicht nie');
    // 3 · Entscheiden: je Vorschlag einzeln, Zustand als Wort
    const [hotel, zug, kasse] = component.scenario().suggestions;
    component.decide(kasse, 'linked');
    fixture.detectChanges();
    expect(current()).toContain('Entscheiden');
    expect(play.querySelector('.sug.is-linked .sug__state')?.textContent).toContain('Verknüpft');
    // Zustand als Wort genau einmal; der Knopf sagt, was er tut
    expect(play.querySelector('.sug.is-linked')!.textContent!.match(/Verknüpft/g)).toHaveLength(1);
    expect(play.querySelector('.sug.is-linked .sug__link')?.textContent?.trim()).toBe('Lösen');
    expect(play.querySelector('.source__count')?.textContent).toContain('Verknüpft mit 1 Eintrag');
    // Screenreader: genau eine Statuszeile sagt die Entscheidung kurz an
    expect(play.querySelectorAll('[aria-live], [role="status"]')).toHaveLength(1);
    expect(play.querySelector('[role="status"]')?.textContent).toBe('„Reisekasse Berlin“ verknüpft. Verknüpft mit 1 Eintrag.');
    expect(play.querySelector('.play__next')?.textContent).toContain('Das war ein Ausschnitt');
    component.decide(zug, 'later');
    component.decide(hotel, 'dismissed');
    fixture.detectChanges();
    expect(play.querySelector('.sug.is-later .sug__state')?.textContent).toContain('bleibt als Vorschlag offen');
    expect(play.querySelector('.sug.is-dismissed .sug__state')?.textContent).toContain('nicht wieder vorgeschlagen');
    // 4 · Ergebnis je Bereich: Verbindungen, keine neuen Einträge, keine Freigaben
    expect(current()).toContain('Ergebnis');
    const outcome = play.querySelector('.outcome')!.textContent!;
    expect(outcome).toContain('Finanzen');
    expect(outcome).toContain('Reisekasse Berlin');
    expect(outcome).toContain('1 offen für später');
    expect(outcome).toContain('1 abgelehnt');
    expect(outcome).toContain('keine neuen Einträge');
    expect(play.querySelector('[role="status"]')?.textContent).toContain('Alles entschieden');
    // Zurücksetzen: wieder Ausgangszustand
    component.reset();
    fixture.detectChanges();
    expect(component.isCreated()).toBe(false);
    expect(current()).toContain('Anlegen');
    expect(component.decisions().size).toBe(0);
    expect(play.querySelector('[role="status"]')?.textContent).toBe('Beispiel zurückgesetzt.');
    // Anderes Beispiel: der Vertrag — nur der Anbieter reicht nicht
    component.chooseScenario('vertrag');
    fixture.detectChanges();
    expect(play.querySelector('.source strong')?.textContent).toBe('Strom, Stadtwerke');
    expect(play.querySelector('.sug--skipped')?.textContent).toContain('Nur der Anbieter ist gleich');
    expect(play.querySelector('.play__foot')?.textContent).toContain('gespeichert wird nichts');
  });

  it('switches between the four areas like tabs: problem, features, real screenshot, benefit, way into the demo', () => {
    const { fixture, component, el } = render();
    const tabs = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Finanzen', 'Haushalt', 'Organisation', 'Reisen']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs.filter((t) => t.tabIndex === 0)).toHaveLength(1);
    tabs[3].click();
    fixture.detectChanges();
    const panel = el.querySelector('[role="tabpanel"]')!;
    expect(panel.getAttribute('aria-labelledby')).toBe('tab-reisen');
    expect(panel.querySelector('.panel__problem')?.textContent?.length).toBeGreaterThan(20);
    expect(panel.querySelector('.panel__benefit')?.textContent).toContain('Dein Nutzen');
    expect(panel.querySelector('img')?.getAttribute('src')).toBe('images/landing/reisen.webp');
    expect(panel.querySelector('.panel__link')?.getAttribute('href')).toBe('/demo/reisen');
    component.onTabKey(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(component.selectedKey()).toBe('finanzen');
    component.onTabKey(new KeyboardEvent('keydown', { key: 'End' }));
    expect(component.selectedKey()).toBe('reisen');
  });

  it('shows who sees what at a labelled example, and that linking never changes access', () => {
    const { el } = render();
    const share = el.querySelector('#privat .share')!;
    expect(share.querySelector('.share__head')?.textContent).toContain('Beispiel');
    const rows = Array.from(share.querySelectorAll('.share__row')).map((r) => r.textContent!.replace(/\s+/g, ' ').trim());
    expect(rows[0]).toContain('Finanzen');
    expect(rows[0]).toContain('Nur du');
    expect(rows[0]).toContain('Nicht teilbar');
    expect(share.querySelector('.share__link')?.textContent).toContain('ändert keine Rechte');
  });

  it('answers the questions people have, honestly — including what is not there yet and that the price is open', () => {
    const { component } = render();
    const questions = component.faq.map((f) => f.q);
    for (const q of ['Muss ich alle vier Bereiche nutzen?', 'Kann ich 4inOne ohne Konto ausprobieren?', 'Wer sieht meine persönlichen Daten?', 'Wie funktionieren Verknüpfungen?', 'Muss ich mein Bankkonto verbinden?', 'Gibt es eine mobile App?', 'Welche Funktionen gibt es schon?', 'Kann ich meine Daten und mein Konto löschen?', 'Was kostet 4inOne?'])
      expect(questions).toContain(q);
    const answers = component.faq.map((f) => f.a).join(' ');
    expect(answers).toContain('Deinen Finanzbereich kann niemand sonst sehen');
    expect(answers).toContain('4inOne verbindet sich nicht mit deiner Bank');
    expect(answers).toContain('Noch nicht: Bankanbindung');
    expect(component.faq.find((f) => f.q === 'Was kostet 4inOne?')?.a).toContain('steht noch nicht fest');
  });

  it('avoids the generic page kit: no italics, no checkmark lists, no blur-in', () => {
    const { el } = render();
    expect(el.querySelectorAll('em, i:not(:empty)')).toHaveLength(0);
    expect(el.querySelector('#so-gehts, .steps, .card__list, [data-hero]')).toBeNull();
  });

  it('makes no invented claims: no testimonials, ratings, user numbers, prices or AI', () => {
    const { el } = render();
    const text = el.querySelector('main')!.textContent!;
    expect(text).not.toMatch(/Testimonial|Bewertung|Tausende|\d+\s?(k|K)?\+? Nutzer|kostenlos|gratis|€\s?\/\s?Monat|KI\b|Beta|100\s?% sicher/);
  });

  it('says each core message once: "was zusammengehört" only in the headline, no second "Probier aus" heading, one promise per area', () => {
    const { component, el } = render();
    const text = el.querySelector('main')!.textContent!;
    expect(text.match(/zusammengehört/g)).toHaveLength(1);
    expect(Array.from(el.querySelectorAll('h2')).filter((h) => h.textContent!.startsWith('Probier aus'))).toHaveLength(1);
    expect(text.match(/ändert keine Rechte/g)).toHaveLength(1);
    expect(el.querySelector('.panel__promise')).toBeNull();
    for (const area of component.areas) expect(area.features.some((f) => f.text === area.benefit)).toBe(false);
  });
});
