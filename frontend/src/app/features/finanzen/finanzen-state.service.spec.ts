import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Observable, throwError } from 'rxjs';
import { Dashboard } from '../dashboard/dashboard';
import { AnalysenDto } from './finanzen-api.service';
import { Finanzen } from './finanzen';
import { DemoFinanzenDataProvider } from './demo-finanzen-data-provider';
import { FINANZEN_DATA_PROVIDER } from './finanzen-data-provider';
import { FinanzenStateService } from './finanzen-state.service';

/**
 * Der eigentliche Kern des Prompts: Dashboard und Finanzen dürfen niemals
 * auseinanderlaufen. Registriert FinanzenStateService EINMAL im selben
 * TestBed-Modul (genau wie app.routes.ts es pro Routengruppe tut) — beide
 * Components teilen sich dadurch dieselbe Instanz, exakt wie im echten
 * Routing.
 *
 * Seit dem Design-Entwurf (Version 3) zeigt der Dashboard-Hero "Diesen
 * Monat verfügbar" (verfuegbares_einkommen), NICHT mehr denselben Wert wie
 * Finanzen-Übersicht ("ausgegeben") — das sind laut Entwurf bewusst zwei
 * unterschiedliche Kennzahlen. Der geteilte Wert ist jetzt
 * verfuegbares_einkommen, exakt derselbe wie im Finanzen-Analysen-Tab.
 *
 * WICHTIG: Assertions hier prüfen den GERENDERTEN DOM-Text, nicht nur
 * interne Signal-Werte — ein früherer Versuch dieses Tests verglich nur
 * zwei intern abgeleitete Felder gegeneinander und übersah dadurch einen
 * echten Mapping-Bug (die UI zeigte einen anderen Wert als die Signale).
 */
describe('FinanzenStateService — geteilter Zustand zwischen Dashboard und Finanzen', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard, Finanzen],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: FINANZEN_DATA_PROVIDER, useClass: DemoFinanzenDataProvider },
        FinanzenStateService,
      ],
    }).compileComponents();
  });

  function financeIncomeHeroText(fixture: {
    componentInstance: unknown;
    nativeElement: unknown;
    detectChanges: () => void;
  }): string | undefined {
    (fixture.componentInstance as { selectTab: (tab: 'uebersicht' | 'analysen') => void }).selectTab('analysen');
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('#income-heading')?.textContent?.trim();
  }

  it('Dashboard hero and Finanzen Analysen-Tab render the exact same "Verfügbares Einkommen" figure', () => {
    const dashboardFixture = TestBed.createComponent(Dashboard);
    dashboardFixture.detectChanges();
    const financeFixture = TestBed.createComponent(Finanzen);
    financeFixture.detectChanges();

    const dashboardHero = (dashboardFixture.nativeElement as HTMLElement).querySelector('#balance-heading')?.textContent?.trim();
    financeFixture.detectChanges();
    const financeHero = financeIncomeHeroText(financeFixture);
    financeFixture.detectChanges();

    expect(dashboardHero).toBeTruthy();
    expect(dashboardHero).toBe(financeHero);
  });

  it('adding an expense on the Finanzen page is immediately reflected in the Dashboard hero DOM text, without the Dashboard fetching independently', () => {
    const dashboardFixture = TestBed.createComponent(Dashboard);
    dashboardFixture.detectChanges();

    const financeFixture = TestBed.createComponent(Finanzen);
    financeFixture.detectChanges();
    const financeInstance = financeFixture.componentInstance as unknown as {
      addAmount: { set: (v: string) => void };
      addDescription: { set: (v: string) => void };
      addSelectedCategoryId: { set: (v: string) => void };
      submitAddExpense: () => void;
    };

    const dashboardHeroBefore = (dashboardFixture.nativeElement as HTMLElement).querySelector('#balance-heading')
      ?.textContent?.trim();

    financeInstance.addAmount.set('42');
    financeInstance.addDescription.set('Konsistenz-Test');
    financeInstance.addSelectedCategoryId.set('demo-fixkosten');
    financeInstance.submitAddExpense();
    financeFixture.detectChanges();

    // KEIN dashboardFixture-eigener Reload-Aufruf hier — nur detectChanges(),
    // um den bereits aktualisierten GETEILTEN Zustand neu zu rendern. Würde
    // Dashboard unabhängig eine zweite Berechnung machen, bliebe es beim
    // alten Wert stehen.
    dashboardFixture.detectChanges();

    const dashboardHeroAfter = (dashboardFixture.nativeElement as HTMLElement).querySelector('#balance-heading')
      ?.textContent?.trim();
    const financeHeroAfter = financeIncomeHeroText(financeFixture);

    expect(dashboardHeroAfter).not.toBe(dashboardHeroBefore);
    expect(dashboardHeroAfter).toBe(financeHeroAfter);
  });

  it('deleting a transaction on the Finanzen page updates the Dashboard hero DOM text on next read', () => {
    const dashboardFixture = TestBed.createComponent(Dashboard);
    dashboardFixture.detectChanges();

    const financeFixture = TestBed.createComponent(Finanzen);
    financeFixture.detectChanges();
    const financeInstance = financeFixture.componentInstance as unknown as {
      transactions: () => { id: unknown; amount: string }[];
      openEditModal: (tx: { id: unknown }) => void;
      requestDelete: () => void;
      confirmDelete: () => void;
    };

    const dashboardHeroBefore = (dashboardFixture.nativeElement as HTMLElement).querySelector('#balance-heading')
      ?.textContent?.trim();
    const firstTransaction = financeInstance.transactions()[0];

    financeInstance.openEditModal(firstTransaction);
    financeInstance.requestDelete();
    financeInstance.confirmDelete();
    financeFixture.detectChanges();
    dashboardFixture.detectChanges();

    const dashboardHeroAfter = (dashboardFixture.nativeElement as HTMLElement).querySelector('#balance-heading')
      ?.textContent?.trim();

    expect(dashboardHeroAfter).not.toBe(dashboardHeroBefore);
  });
});


/**
 * Der Service hält seit der Erweiterung AUCH die Analysen. Jede
 * Schreiboperation ruft invalidieren() auf — das muss BEIDE Datensätze neu
 * laden, sonst zeigt der jeweils andere Tab einen veralteten Stand.
 */
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
      return this.failAnalysen ? throwError(() => new Error('Analysen ausgefallen')) : super.getAnalysen();
    }
  }

  let provider: CountingProvider;
  let state: FinanzenStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: FINANZEN_DATA_PROVIDER, useClass: CountingProvider }, FinanzenStateService],
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
        .addTransaction({ amount: 50, description: 'x', categoryId: 'demo-haushalt', datum: '2026-09-15' })
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
