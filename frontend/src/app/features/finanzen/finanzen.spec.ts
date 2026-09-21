import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { DemoFinanzenDataProvider } from './demo-finanzen-data-provider';
import { FINANZEN_DATA_PROVIDER, FinanzenDataProvider } from './finanzen-data-provider';
import { FinanzenStateService } from './finanzen-state.service';
import {
  AnalysenDto,
  CategoryDto,
  OverviewDto,
  RecurringDeductionDto,
  TransactionDto,
  TransactionPage,
} from './finanzen-api.service';
import { Finanzen } from './finanzen';

describe('Finanzen', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Finanzen],
      // DemoFinanzenDataProvider statt HttpClient: liefert synchron (of())
      // feste Beispieldaten, macht KEINE HTTP-Aufrufe — dieselbe
      // Implementierung, die auch die öffentliche Demo-Route nutzt (siehe
      // app.routes.ts). FinanzenStateService ist bewusst NICHT
      // providedIn:'root' (siehe finanzen-state.service.ts) — muss hier wie
      // in den echten Routen (app.routes.ts) explizit bereitgestellt werden.
      providers: [
        { provide: FINANZEN_DATA_PROVIDER, useClass: DemoFinanzenDataProvider },
        FinanzenStateService,
      ],
    }).compileComponents();
  });

  it('creates and renders the budget as an accessible progressbar', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const bar = compiled.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe(String(fixture.componentInstance['budgetPercent']()));
    expect(bar?.getAttribute('aria-valuemin')).toBe('0');
    expect(bar?.getAttribute('aria-valuemax')).toBe('100');
  });

  it('renders every demo transaction as a table row', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const rows = compiled.querySelectorAll('.tx-table tbody tr');
    expect(rows.length).toBe(fixture.componentInstance['transactions']().length);
  });

  it('has exactly two tabs, Übersicht (selected initially) and Analysen, both enabled — no disabled placeholder tabs', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const tabs = compiled.querySelectorAll('.subtab');
    expect(tabs.length).toBe(2);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true'); // Übersicht
    expect(tabs[1].getAttribute('aria-selected')).toBe('false'); // Analysen
    expect(tabs[0].hasAttribute('disabled')).toBe(false);
    expect(tabs[1].hasAttribute('disabled')).toBe(false);
  });

  it('does not use the old "in Entwicklung" placeholder markup', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.status-badge')).toBeNull();
    expect(compiled.querySelector('.feature-grid')).toBeNull();
  });

  it('adding an expense via DemoFinanzenDataProvider only ever updates local state (of(), no HttpClient involved)', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as {
      transactions: () => unknown[];
      addAmount: { set: (v: string) => void };
      addDescription: { set: (v: string) => void };
      addSelectedCategoryId: { set: (v: string) => void };
      submitAddExpense: () => void;
    };

    const before = instance.transactions().length;
    instance.addAmount.set('42');
    instance.addDescription.set('Testausgabe');
    instance.addSelectedCategoryId.set('demo-fixkosten');
    instance.submitAddExpense();
    fixture.detectChanges();

    expect(instance.transactions().length).toBe(before + 1);
  });

  it('renders the household strip for the solo demo household: name "Anna" and exactly one avatar', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.household-strip__name')?.textContent).toContain('Anna');
    expect(compiled.querySelectorAll('.household-strip__avatar').length).toBe(1);
  });

  it('renders NO Faire Aufteilung section for the solo demo household — absent from the DOM, not just hidden', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#fairness-heading')).toBeNull();
    expect(compiled.querySelector('.fairness-people')).toBeNull();
    expect(compiled.querySelector('.fairness-bar')).toBeNull();
    expect(compiled.textContent).not.toContain('Faire Aufteilung');
    expect(compiled.textContent).not.toContain('Jonas');
  });

  it('transactions carry no per-person attribution in the solo demo (no "Von" column)', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const headers = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.tx-table thead th')).map((th) =>
      th.textContent?.trim(),
    );

    expect(headers).toEqual(['Beschreibung', 'Kategorie', 'Betrag']);
  });

  it('shows category chips to choose from in the add-expense modal', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.btn-primary')?.click();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const chips = compiled.querySelectorAll('.category-chip');
    expect(chips.length).toBe(3); // Fixkosten/Haushalt/Sonstiges
  });

  it('shows the monthly goal next to a category that has one', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.legend-goal')?.textContent).toContain('1.000'); // Fixkosten-Ziel der Demo
  });

  it('clicking a transaction row opens the edit form prefilled, with a delete button and edit wording', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.tx-row--clickable') as HTMLElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#add-expense-heading')?.textContent).toContain('bearbeiten');
    expect((compiled.querySelector('#add-expense-amount') as HTMLInputElement).value).not.toBe('');
    expect(compiled.querySelector('.btn-delete-link')).toBeTruthy();
  });

  it('deleting a transaction requires confirmation before it disappears', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as { transactions: () => { id: unknown }[] };
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.tx-row--clickable') as HTMLElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    const before = instance.transactions().length;

    (compiled.querySelector('.btn-delete-link') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.delete-confirm')).toBeTruthy();
    // Noch nicht gelöscht, nur die Rückfrage sichtbar.
    expect(instance.transactions().length).toBe(before);

    (compiled.querySelector('.btn-delete') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(instance.transactions().length).toBe(before - 1);
  });

  it('clicking a category legend item opens the goal form prefilled with the current goal', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.legend-item--clickable') as HTMLElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const input = compiled.querySelector('#category-goal-input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('1000'); // Fixkosten ist die höchste Ausgabe (965 € feste Abzüge), steht zuerst in der sortierten Legende
  });

  it('saving a new monthly goal updates the legend without a page reload', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.legend-item--clickable') as HTMLElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const input = compiled.querySelector('#category-goal-input') as HTMLInputElement;
    input.value = '500';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (compiled.querySelector('.add-expense-form .btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.legend-goal')?.textContent).toContain('500');
  });

  it('the per-category progress bar reflects the new goal percentage instantly', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    // Fixkosten: 965 € ausgegeben (900 Miete + 65 Versicherung als feste
    // Abzüge), Ziel startet bei 1000 € -> ~97 %.
    const barBefore = compiled.querySelector('.legend-goal-bar') as HTMLElement;
    expect(barBefore.getAttribute('aria-valuenow')).toBe('97');

    (compiled.querySelector('.legend-item--clickable') as HTMLElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector('#category-goal-input') as HTMLInputElement;
    input.value = '2000';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (compiled.querySelector('.add-expense-form .btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    // 965 / 2000 = 48 % (48,25 gerundet).
    const barAfter = compiled.querySelector('.legend-goal-bar') as HTMLElement;
    expect(barAfter.getAttribute('aria-valuenow')).toBe('48');
  });

  // ---------- Analysen-Tab (Verfügbares Einkommen) ----------

  it('switching to the Analysen tab loads and shows own income, household total, buffer and deductions', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as { selectTab: (tab: 'uebersicht' | 'analysen') => void };

    instance.selectTab('analysen');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect((compiled.querySelector('#own-income-input') as HTMLInputElement).value).toBe('1800');
    // Solo-Haushalt: EIN Einkommenswert, Haushaltssumme == eigenes Einkommen.
    // Verfügbares Einkommen: 1800 - (900 + 65 aktive Abzüge)
    // - 390 (alle Demo-Transaktionen des Monats) - 300 Puffer = 145
    expect(compiled.querySelector('#income-heading')?.textContent).toContain('145');
    // Die Formel ist in der Hero-Zeile vollständig und mit genau einem Einkommen sichtbar.
    expect(compiled.querySelector('.income-block .balance-sub')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Haushalt 1.800 € · Abzüge 965 € · Ausgaben 390 € · Puffer 300 €',
    );
    expect(compiled.querySelectorAll('.deduction-row').length).toBe(2);
  });

  it('in the solo demo the own income and the household total are the same figure, and no second person appears', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as { selectTab: (tab: 'uebersicht' | 'analysen') => void };

    instance.selectTab('analysen');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const ownIncome = (compiled.querySelector('#own-income-input') as HTMLInputElement).value;
    expect(ownIncome).toBe('1800');
    expect(compiled.querySelector('.income-block .balance-sub')?.textContent).toContain('Haushalt 1.800');
    // Die Beträge der früheren Zwei-Personen-Demo (3200 + 2400) dürfen nicht mehr auftauchen.
    expect(compiled.textContent).not.toContain('2.400');
    expect(compiled.textContent).not.toContain('5.600');
    expect(compiled.textContent).not.toContain('Jonas');
  });

  it('saving own income updates the available-income figure live', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as { selectTab: (tab: 'uebersicht' | 'analysen') => void };
    instance.selectTab('analysen');
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    const input = compiled.querySelector('#own-income-input') as HTMLInputElement;
    input.value = '4000';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (compiled.querySelector('.inline-field-form .btn-secondary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    // 4000 - 965 - 390 - 300 = 2345 (Solo-Haushalt: kein zweites Einkommen in der Summe)
    expect(compiled.querySelector('#income-heading')?.textContent).toContain('2.345');
  });

  it('adding a recurring deduction appears in the list and reduces the available income', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as { selectTab: (tab: 'uebersicht' | 'analysen') => void };
    instance.selectTab('analysen');
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.section-head__view-all') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('#deduction-name') as HTMLInputElement).value = 'Streaming';
    (compiled.querySelector('#deduction-name') as HTMLInputElement).dispatchEvent(new Event('input'));
    (compiled.querySelector('#deduction-amount') as HTMLInputElement).value = '35';
    (compiled.querySelector('#deduction-amount') as HTMLInputElement).dispatchEvent(new Event('input'));
    (compiled.querySelector('.add-expense-form .btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('.deduction-row').length).toBe(3);
    expect(compiled.textContent).toContain('Streaming');
  });

  it('deleting a recurring deduction requires confirmation, then removes it and updates the available income', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as { selectTab: (tab: 'uebersicht' | 'analysen') => void };
    instance.selectTab('analysen');
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.deduction-row') as HTMLElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.btn-delete-link') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.delete-confirm')).toBeTruthy();
    expect(compiled.querySelectorAll('.deduction-row').length).toBe(2); // noch nicht gelöscht

    (compiled.querySelector('.btn-delete') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('.deduction-row').length).toBe(1);
  });

  it('insights render with an icon and text for each hint, not color alone', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as { selectTab: (tab: 'uebersicht' | 'analysen') => void };

    instance.selectTab('analysen');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const items = compiled.querySelectorAll('.insight-item');
    expect(items.length).toBeGreaterThan(0);
    for (const item of Array.from(items)) {
      expect(item.querySelector('.insight-item__icon svg')).toBeTruthy();
      expect(item.querySelector('p')?.textContent?.length).toBeGreaterThan(0);
    }
  });

  // ---------- Synchronisation Übersicht <-> Analysen ----------

  type FinanzenInternals = {
    selectTab: (tab: 'uebersicht' | 'analysen') => void;
    addAmount: { set: (v: string) => void };
    addDescription: { set: (v: string) => void };
    addSelectedCategoryId: { set: (v: string | number) => void };
    submitAddExpense: () => void;
    openAddDeductionModal: () => void;
    deductionName: { set: (v: string) => void };
    deductionAmount: { set: (v: string) => void };
    deductionCategoryId: { set: (v: string | number | null) => void };
    submitDeduction: () => void;
    categories: () => { label: string; amount: number }[];
  };

  function heroText(fixture: { nativeElement: unknown }, id: 'balance-heading' | 'income-heading'): string {
    return ((fixture.nativeElement as HTMLElement).querySelector('#' + id)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function addExpense(instance: FinanzenInternals, amount: string, categoryId: string): void {
    instance.addAmount.set(amount);
    instance.addDescription.set('Sync-Test');
    instance.addSelectedCategoryId.set(categoryId);
    instance.submitAddExpense();
  }

  it('an expense added in Übersicht is already reflected in "Verfügbares Einkommen" when switching to Analysen, without a reload', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as FinanzenInternals;

    addExpense(instance, '100', 'demo-haushalt');
    fixture.detectChanges();
    instance.selectTab('analysen');
    fixture.detectChanges();

    // 145 (Ausgangsstand, siehe Test oben) - 100 = 45
    expect(heroText(fixture, 'income-heading')).toBe('45 €');
  });

  it('the sync also holds when Analysen was already visited before the expense was added (no stale first-visit snapshot)', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as FinanzenInternals;

    instance.selectTab('analysen');
    fixture.detectChanges();
    expect(heroText(fixture, 'income-heading')).toBe('145 €');

    instance.selectTab('uebersicht');
    fixture.detectChanges();
    addExpense(instance, '45', 'demo-sonstiges');
    fixture.detectChanges();
    instance.selectTab('analysen');
    fixture.detectChanges();

    expect(heroText(fixture, 'income-heading')).toBe('100 €'); // 145 - 45
  });

  it('a recurring deduction added in Analysen changes the Übersicht category amount and budget figure', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as FinanzenInternals;
    const sonstigesBefore = instance.categories().find((c) => c.label === 'Sonstiges')?.amount;
    expect(heroText(fixture, 'balance-heading')).toContain('1.355'); // 390 Transaktionen + 965 Abzüge

    instance.selectTab('analysen');
    fixture.detectChanges();
    instance.openAddDeductionModal();
    instance.deductionName.set('Streaming');
    instance.deductionAmount.set('35');
    instance.deductionCategoryId.set('demo-sonstiges');
    instance.submitDeduction();
    fixture.detectChanges();
    instance.selectTab('uebersicht');
    fixture.detectChanges();

    expect(instance.categories().find((c) => c.label === 'Sonstiges')?.amount).toBe((sonstigesBefore ?? 0) + 35);
    expect(heroText(fixture, 'balance-heading')).toContain('1.390');
  });

  it('a fixed deduction is never counted twice: budget figure = income - available income - buffer', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as FinanzenInternals;

    // 1800 Einkommen - 145 verfügbar - 300 Puffer = 1355 = Budget-Kopf (siehe oben)
    expect(heroText(fixture, 'balance-heading')).toContain('1.355');
    instance.selectTab('analysen');
    fixture.detectChanges();
    expect(heroText(fixture, 'income-heading')).toBe('145 €');
  });

  it('both hero numbers use the same shared class, so they render with the identical gradient', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as FinanzenInternals;
    const compiled = fixture.nativeElement as HTMLElement;

    const budgetHero = compiled.querySelector('#balance-heading');
    instance.selectTab('analysen');
    fixture.detectChanges();
    const incomeHero = compiled.querySelector('#income-heading');

    // Der Text-Verlauf linear-gradient(100deg, #5b3fd6, #a15f14) hängt an
    // .balance-amount (finanzen.css) — es gibt bewusst keine abweichende
    // Regel für die Analysen-Zahl mehr.
    expect(budgetHero?.classList.contains('balance-amount')).toBe(true);
    expect(incomeHero?.classList.contains('balance-amount')).toBe(true);
  });

  // ---------- "Kategorie hinzufügen" ----------

  it('the "+" button opens a sheet with name field, icon tiles and color swatches', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.btn-add-category') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#new-category-name')).toBeTruthy();
    expect(compiled.querySelectorAll('.icon-tile').length).toBeGreaterThanOrEqual(8);
    expect(compiled.querySelectorAll('.color-swatch').length).toBeGreaterThanOrEqual(6);
  });

  it('creating a category requires a name, an icon and a color', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.btn-add-category') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.add-expense-form .btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.field-error')?.textContent).toContain('Namen');
  });

  it('creating a new category adds it to the legend AND makes it available as a chip in "Ausgabe hinzufügen", without a reload', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.btn-add-category') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const nameInput = compiled.querySelector('#new-category-name') as HTMLInputElement;
    nameInput.value = 'Freizeit';
    nameInput.dispatchEvent(new Event('input'));
    (compiled.querySelector('.icon-tile') as HTMLButtonElement).click();
    (compiled.querySelector('.color-swatch') as HTMLButtonElement).click();
    fixture.detectChanges();
    (compiled.querySelector('.add-expense-form .btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    // Sofort in der Kategorien-Legende (Donut-Sektion) sichtbar.
    expect(compiled.querySelector('.legend')?.textContent).toContain('Freizeit');

    // Sofort auch als Chip im "Ausgabe hinzufügen"-Sheet, ohne Neuladen.
    (compiled.querySelector('.btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    const chips = Array.from(compiled.querySelectorAll('.category-chip')).map((el) => el.textContent?.trim());
    expect(chips.some((label) => label?.includes('Freizeit'))).toBe(true);
  });

  it('rejects a duplicate category name against an existing default category', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.btn-add-category') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const nameInput = compiled.querySelector('#new-category-name') as HTMLInputElement;
    nameInput.value = 'Fixkosten'; // bereits eine der drei Demo-Standardkategorien
    nameInput.dispatchEvent(new Event('input'));
    (compiled.querySelector('.icon-tile') as HTMLButtonElement).click();
    (compiled.querySelector('.color-swatch') as HTMLButtonElement).click();
    fixture.detectChanges();
    (compiled.querySelector('.add-expense-form .btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.field-error')).toBeTruthy();
  });
});

