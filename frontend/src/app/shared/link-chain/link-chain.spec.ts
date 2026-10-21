import { TestBed } from '@angular/core/testing';
import { LinkChain } from './link-chain';

describe('LinkChain', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [LinkChain] });
    const fixture = TestBed.createComponent(LinkChain);
    fixture.detectChanges();
    fixture.detectChanges(); // viewChildren → Linien
    return fixture;
  }

  it('shows the washing-machine example with one beam between each pair of neighbours', () => {
    const el = setup().nativeElement as HTMLElement;
    const titles = Array.from(el.querySelectorAll('.chain__row b')).map((b) => b.textContent);
    expect(titles).toEqual(['Waschmaschine', 'Neue Waschmaschine', 'Angebote vergleichen', 'Lieferung']);
    expect(el.querySelectorAll('app-animated-beam')).toHaveLength(3);
    expect(el.querySelectorAll('.chain__meter')).toHaveLength(1);
    expect(el.querySelector('figcaption')?.textContent).toContain('Beispielwerte');
  });

  it('marks the area of every link with its tone class and hides the icons from screen readers', () => {
    const el = setup().nativeElement as HTMLElement;
    const rows = Array.from(el.querySelectorAll('.chain__row'));
    expect(rows.map((r) => r.className.match(/tone-(\w+)/)?.[1])).toEqual(['household', 'finance', 'organisation', 'organisation']);
    expect(el.querySelectorAll('.chain__icon[aria-hidden="true"]')).toHaveLength(4);
  });

  it('accepts its own links and heading', () => {
    const fixture = TestBed.configureTestingModule({ imports: [LinkChain] }).createComponent(LinkChain);
    fixture.componentRef.setInput('heading', 'Beispiel: Urlaub');
    fixture.componentRef.setInput('links', [
      { tone: 'travel', icon: 'travel', kind: 'Reisen · Reise', title: 'Lissabon', value: 'Mai' },
      { tone: 'finance', icon: 'piggy', kind: 'Finanzen · Sparziel', title: 'Urlaubskasse', value: '300 €' },
    ]);
    fixture.detectChanges();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.chain__head')?.textContent).toBe('Beispiel: Urlaub');
    expect(el.querySelectorAll('app-animated-beam')).toHaveLength(1);
  });
});
