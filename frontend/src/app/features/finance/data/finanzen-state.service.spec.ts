import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Observable, throwError } from 'rxjs';
import { AnalysenDto } from './finanzen-api.service';
import { DemoFinanzenDataProvider } from './demo-finanzen-data-provider';
import { FINANZEN_DATA_PROVIDER } from './finanzen-data-provider';
import { FinanzenStateService } from './finanzen-state.service';

describe('FinanzenStateService — Übersicht und Analysen gemeinsam', () => {
  class CountingProvider extends DemoFinanzenDataProvider {
    overviewCalls = 0;
    analysenCalls = 0;
    failAnalysen = false;

    override getOverview() {
      this.overviewCalls++;
      return super.getOverview();
    }

    override getAnalysen(): Observable<AnalysenDto> {
      this.analysenCalls++;
      return this.failAnalysen
        ? throwError(() => new Error('Analysen ausgefallen'))
        : super.getAnalysen();
    }
  }

  let provider: CountingProvider;
  let state: FinanzenStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: FINANZEN_DATA_PROVIDER, useClass: CountingProvider },
        FinanzenStateService,
      ],
    });
    provider = TestBed.inject(FINANZEN_DATA_PROVIDER) as CountingProvider;
    state = TestBed.inject(FinanzenStateService);
  });

  it('starts empty', () => {
    expect(state.uebersicht()).toBeNull();
    expect(state.analysen()).toBeNull();
  });

  it('laden() loads only the overview (the Dashboard needs nothing else)', () => {
    state.laden();

    expect(provider.overviewCalls).toBe(1);
    expect(provider.analysenCalls).toBe(0);
    expect(state.uebersicht()).not.toBeNull();
    expect(state.analysen()).toBeNull();
  });

  it('ladenBeide() loads overview and analysen', () => {
    state.ladenBeide();

    expect(provider.overviewCalls).toBe(1);
    expect(provider.analysenCalls).toBe(1);
    expect(state.uebersicht()).not.toBeNull();
    expect(state.analysen()).not.toBeNull();
  });

  it('invalidieren() reloads BOTH datasets and picks up a change made in between', async () => {
    state.ladenBeide();
    const before = Number(state.analysen()?.verfuegbares_einkommen);

    await new Promise<void>((resolve) =>
      provider
        .addTransaction({
          amount: 50,
          description: 'x',
          categoryId: 'demo-haushalt',
          datum: '2026-09-15',
        })
        .subscribe(() => resolve()),
    );
    state.invalidieren();

    expect(provider.overviewCalls).toBe(2);
    expect(provider.analysenCalls).toBe(2);
    expect(Number(state.analysen()?.verfuegbares_einkommen)).toBe(before - 50);
  });

  it('a failing analysen request sets analysenError without breaking the overview', () => {
    provider.failAnalysen = true;

    state.ladenBeide();

    expect(state.analysenError()).toBe(true);
    expect(state.error()).toBe(false);
    expect(state.uebersicht()).not.toBeNull();
  });

  it('a later successful reload clears the analysen error', () => {
    provider.failAnalysen = true;
    state.ladenBeide();
    expect(state.analysenError()).toBe(true);

    provider.failAnalysen = false;
    state.invalidieren();

    expect(state.analysenError()).toBe(false);
    expect(state.analysen()).not.toBeNull();
  });
});
