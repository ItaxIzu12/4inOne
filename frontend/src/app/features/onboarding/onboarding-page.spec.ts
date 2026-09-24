import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OnboardingPage } from './onboarding-page';
import { OnboardingApiService } from '../../core/onboarding/onboarding-api.service';
describe('OnboardingPage', () => {
  const api = { getProfile: vi.fn(), complete: vi.fn() };
  beforeEach(() => {
    api.getProfile.mockReturnValue(
      of({ needs_onboarding: true, completed: false, usage: null, domains: [] }),
    );
    api.complete.mockReset();
    TestBed.configureTestingModule({
      imports: [OnboardingPage],
      providers: [provideRouter([]), { provide: OnboardingApiService, useValue: api }],
    });
  });
  it('requires choices and retains them when going back', () => {
    const f = TestBed.createComponent(OnboardingPage);
    f.detectChanges();
    const c = f.componentInstance;
    c.next();
    c.next();
    expect(c.step()).toBe(2);
    expect(c.error()).toBeTruthy();
    c.usage.set('shared');
    c.next();
    c.next();
    expect(c.step()).toBe(3);
    c.toggle('finanzen');
    c.toggle('haushalt');
    c.next();
    expect(c.step()).toBe(4);
    c.move(3);
    expect(c.selected()).toEqual(['finanzen', 'haushalt']);
    expect(api.complete).not.toHaveBeenCalled();
  });
  it('redirects an existing account without displaying onboarding', () => {
    api.getProfile.mockReturnValue(of({ needs_onboarding: false }));
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const f = TestBed.createComponent(OnboardingPage);
    f.detectChanges();
    expect(nav).toHaveBeenCalledWith('/app', { replaceUrl: true });
    expect(f.componentInstance.allowed()).toBe(false);
  });
  it('shows a retry state rather than treating a failed status call as empty data', () => {
    api.getProfile.mockReturnValue(throwError(() => new Error()));
    const f = TestBed.createComponent(OnboardingPage);
    f.detectChanges();
    expect(f.componentInstance.allowed()).toBe(false);
    expect(f.nativeElement.textContent).toContain('Erneut versuchen');
  });
  it('only navigates after preferences have been saved', () => {
    api.complete.mockReturnValue(throwError(() => new Error()));
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const c = TestBed.createComponent(OnboardingPage).componentInstance;
    c.usage.set('personal');
    c.toggle('haushalt');
    c.finish();
    expect(nav).not.toHaveBeenCalled();
    expect(c.error()).toContain('nicht gespeichert');
    api.complete.mockReturnValue(of({ completed: true }));
    c.finish();
    expect(api.complete).toHaveBeenLastCalledWith('personal', ['haushalt']);
    expect(nav).toHaveBeenCalledWith('/app', { replaceUrl: true });
  });
});
