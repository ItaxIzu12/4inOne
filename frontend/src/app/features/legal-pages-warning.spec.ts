import { Type as ComponentType } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Impressum } from './impressum/impressum';
import { Datenschutz } from './datenschutz/datenschutz';
import { Nutzungsbedingungen } from './nutzungsbedingungen/nutzungsbedingungen';
import { Barrierefreiheit } from './barrierefreiheit/barrierefreiheit';

/**
 * Regressionsschutz: der Platzhalter-
 * Warnhinweis muss auf JEDER der vier Rechtsseiten tatsächlich gerendert
 * werden — nicht nur theoretisch in der geteilten Komponente vorhanden sein.
 * Schlägt fehl, falls eine Seite künftig versehentlich ohne <app-legal-page>
 * gebaut wird oder der Hinweis aus der Projection entfernt wird.
 */
const PAGES: { name: string; Type: ComponentType<unknown> }[] = [
  { name: 'Impressum', Type: Impressum },
  { name: 'Datenschutz', Type: Datenschutz },
  { name: 'Nutzungsbedingungen', Type: Nutzungsbedingungen },
  { name: 'Barrierefreiheit', Type: Barrierefreiheit },
];

describe('Warnhinweis auf allen vier Rechtsseiten', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([])],
    }).compileComponents();
  });

  for (const { name, Type } of PAGES) {
    it(`${name} rendert den Platzhalter-Warnhinweis`, async () => {
      await TestBed.configureTestingModule({ imports: [Type] }).compileComponents();
      const fixture = TestBed.createComponent(Type);
      fixture.detectChanges();

      const warning = (fixture.nativeElement as HTMLElement).querySelector('.legal-warning');
      expect(warning).toBeTruthy();
      expect(warning?.textContent).toContain('Platzhaltertext');
      expect(warning?.textContent).toContain('noch nicht rechtsverbindlich');
      expect(warning?.textContent).not.toMatch(/\.md\b/); // keine internen Dateinamen öffentlich
    });
  }
});

/** Testversion (GitHub Pages): echte Kurztexte statt Platzhalter, ehrlicher Hinweis auf die Demo. */
describe('Rechtsseiten in der Testversion', () => {
  for (const { name, Type } of PAGES) {
    it(`${name} zeigt den Demo-Text ohne Platzhalter`, async () => {
      await TestBed.configureTestingModule({ imports: [Type], providers: [provideRouter([])] }).compileComponents();
      const fixture = TestBed.createComponent(Type);
      (fixture.componentInstance as { demo: boolean }).demo = true;
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.legal-warning--demo')?.textContent).toContain('Gilt für die Testversion');
      expect(el.textContent).not.toContain('Platzhalter');
      expect(el.textContent).not.toContain('Kompass');
      // Kontakt nur über den öffentlichen GitHub-Weg – keine privaten Angaben im Code
      expect(el.querySelector('a[href^="https://github.com/"]')).toBeTruthy();
      expect(el.textContent).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
    });
  }
});
