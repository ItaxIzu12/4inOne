import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Dashboard } from './dashboard';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
describe('Dashboard', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  it('labels seed data and exposes one heading and a skip link', () => {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    const el = f.nativeElement;
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('.skip-link')).toBeTruthy();
    expect(el.querySelector('.preview-note').textContent).toContain('Beispieldaten');
  });
  it('does not fetch private finance or household data for the preview', () => {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    TestBed.inject(HttpTestingController).expectNone(
      (req) => req.url.includes('/finanzen/') || req.url.includes('/haushalt/'),
    );
  });
  it('offers four domain destinations and a working local packing preview', () => {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('.domain').length).toBe(4);
    f.nativeElement.querySelector('.suggestion button').click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('[role="dialog"]').textContent).toContain('Packliste');
    const checkbox = f.nativeElement.querySelector('.packing-row input');
    checkbox.click();
    f.detectChanges();
    expect(f.componentInstance.packing()[0]).toBe(true);
  });
  it('opens search and filters navigation without accessing domain records', () => {
    const f = TestBed.createComponent(Dashboard);
    f.detectChanges();
    f.nativeElement.querySelector('.search').click();
    f.detectChanges();
    const input = f.nativeElement.querySelector('#app-search');
    input.value = 'Haushalt';
    input.dispatchEvent(new Event('input'));
    f.detectChanges();
    const links = f.nativeElement.querySelectorAll('.dialog-body a');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('/haushalt');
  });
});
