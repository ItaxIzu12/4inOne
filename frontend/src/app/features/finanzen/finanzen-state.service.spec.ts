import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Dashboard } from '../dashboard/dashboard';
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
 * WICHTIG: Assertions hier prüfen den GERENDERTEN DOM-Text (#balance-
 * heading), nicht nur interne Signal-Werte — ein früherer Versuch dieses
 * Tests verglich nur zwei intern abgeleitete Felder gegeneinander und
 * übersah dadurch einen echten Mapping-Bug (Dashboard zeigte budget.total
 * statt budget.planned als Hero-Zahl, beides aus demselben geteilten
 * Zustand abgeleitet, aber semantisch falsch zugeordnet — die interne
 * Konsistenzprüfung war also trivial wahr, obwohl die UI falsch war).
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

  it('Dashboard and Finanzen render the exact same budget figure in the DOM from the same demo data', () => {
    const dashboardFixture = TestBed.createComponent(Dashboard);
    dashboardFixture.detectChanges();
    const financeFixture = TestBed.createComponent(Finanzen);
    financeFixture.detectChanges();

    const dashboardHero = (dashboardFixture.nativeElement as HTMLElement).querySelector('#balance-heading')?.textContent?.trim();
    const financeHero = (financeFixture.nativeElement as HTMLElement).querySelector('#balance-heading')?.textContent?.trim();

    expect(dashboardHero).toBeTruthy();
    expect(dashboardHero).toBe(financeHero);
  });

  it('adding an expense on the Finanzen page is immediately reflected in the Dashboard budget DOM text, without the Dashboard fetching independently', () => {
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
    const financeHeroAfter = (financeFixture.nativeElement as HTMLElement).querySelector('#balance-heading')
      ?.textContent?.trim();

    expect(dashboardHeroAfter).not.toBe(dashboardHeroBefore);
    expect(dashboardHeroAfter).toBe(financeHeroAfter);
  });

  it('both components derive the same budget()/total/planned values from a single shared OverviewDto', () => {
    const dashboardFixture = TestBed.createComponent(Dashboard);
    dashboardFixture.detectChanges();
    const financeFixture = TestBed.createComponent(Finanzen);
    financeFixture.detectChanges();

    const dashboardInstance = dashboardFixture.componentInstance as unknown as {
      budget: () => { planned: number; total: number };
    };
    const financeInstance = financeFixture.componentInstance as unknown as {
      budget: () => { planned: number; total: number };
    };

    expect(dashboardInstance.budget().total).toBe(financeInstance.budget().total);
    expect(dashboardInstance.budget().planned).toBe(financeInstance.budget().planned);
  });

  it('deleting a transaction on the Finanzen page updates the Dashboard budget DOM text on next read', () => {
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
