import { BRAND, BRAND_DEFAULT_TITLE, BRAND_SECTIONS, brandAreaForUrl, brandTitle } from './brand.config';

describe('Brand-Konfiguration (Lumiknot)', () => {
  it('Registry: Schlüssel = stabile ID, Logo-Kontext und Theme passen zur ID', () => {
    for (const [key, area] of Object.entries(BRAND.areas)) {
      expect(area.id).toBe(key);
      expect(area.logoContext).toBe(key);
      expect(area.theme).toBe(key);
    }
  });

  it('vier Fachbereiche in Navigationsreihenfolge, Routen eindeutig und nicht leer', () => {
    expect(BRAND_SECTIONS.map((a) => a.id)).toEqual(['finance', 'household', 'organization', 'travel']);
    const routes = BRAND_SECTIONS.map((a) => a.route);
    expect(new Set(routes).size).toBe(4);
    expect(routes.every(Boolean)).toBe(true);
    expect(BRAND.areas.global.route).toBe('');
  });

  it('ordnet URLs dem Bereich zu, auch unter /demo und mit Parametern', () => {
    expect(brandAreaForUrl('/finanzen')).toBe('finance');
    expect(brandAreaForUrl('/demo/reisen?tab=packen')).toBe('travel');
    expect(brandAreaForUrl('/organisation/kalender#heute')).toBe('organization');
    expect(brandAreaForUrl('/demo/haushalt')).toBe('household');
    expect(brandAreaForUrl('/demo')).toBe('global');
    expect(brandAreaForUrl('/')).toBe('global');
    expect(brandAreaForUrl('/einstellungen')).toBe('global');
    expect(brandAreaForUrl('/demonstration')).toBe('global');
  });

  it('Titel', () => {
    expect(BRAND_DEFAULT_TITLE).toBe('Lumiknot — Dein Alltag. Alles verbunden.');
    expect(brandTitle('Anmelden')).toBe('Anmelden | Lumiknot');
  });
});
