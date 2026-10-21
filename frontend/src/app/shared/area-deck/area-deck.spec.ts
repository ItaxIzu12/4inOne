import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AreaDeck, AreaDeckCard } from './area-deck';

const CARDS: AreaDeckCard[] = [
  { key: 'f', tone: 'finance', icon: 'finance', name: 'Finanzen', text: 'Geld.', tags: ['Budget'], link: { label: 'Finanzen in der Demo', path: '/demo/finanzen' } },
  { key: 'h', tone: 'household', icon: 'household', name: 'Haushalt', text: 'Zuhause.' },
  { key: 'o', tone: 'organisation', icon: 'calendar', name: 'Organisation', text: 'Termine.' },
  { key: 'r', tone: 'travel', icon: 'travel', name: 'Reisen', text: 'Unterwegs.' },
];

@Component({
  standalone: true,
  imports: [AreaDeck],
  template: `<app-area-deck [cards]="cards" label="Bereiche" [(active)]="active" />`,
})
class Host {
  cards = CARDS;
  active = signal(0);
}

describe('AreaDeck', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, host: fixture.componentInstance };
  }

  it('shows only the active card in full, with its link; neighbours are buttons to bring them forward', () => {
    const { el } = setup();
    expect(el.querySelectorAll('article.card')).toHaveLength(1);
    expect(el.querySelector('article.card h3')?.textContent).toContain('Finanzen');
    expect(el.querySelector('article.card a')?.getAttribute('href')).toBe('/demo/finanzen');
    const side = Array.from(el.querySelectorAll('button.card--side')).map((b) => b.textContent?.replace(/\s+/g, ' ').trim());
    for (const name of ['Haushalt', 'Reisen']) {
      expect(side.some((t) => t?.includes(name) && t.includes('nach vorn holen'))).toBe(true);
    }
  });

  it('switches with a tap on a neighbour, the arrows and the keyboard, and wraps around', () => {
    const { fixture, el, host } = setup();
    (Array.from(el.querySelectorAll('button.card--side')).find((b) => b.textContent?.includes('Haushalt')) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host.active()).toBe(1);
    (el.querySelector('[aria-label="Vorheriger Bereich"]') as HTMLButtonElement).click();
    (el.querySelector('[aria-label="Vorheriger Bereich"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host.active()).toBe(3);
    el.querySelector('.deck')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    fixture.detectChanges();
    expect(host.active()).toBe(0);
    el.querySelector('.deck')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelector('article.card h3')?.textContent).toContain('Haushalt');
    expect(el.querySelector('[aria-live]')?.textContent).toContain('Haushalt: Zuhause.');
  });

  it('marks the current dot and hides the card behind the fan from screen readers', () => {
    const { el } = setup();
    expect(el.querySelector('.deck__dot[aria-current="true"]')?.getAttribute('aria-label')).toBe('Finanzen');
    const back = el.querySelector('.slot.is-back');
    expect(back?.getAttribute('aria-hidden')).toBe('true');
    expect(back?.querySelector('button')?.getAttribute('tabindex')).toBe('-1');
  });
});
