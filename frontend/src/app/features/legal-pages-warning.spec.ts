import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Impressum } from './impressum/impressum';
import { Datenschutz } from './datenschutz/datenschutz';
import { Nutzungsbedingungen } from './nutzungsbedingungen/nutzungsbedingungen';
import { Barrierefreiheit } from './barrierefreiheit/barrierefreiheit';

/**
 * Regressionsschutz: der "vor Veröffentlichung von einem Anwalt prüfen"-
 * Warnhinweis muss auf JEDER der vier Rechtsseiten tatsächlich gerendert
 * werden — nicht nur theoretisch in der geteilten Komponente vorhanden sein.
 * Schlägt fehl, falls eine Seite künftig versehentlich ohne <app-legal-page>
 * gebaut wird oder der Hinweis aus der Projection entfernt wird.
 */
const PAGES = [
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
      expect(warning?.textContent).toContain('von einem Anwalt prüfen und ersetzen');
    });
  }
});
