import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { ModuleCard } from './module-card';

describe('ModuleCard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModuleCard],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders title, "Alle"-Link, action button and the matching section icon from inputs', () => {
    const fixture = TestBed.createComponent(ModuleCard);
    fixture.componentRef.setInput('accent', 'finance');
    fixture.componentRef.setInput('title', 'Finanzen');
    fixture.componentRef.setInput('allLink', '/finanzen');
    fixture.componentRef.setInput('actionLabel', 'Ausgabe erfassen');
    fixture.componentRef.setInput('actionLink', '/finanzen');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.module-card__title')?.textContent).toContain('Finanzen');
    expect(compiled.querySelector('.module-card__all')?.textContent).toContain('Alle');
    expect(compiled.querySelector('.module-card__action')?.textContent).toContain('Ausgabe erfassen');
    expect(compiled.querySelector('.module-card')?.className).toContain('module-card--finance');
    // Genau die verbindliche Finanzen-Icon-Komponente, kein eigenes SVG.
    expect(compiled.querySelector('.module-card__icon icon-finanzen')).toBeTruthy();
  });

  it('picks icon-haushalt for accent="household" and icon-organisation for accent="organize"', () => {
    const fixture = TestBed.createComponent(ModuleCard);
    fixture.componentRef.setInput('accent', 'household');
    fixture.componentRef.setInput('title', 'Haushalt');
    fixture.componentRef.setInput('allLink', '/haushalt');
    fixture.componentRef.setInput('actionLabel', 'Aufgabe hinzufügen');
    fixture.componentRef.setInput('actionLink', '/haushalt');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('icon-haushalt')).toBeTruthy();

    fixture.componentRef.setInput('accent', 'organize');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('icon-organisation')).toBeTruthy();
  });
});
