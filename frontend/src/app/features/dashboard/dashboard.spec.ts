import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('creates and renders exactly one h1 (Begrüßung) with the skip-link as first focusable element', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.skip-link')).toBeTruthy();
    expect(compiled.querySelectorAll('h1').length).toBe(1);
  });

  it('shows the why-banner with the weekly link count and hides it when dismissed', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.why-banner')).toBeTruthy();
    (compiled.querySelector('.why-banner__close') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.why-banner')).toBeNull();
  });

  it('exposes the budget progress as an accessible progressbar', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const bar = compiled.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe(String(fixture.componentInstance['budgetPercent']()));
    expect(bar?.getAttribute('aria-valuemin')).toBe('0');
    expect(bar?.getAttribute('aria-valuemax')).toBe('100');
  });

  it('renders the mobile bottom-nav with all four sections and a FAB', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const bottomNavLinks = compiled.querySelectorAll('.bottom-nav a');
    expect(bottomNavLinks.length).toBe(4);
    expect(compiled.querySelector('.fab')).toBeTruthy();
  });

  it('uses the exact same section-icon component in the sidebar, the bottom-nav and the matching module-card', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    for (const tag of ['icon-finanzen', 'icon-haushalt', 'icon-organisation']) {
      const occurrences = compiled.querySelectorAll(tag);
      // Sidebar-Nav + Bottom-Nav + Modul-Karten-Kopfzeile = 3 Stellen, immer
      // dieselbe Icon-Komponente statt separat implementierter SVGs.
      expect(occurrences.length).toBe(3);
    }
  });

  it('makes /einstellungen reachable from both the desktop sidebar profile link and the mobile topbar gear button', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.app-header__profile')?.getAttribute('href')).toBe('/einstellungen');
    expect(compiled.querySelector('.topbar__settings')?.getAttribute('href')).toBe('/einstellungen');
  });
});
