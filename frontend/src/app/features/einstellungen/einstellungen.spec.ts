import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Einstellungen } from './einstellungen';

describe('Einstellungen', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Einstellungen],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  function render() {
    const fixture = TestBed.createComponent(Einstellungen);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lives inside the app shell, has exactly one h1 and one skip-link', () => {
    const el = render();
    expect(el.querySelector('app-shell')).toBeTruthy();
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelectorAll('.skip-link').length).toBe(1);
  });

  it('groups the settings under headings and links every row', () => {
    const el = render();
    const titles = Array.from(el.querySelectorAll('.settings-group__title')).map((h) => h.textContent?.trim());
    expect(titles).toEqual(['Konto', 'Sicherheit', 'Datenschutz und Rechtliches']);
    const links = Array.from(el.querySelectorAll('a.settings-row')).map((a) => a.getAttribute('href'));
    expect(links).toEqual([
      '/einstellungen/profil',
      '/einstellungen/zwei-faktor',
      '/einstellungen/sitzungen',
      '/datenschutz',
      '/nutzungsbedingungen',
      '/impressum',
      '/barrierefreiheit',
    ]);
    expect(el.querySelectorAll('.settings-row--soon, .settings-row__badge').length).toBe(0); // nichts mehr „bald“
  });

  it('offers Abmelden', () => {
    expect(render().textContent).toContain('Abmelden');
  });
});