// ---------- Fehlerzustand beim Laden (SCHRITT 5B) ----------
// Eigener describe-Block mit einem fehlschlagenden Fake-Provider (statt
// DemoFinanzenDataProvider, das per of() nie fehlschlägt) — simuliert einen
// Netzwerk-/Serverfehler von RealFinanzenDataProvider, ohne einen echten
// HttpClient/Backend zu brauchen.
describe('Finanzen — Fehlerzustand beim Laden der Übersicht', () => {
  class FailingFinanzenDataProvider implements FinanzenDataProvider {
    getOverviewCallCount = 0;

    getOverview(): Observable<OverviewDto> {
      this.getOverviewCallCount++;
      return throwError(() => new Error('Netzwerkfehler'));
    }
    searchTransactions(): Observable<TransactionPage> {
      return of({ next: null, previous: null, results: [] });
    }
    addTransaction(): Observable<TransactionDto> {
      return throwError(() => new Error('nicht relevant für diesen Test'));
    }
    updateTransaction(): Observable<TransactionDto> {
      return throwError(() => new Error('nicht relevant für diesen Test'));
    }
    deleteTransaction(): Observable<void> {
      return throwError(() => new Error('nicht relevant für diesen Test'));
    }
    getCategories(): Observable<CategoryDto[]> {
      return of([]);
    }
    updateCategoryGoal(): Observable<CategoryDto> {
      return throwError(() => new Error('nicht relevant für diesen Test'));
    }
    createCategory(): Observable<CategoryDto> {
      return throwError(() => new Error('nicht relevant für diesen Test'));
    }
    getAnalysen(): Observable<AnalysenDto> {
      return throwError(() => new Error('nicht relevant für diesen Test'));
    }
    updateOwnIncome(): Observable<{ monthly_income: string | null }> {
      return throwError(() => new Error('nicht relevant für diesen Test'));
    }
    updateHouseholdBuffer(): Observable<{ monthly_buffer: string }> {
      return throwError(() => new Error('nicht relevant für diesen Test'));
    }
    addRecurringDeduction(): Observable<RecurringDeductionDto> {
      return throwError(() => new Error('nicht relevant für diesen Test'));
    }
    updateRecurringDeduction(): Observable<RecurringDeductionDto> {
      return throwError(() => new Error('nicht relevant für diesen Test'));
    }
    deleteRecurringDeduction(): Observable<void> {
      return throwError(() => new Error('nicht relevant für diesen Test'));
    }
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Finanzen],
      providers: [
        { provide: FINANZEN_DATA_PROVIDER, useClass: FailingFinanzenDataProvider },
        FinanzenStateService,
      ],
    }).compileComponents();
  });

  it('shows a clear error state with a retry button instead of a silently empty/zero account', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const errorBlock = compiled.querySelector('.load-error');
    expect(errorBlock).toBeTruthy();
    expect(errorBlock?.querySelector('button')?.textContent).toContain('Erneut versuchen');

    // Der normale Seiteninhalt (Budget-Betrag, Haushalts-Streifen) darf
    // NICHT parallel sichtbar sein — sonst könnte ein Fehler mit einem
    // echten, aber leeren Account verwechselt werden.
    expect(compiled.querySelector('.balance-amount')).toBeFalsy();
    expect(compiled.querySelector('.household-strip')).toBeFalsy();
  });

  it('clicking retry calls getOverview again', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const provider = TestBed.inject(FINANZEN_DATA_PROVIDER) as FailingFinanzenDataProvider;
    const callsBeforeRetry = provider.getOverviewCallCount;
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.load-error button') as HTMLButtonElement).click();

    expect(provider.getOverviewCallCount).toBe(callsBeforeRetry + 1);
  });
});
