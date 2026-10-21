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

  it('always carries the legal links (compact by default, no invitation)', () => {
    const el = render();
    const legal = Array.from(el.querySelectorAll('nav[aria-label="Rechtliches"] a')).map((a) => a.getAttribute('href'));
    expect(legal).toEqual(['/impressum', '/datenschutz', '/nutzungsbedingungen', '/barrierefreiheit']);
    expect(el.querySelector('.tile--invite')).toBeNull();
    expect(el.querySelector('.tile--areas')).toBeNull();
  });

  it('full: invitation to register and the four areas, each leading into the demo', () => {
    const el = render('full');
    expect(el.querySelector('.tile--invite a')?.getAttribute('href')).toBe('/registrieren');
    const areas = Array.from(el.querySelectorAll('.tile--areas a')).map((a) => [a.querySelector('.area__name')?.textContent, a.getAttribute('href')]);
    expect(areas).toEqual([
      // Reihenfolge wie im Zeichen: grün, blau, gelb, rosa
      ['Finanzen', '/demo/finanzen'],
      ['Reisen', '/demo/reisen'],
      ['Organisation', '/demo/organisation'],
      ['Haushalt', '/demo/haushalt'],
    ]);
  });

  it('areas can lead elsewhere, e.g. into the signed-in app', () => {
    const el = render('full', '');
    expect(el.querySelector('.tile--areas a')?.getAttribute('href')).toBe('/finanzen');
  });
});
