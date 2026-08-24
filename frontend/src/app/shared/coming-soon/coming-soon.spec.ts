import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ComingSoon } from './coming-soon';

describe('ComingSoon', () => {
  it('renders the title and description from route data', () => {
    TestBed.configureTestingModule({
      imports: [ComingSoon],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { title: 'Profil bearbeiten', description: 'Kommt noch.' } } },
        },
      ],
    });
    const fixture = TestBed.createComponent(ComingSoon);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent).toContain('Profil bearbeiten');
    expect(compiled.textContent).toContain('Kommt noch.');
  });
});
