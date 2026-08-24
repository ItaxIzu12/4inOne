import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LegalPage } from './legal-page';

@Component({
  standalone: true,
  imports: [LegalPage],
  template: `
    <app-legal-page title="Testseite">
      <p>Beispiel-Inhalt</p>
    </app-legal-page>
  `,
})
class HostComponent {}

describe('LegalPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the given title as h1, the projected content and a back-link', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent).toContain('Testseite');
    expect(compiled.querySelector('.legal-page__content')?.textContent).toContain('Beispiel-Inhalt');
    expect(compiled.querySelector('.back-link')).toBeTruthy();
  });

  it('always renders the placeholder warning block, regardless of projected content', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const warning = (fixture.nativeElement as HTMLElement).querySelector('.legal-warning');

    expect(warning).toBeTruthy();
    expect(warning?.textContent).toContain('Platzhaltertext');
    expect(warning?.textContent).toContain('von einem Anwalt prüfen und ersetzen');
  });
});
