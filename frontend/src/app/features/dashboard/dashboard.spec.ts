import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('creates and renders exactly one h1 (Begrüßung) with the skip-link as first focusable element', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.skip-link')).toBeTruthy();
    expect(compiled.querySelectorAll('h1').length).toBe(1);
  });

  it('ends with the "Ohne Kompass / Mit Kompass" comparison instead of a dismissible banner', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.why-banner')).toBeNull();

    const compareSection = compiled.querySelector('.compare-section');
    expect(compareSection).toBeTruthy();
    const rows = compiled.querySelectorAll('.compare-row');
    expect(rows.length).toBe(fixture.componentInstance['comparison'].length);
    // Steht als letzter Abschnitt am Ende der Seite.
    expect(compiled.querySelector('main.dashboard-main > :last-child')).toBe(compareSection);
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

  it('renders the mobile bottom-nav with all four sections', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const bottomNavLinks = compiled.querySelectorAll('.bottom-nav a');
    expect(bottomNavLinks.length).toBe(4);
  });

  it('uses the exact same section-icon component in the bottom-nav and the matching module-card', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    for (const tag of ['icon-finanzen', 'icon-haushalt', 'icon-organisation']) {
      const occurrences = compiled.querySelectorAll(tag);
      // Bottom-Nav + Modul-Karten-Kopfzeile = 2 Stellen innerhalb des
      // Dashboards selbst (die Header-Navigation lebt jetzt im
      // gemeinsamen <app-header>, siehe header.spec.ts) — immer dieselbe
      // Icon-Komponente statt separat implementierter SVGs.
      expect(occurrences.length).toBe(2);
    }
  });

  it('keeps the "Start" tab permanently as normal navigation (no scroll-triggered icon change)', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const startTab = compiled.querySelectorAll('.bottom-nav a')[0];
    expect(startTab.textContent).toContain('Start');
    expect(startTab.querySelector('icon-back-to-top')).toBeNull();
  });

  it('renders the same floating back-to-top button as the Finanzen/Haushalt/Organisation pages', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('app-back-to-top')).toBeTruthy();
  });
});
