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

  it('shows a non-dismissible "Warum"-hint row with no close/dismiss control', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const whyRow = compiled.querySelector('.why-row');
    expect(whyRow).toBeTruthy();
    expect(whyRow?.querySelector('button')).toBeNull();
  });

  it('removed the aurora hero card, household strip and the comparison table (Minimal-Layout, design_system.md V2)', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.budget-hero')).toBeNull();
    expect(compiled.querySelector('.household-strip')).toBeNull();
    expect(compiled.querySelector('.compare-section')).toBeNull();
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

  it('renders the mobile bottom-nav with all four sections', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const bottomNavLinks = compiled.querySelectorAll('.bottom-nav a');
    expect(bottomNavLinks.length).toBe(4);
  });

  it('uses the exact same section-icon component in the bottom-nav and the matching module-row', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    for (const tag of ['icon-finanzen', 'icon-haushalt', 'icon-organisation']) {
      const occurrences = compiled.querySelectorAll(tag);
      // Bottom-Nav + Modul-Zeile = 2 Stellen innerhalb des Dashboards selbst
      // (die Header-Navigation lebt im gemeinsamen <app-header>, siehe
      // header.spec.ts) — immer dieselbe Icon-Komponente statt separat
      // implementierter SVGs.
      expect(occurrences.length).toBe(2);
    }
  });

  it('renders the three module rows as a flat list with a colored icon-wrap and a trailing chevron', () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const rows = compiled.querySelectorAll('.module-row');
    expect(rows.length).toBe(3);
    for (const row of Array.from(rows)) {
      expect(row.querySelector('.icon-wrap')).toBeTruthy();
      expect(row.querySelector('icon-chevron')).toBeTruthy();
    }
    // Kein Karten-Raster mehr — die Modul-Karten-Komponente wird hier nicht
    // mehr verwendet, siehe shared/module-card.
    expect(compiled.querySelector('app-module-card')).toBeNull();
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
