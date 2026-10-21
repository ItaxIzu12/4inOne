import { PageViews, TRACKED_PATHS } from './page-views';

describe('PageViews.pathOf', () => {
  it('counts public pages without query or fragment', () => {
    expect(PageViews.pathOf('/impressum?ref=mail#oben', false)).toBe('/impressum');
    expect(PageViews.pathOf('/', false)).toBe('/');
  });

  it('never counts app areas or links that carry tokens', () => {
    for (const url of ['/finanzen', '/einladung/abc123', '/passwort-zuruecksetzen#token=x', '/einstellungen/profil']) {
      expect(PageViews.pathOf(url, false)).toBeNull();
    }
  });

  it('counts unknown addresses as 404, without the address itself', () => {
    expect(PageViews.pathOf('/irgendwas/mit/daten', true)).toBe('/404');
  });

  it('only lists paths the backend accepts', () => {
    expect([...TRACKED_PATHS].every((p) => p.startsWith('/') && p.length <= 60)).toBe(true);
  });
});
