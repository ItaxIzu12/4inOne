import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PasswortVergessen } from './passwort-vergessen';

describe('PasswortVergessen', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswortVergessen],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('has a single labelled email field and does not submit when invalid', () => {
    const fixture = TestBed.createComponent(PasswortVergessen);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('label[for="reset-email"]')).toBeTruthy();

    component['submit']();
    expect(component['submitting']()).toBe(false);
    expect(component['form'].controls.email.touched).toBe(true);
  });
});
