import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TileFooter } from './tile-footer';

describe('TileFooter', () => {
  function render(variant?: 'full' | 'compact', areaBase?: string) {
    TestBed.configureTestingModule({ imports: [TileFooter], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(TileFooter);
    if (variant) fixture.componentRef.setInput('variant', variant);
    if (areaBase !== undefined) fixture.componentRef.setInput('areaBase', areaBase);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('always carries the legal links; compact shows the brand and nothing else', () => {
    const el = render();
    const legal = Array.from(el.querySelectorAll('nav[aria-label="Rechtliches"] a')).map((a) => a.getAttribute('href'));
    expect(legal).toEqual(['/impressum', '/datenschutz', '/nutzungsbedingungen', '/barrierefreiheit']);
    expect(el.querySelector('.tf__logo app-brand')).toBeTruthy();
    expect(el.querySelector('nav[aria-label="Produkt"], .tf__area')).toBeNull();
    expect(el.querySelector('.tf__bar')?.textContent).toContain('4inOne');
  });

  it('full: columns Bereiche (into the demo), Produkt and Rechtliches — no big wordmark, no colour tiles', () => {
    const el = render('full');
    const areas = Array.from(el.querySelectorAll('.tf__area')).map((a) => [a.textContent?.trim(), a.getAttribute('href')]);
    expect(areas).toEqual([
      ['Finanzen', '/demo/finanzen'],
      ['Haushalt', '/demo/haushalt'],
      ['Organisation', '/demo/organisation'],
      ['Reisen', '/demo/reisen'],
    ]);
    const product = Array.from(el.querySelectorAll('nav[aria-label="Produkt"] a')).map((a) => a.getAttribute('href'));
    expect(product).toEqual(['/demo', '/#verknuepfen', '/login', '/registrieren']);
    expect(el.querySelector('.tile__word, .tile--areas, .tile--invite')).toBeNull();
  });

  it('areas can lead elsewhere, e.g. into the signed-in app', () => {
    const el = render('full', '');
    expect(el.querySelector('.tf__area')?.getAttribute('href')).toBe('/finanzen');
  });
});
