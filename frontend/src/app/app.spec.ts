import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    router = TestBed.inject(Router);
  });

  it('should create the app', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the global header on marketing routes (e.g. /impressum)', async () => {
    fixture.detectChanges();
    await router.navigateByUrl('/impressum');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('Kompass');
  });

  it('hides the global header on /login and /registrieren (its own "Anmelden"-Button there would be redundant)', async () => {
    fixture.detectChanges();
    await router.navigateByUrl('/login');
    fixture.detectChanges();
    await fixture.whenStable();

    let compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-header')).toBeNull();

    await router.navigateByUrl('/registrieren');
    fixture.detectChanges();
    await fixture.whenStable();

    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-header')).toBeNull();
  });

  it('keeps the shared header AND footer on the dashboard, but hides the marketing back-to-top/bottom-nav', async () => {
    fixture.detectChanges();
    await router.navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('Kompass');
    // Footer ist überall vorhanden — auch im Dashboard, siehe app.html.
    expect(compiled.querySelector('.site-footer')).toBeTruthy();
    expect(compiled.querySelector('app-bottom-nav .nav-item')).toBeNull();
  });
});
