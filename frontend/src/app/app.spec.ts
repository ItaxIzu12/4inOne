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

  it('renders the global header on marketing routes (e.g. /login)', async () => {
    fixture.detectChanges();
    await router.navigateByUrl('/login');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('Kompass');
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
