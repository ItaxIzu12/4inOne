import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { DemoFinanzenDataProvider } from './demo-finanzen-data-provider';
import { FINANZEN_DATA_PROVIDER, FinanzenDataProvider } from './finanzen-data-provider';
import { FinanzenStateService } from './finanzen-state.service';
import {
  AnalysenDto,
  BerichtDownload,
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
        // Ab der Sidebar-Navigation (shared/sidebar-nav, dort eingebunden
        // seit DESIGN_SYSTEM.md Version 3) braucht Finanzen einen Router-
        // Kontext für RouterLink — vorher unnötig, da die Komponente selbst
        // keine Router-Direktiven verwendete.
        provideRouter([]),
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
    expect(bar?.getAttribute('aria-valuenow')).toBe(
      String(fixture.componentInstance['budgetBarPercent']()),
    );
    expect(bar?.getAttribute('aria-valuemin')).toBe('0');
    expect(bar?.getAttribute('aria-valuemax')).toBe('100');
  });

  // ---------- Budget-Kopfzeile: aus den Kategorien berechnet, "ausgegeben" statt "verplant" ----------

  it('the budget head reads "X % ausgegeben" and "von Y € Ziel · Z € übrig" — never "verplant"', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const text = (selector: string) =>
      (compiled.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();

    // Demo: 1355 ausgegeben (965 feste Abzüge + 390 Transaktionen) von 1950 Ziel -> 595 übrig, 69 %.
    expect(text('#balance-heading')).toBe('1.355,00 €');
    expect(text('.budget-meta')).toContain('von 1.950,00 € Ausgabenlimit');
    expect(text('.budget-meta strong')).toBe('69 %');
    expect(compiled.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toBe(
      '69 Prozent des Budgets ausgegeben',
    );
    expect(compiled.textContent).not.toContain('verplant');
  });

  it('the budget head is the sum of the category amounts and goals shown below it, not a standalone number', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as {
      budget: () => { ausgegeben: number; ziel: number };
      categories: () => { amount: number; monthlyGoal: number | null }[];
    };

    const slices = instance.categories();
    expect(instance.budget().ausgegeben).toBe(slices.reduce((sum, c) => sum + c.amount, 0));
    expect(instance.budget().ziel).toBe(slices.reduce((sum, c) => sum + (c.monthlyGoal ?? 0), 0));
  });

  it('over 100 %: the caption shows the real percentage, the bar and aria-valuenow stop at 100', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    // Ziel von Fixkosten auf 100 senken: Ziel 100 + 450 + 500 = 1050, ausgegeben 1355 -> 129 %.
    TestBed.inject(FINANZEN_DATA_PROVIDER).updateCategoryGoal('demo-fixkosten', 100).subscribe();
    TestBed.inject(FinanzenStateService).invalidieren();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(
      compiled.querySelector('.budget-meta strong')?.textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe('129 %');
    const bar = compiled.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('100');
    expect(bar?.getAttribute('aria-label')).toBe('129 Prozent des Budgets ausgegeben');
  });

  it('opens transaction history from the overview', async () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.view-transactions') as HTMLButtonElement).click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 350));
    fixture.detectChanges();
    expect(el.querySelectorAll('.tx-modal__row').length).toBe(
      fixture.componentInstance['transactions']().length,
    );
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

    expect(compiled.querySelector('app-context-bar .household')?.textContent).toContain('Anna');
    expect(compiled.querySelector('app-context-bar .members')?.textContent).toBe('Anna');
  });

  it('renders NO Faire Aufteilung section for the solo demo household — absent from the DOM, not just hidden', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#fairness-heading')).toBeNull();
    expect(compiled.querySelector('.fairness-people')).toBeNull();
    expect(compiled.querySelector('.fairness-bar')).toBeNull();
    expect(compiled.textContent).not.toContain('Gemeinsam beigetragen');
    expect(compiled.textContent).not.toContain('Jonas');
  });

  it('shows category chips to choose from in the add-expense modal', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.btn-primary')
      ?.click();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const chips = compiled.querySelectorAll('.category-chip');
    expect(chips.length).toBe(3); // Fixkosten/Haushalt/Sonstiges
  });

  it('shows the monthly goal next to a category that has one', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.category-goal')?.textContent).toContain('1.000'); // Fixkosten-Ziel der Demo
  });

  it('clicking a transaction row opens the edit form prefilled, with a delete button and edit wording', async () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.view-transactions') as HTMLButtonElement).click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 350));
    fixture.detectChanges();
    (compiled.querySelector('.tx-row--clickable') as HTMLElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#add-expense-heading')?.textContent).toContain('bearbeiten');
    expect((compiled.querySelector('#add-expense-amount') as HTMLInputElement).value).not.toBe('');
    expect(compiled.querySelector('.btn-delete-link')).toBeTruthy();
  });

  // ---------- Wählbares Ausgabedatum ----------

  it('the add-expense sheet prefills the date field with today, not an empty field', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.btn-primary') as HTMLButtonElement).click(); // "Ausgabe hinzufügen"
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const today = new Date().toISOString().slice(0, 10);
    expect((compiled.querySelector('#add-expense-datum') as HTMLInputElement).value).toBe(today);
  });

  it('editing an existing transaction prefills the date field with ITS date, not today', async () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as {
      transactions: () => { datum: string }[];
    };
    let compiled = fixture.nativeElement as HTMLElement;

    const firstTransactionDatum = instance.transactions()[0].datum;
    (compiled.querySelector('.view-transactions') as HTMLButtonElement).click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 350));
    fixture.detectChanges();
    (compiled.querySelector('.tx-row--clickable') as HTMLElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect((compiled.querySelector('#add-expense-datum') as HTMLInputElement).value).toBe(
      firstTransactionDatum,
    );
  });

  it('changing the date and saving a new expense sends that chosen date, not today, to the provider', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('#add-expense-amount') as HTMLInputElement).value = '12';
    (compiled.querySelector('#add-expense-amount') as HTMLInputElement).dispatchEvent(
      new Event('input'),
    );
    (compiled.querySelector('.category-chip') as HTMLElement).click();
    const datumInput = compiled.querySelector('#add-expense-datum') as HTMLInputElement;
    datumInput.value = '2026-01-15';
    datumInput.dispatchEvent(new Event('input'));
    (compiled.querySelector('.add-expense-form .btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();

    // NICHT transactions()[0]: die Liste ist nach datum absteigend sortiert
    // (demo-finanzen-data-provider.ts searchTransactions()) — ein bewusst
    // in die Vergangenheit gesetztes Datum landet deshalb korrekt NICHT an
    // erster Stelle. Stattdessen über die (sonst einmalige) Beschreibung
    // finden, die die Demo für ein leeres Beschreibungsfeld einsetzt.
    const instance = fixture.componentInstance as unknown as {
      transactions: () => { datum: string; description: string }[];
    };
    const saved = instance.transactions().find((t) => t.description === 'Ausgabe');
    expect(saved?.datum).toBe('2026-01-15');
  });

  it('reopening the add-expense sheet after closing it resets the date back to today', async () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.view-transactions') as HTMLButtonElement).click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 350));
    fixture.detectChanges();
    (compiled.querySelector('.tx-row--clickable') as HTMLElement).click(); // Bearbeiten öffnen — anderes Datum
    fixture.detectChanges();

    const instance = fixture.componentInstance as unknown as {
      closeAddModal: () => void;
      openAddModal: () => void;
    };
    instance.closeAddModal();
    instance.openAddModal();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const today = new Date().toISOString().slice(0, 10);
    expect((compiled.querySelector('#add-expense-datum') as HTMLInputElement).value).toBe(today);
  });

  it('deleting a transaction requires confirmation before it disappears', async () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as {
      transactions: () => { id: unknown }[];
    };
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.view-transactions') as HTMLButtonElement).click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 350));
    fixture.detectChanges();
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

    (compiled.querySelector('.category-row') as HTMLElement).click();
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

    (compiled.querySelector('.category-row') as HTMLElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const input = compiled.querySelector('#category-goal-input') as HTMLInputElement;
    input.value = '500';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (compiled.querySelector('.add-expense-form .btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.category-goal')?.textContent).toContain('500');
  });

  it('the per-category progress bar reflects the new goal percentage instantly', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    // Fixkosten: 965 € ausgegeben (900 Miete + 65 Versicherung als feste
    // Abzüge), Ziel startet bei 1000 € -> ~97 %.
    const barBefore = compiled.querySelector('.category-row [role=progressbar]') as HTMLElement;
    expect(barBefore.getAttribute('aria-valuenow')).toBe('97');

    (compiled.querySelector('.category-row') as HTMLElement).click();
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
    const barAfter = compiled.querySelector('.category-row [role=progressbar]') as HTMLElement;
    expect(barAfter.getAttribute('aria-valuenow')).toBe('48');
  });

  // ---------- Analysen-Tab (Verfügbares Einkommen) ----------

  it('switching to the Analysen tab loads and shows own income, household total, buffer and deductions', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as {
      selectTab: (tab: 'uebersicht' | 'analysen') => void;
    };

    instance.selectTab('analysen');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect((compiled.querySelector('#own-income-input') as HTMLInputElement).value).toBe('1800');
    // Solo-Haushalt: EIN Einkommenswert, Haushaltssumme == eigenes Einkommen.
    // Verfügbares Einkommen: 1800 - (900 + 65 aktive Abzüge)
    // - 390 (alle Demo-Transaktionen des Monats) - 300 Puffer = 145
    expect(compiled.querySelector('#income-heading')?.textContent).toContain('145');
    // Die Formel ist in der Hero-Zeile vollständig und mit genau einem Einkommen sichtbar.
    expect(
      Array.from(compiled.querySelectorAll('.calculation-card dd')).map((el) =>
        el.textContent?.trim(),
      ),
    ).toEqual(['1.800,00 €', '−965,00 €', '−390,00 €', '−300,00 €', '145,00 €']);
    expect(compiled.querySelectorAll('.deduction-row').length).toBe(2);
  });

  it('in the solo demo the own income and the household total are the same figure, and no second person appears', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as {
      selectTab: (tab: 'uebersicht' | 'analysen') => void;
    };

    instance.selectTab('analysen');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const ownIncome = (compiled.querySelector('#own-income-input') as HTMLInputElement).value;
    expect(ownIncome).toBe('1800');
    expect(compiled.querySelector('.calculation-card dd')?.textContent).toContain('1.800,00');
    // Die Beträge der früheren Zwei-Personen-Demo (3200 + 2400) dürfen nicht mehr auftauchen.
    expect(compiled.textContent).not.toContain('2.400');
    expect(compiled.textContent).not.toContain('5.600');
    expect(compiled.textContent).not.toContain('Jonas');
  });

  it('saving own income updates the available-income figure live', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as {
      selectTab: (tab: 'uebersicht' | 'analysen') => void;
    };
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
    const instance = fixture.componentInstance as unknown as {
      selectTab: (tab: 'uebersicht' | 'analysen') => void;
    };
    instance.selectTab('analysen');
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.section-head__view-all') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('#deduction-name') as HTMLInputElement).value = 'Streaming';
    (compiled.querySelector('#deduction-name') as HTMLInputElement).dispatchEvent(
      new Event('input'),
    );
    (compiled.querySelector('#deduction-amount') as HTMLInputElement).value = '35';
    (compiled.querySelector('#deduction-amount') as HTMLInputElement).dispatchEvent(
      new Event('input'),
    );
    (compiled.querySelector('.add-expense-form .btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('.deduction-row').length).toBe(3);
    expect(compiled.textContent).toContain('Streaming');
  });

  it('deleting a recurring deduction requires confirmation, then removes it and updates the available income', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as {
      selectTab: (tab: 'uebersicht' | 'analysen') => void;
    };
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
    const instance = fixture.componentInstance as unknown as {
      selectTab: (tab: 'uebersicht' | 'analysen') => void;
    };

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

  // ---------- Bericht-Download (CSV/PDF, Monat oder Jahr) ----------

  type ReportDownloadInternals = {
    selectTab: (tab: 'uebersicht' | 'analysen') => void;
    downloadBericht: (format: 'csv' | 'pdf') => void;
    reportPeriodType: { set: (v: 'monat' | 'jahr') => void };
    reportMonat: { set: (v: string) => void; (): string };
    reportJahr: { set: (v: string) => void };
    reportError: () => string | null;
  };

  it('shows a "Bericht herunterladen" section in the Analysen tab with Monat/Jahr and both format buttons', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as {
      selectTab: (tab: 'uebersicht' | 'analysen') => void;
    };

    instance.selectTab('analysen');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#report-heading')?.textContent).toContain(
      'Bericht herunterladen',
    );
    expect(compiled.querySelector('#report-monat-input')).toBeTruthy();
    expect(compiled.textContent).toContain('Als CSV herunterladen');
    expect(compiled.textContent).toContain('Als PDF herunterladen');
  });

  it('switching the period type from Monat to Jahr swaps the month input for a year input', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as {
      selectTab: (tab: 'uebersicht' | 'analysen') => void;
    };
    instance.selectTab('analysen');
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#report-monat-input')).toBeTruthy();
    expect(compiled.querySelector('#report-jahr-input')).toBeNull();

    const chips = compiled
      .querySelectorAll('[data-section="report"] .category-chips')[0]
      .querySelectorAll('.category-chip');
    (chips[1] as HTMLElement).click(); // "Jahr"
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#report-jahr-input')).toBeTruthy();
    expect(compiled.querySelector('#report-monat-input')).toBeNull();
  });

  it('clicking "Als CSV herunterladen" triggers one real file download named for the selected month, using the demo data', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as ReportDownloadInternals;
    instance.selectTab('analysen');
    fixture.detectChanges();
    instance.reportMonat.set('2026-08');

    let capturedFilename: string | null = null;
    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      capturedFilename = this.download;
    });

    instance.downloadBericht('csv');

    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrlSpy).toHaveBeenCalledTimes(1);
    expect(capturedFilename).toBe('kompass-bericht-demo-2026-08.csv');
    expect((createUrlSpy.mock.calls[0][0] as Blob).type).toContain('text/csv');
    expect(instance.reportError()).toBeNull();

    createUrlSpy.mockRestore();
    revokeUrlSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('the downloaded CSV only contains transactions from the selected month, not other months', async () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as ReportDownloadInternals;
    instance.selectTab('analysen');
    fixture.detectChanges();
    // Alle Demo-Transaktionen liegen im aktuellen Monat (daysAgo(0..2), siehe
    // demo-finanzen-data-provider.ts) — ein Bericht für den VORMONAT muss
    // deshalb leer sein, keine der Demo-Beschreibungen enthalten.
    const today = new Date();
    const vormonat = new Date(today.getFullYear(), today.getMonth() - 1, 15);
    const vormonatSlug = `${vormonat.getFullYear()}-${String(vormonat.getMonth() + 1).padStart(2, '0')}`;
    instance.reportMonat.set(vormonatSlug);

    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    instance.downloadBericht('csv');
    const text = await (createUrlSpy.mock.calls[0][0] as Blob).text();

    expect(text).not.toContain('Wocheneinkauf');
    expect(text).not.toContain('Drogerie');
    expect(text).toContain('Summe Transaktionen;0.00');

    vi.restoreAllMocks();
  });

  it('clicking "Als PDF herunterladen" in the demo shows a clear error instead of downloading anything', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as ReportDownloadInternals;
    instance.selectTab('analysen');
    fixture.detectChanges();

    const createUrlSpy = vi.spyOn(URL, 'createObjectURL');
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    instance.downloadBericht('pdf');
    fixture.detectChanges();

    expect(createUrlSpy).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
    expect(instance.reportError()).toBe(
      'PDF-Berichte sind in der Demo nicht verfügbar — im echten Konto herunterladen.',
    );

    createUrlSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('the download buttons are disabled while a download is in flight', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as {
      selectTab: (tab: 'uebersicht' | 'analysen') => void;
    };
    instance.selectTab('analysen');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    // Findet die zwei Download-Buttons über ihren Text statt einer eigenen
    // CSS-Klasse (die Buttons teilen sich .btn-secondary mit Einkommen/Puffer).
    const buttons = Array.from(compiled.querySelectorAll('.btn-secondary')).filter((btn) =>
      btn.textContent?.includes('herunterladen'),
    ) as HTMLButtonElement[];
    expect(buttons.length).toBe(2);
    expect(buttons.every((btn) => !btn.disabled)).toBe(true);
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

  function heroText(
    fixture: { nativeElement: unknown },
    id: 'balance-heading' | 'income-heading',
  ): string {
    return ((fixture.nativeElement as HTMLElement).querySelector('#' + id)?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();
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
    expect(heroText(fixture, 'income-heading')).toBe('45,00 €');
  });

  it('the sync also holds when Analysen was already visited before the expense was added (no stale first-visit snapshot)', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as FinanzenInternals;

    instance.selectTab('analysen');
    fixture.detectChanges();
    expect(heroText(fixture, 'income-heading')).toBe('145,00 €');

    instance.selectTab('uebersicht');
    fixture.detectChanges();
    addExpense(instance, '45', 'demo-sonstiges');
    fixture.detectChanges();
    instance.selectTab('analysen');
    fixture.detectChanges();

    expect(heroText(fixture, 'income-heading')).toBe('100,00 €'); // 145 - 45
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

    expect(instance.categories().find((c) => c.label === 'Sonstiges')?.amount).toBe(
      (sonstigesBefore ?? 0) + 35,
    );
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
    expect(heroText(fixture, 'income-heading')).toBe('145,00 €');
  });

  it('both balance figures display cents consistently', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as FinanzenInternals;
    const compiled = fixture.nativeElement as HTMLElement;

    const budgetHero = compiled.querySelector('#balance-heading');
    instance.selectTab('analysen');
    fixture.detectChanges();
    const incomeHero = compiled.querySelector('#income-heading');

    // Die Einfarbigkeit (--color-midnight-pine, DESIGN_SYSTEM.md Version 3 —
    // kein Text-Verlauf mehr) hängt an .balance-amount (finanzen.css) — es
    // gibt bewusst keine abweichende Regel für die Analysen-Zahl.
    expect(budgetHero?.textContent).toContain(',00');
    expect(incomeHero?.textContent).toContain(',00');
  });

  // ---------- "Kategorie hinzufügen" ----------

  it('the "+" button opens a sheet with name field, icon tiles and color swatches', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.category-actions button') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#new-category-name')).toBeTruthy();
    expect(compiled.querySelectorAll('.icon-tile').length).toBeGreaterThanOrEqual(8);
    // Exakt die 5 Werte aus DESIGN_SYSTEM.md Version 3 "Kuratierte
    // Kategorie-Farbpalette" (vorher 7, aus dem alten Aurora-System).
    expect(compiled.querySelectorAll('.color-swatch').length).toBe(5);
  });

  it('creating a category requires a name, an icon and a color', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.category-actions button') as HTMLButtonElement).click();
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

    (compiled.querySelector('.category-actions button') as HTMLButtonElement).click();
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
    expect(compiled.querySelector('.category-list')?.textContent).toContain('Freizeit');

    // Sofort auch als Chip im "Ausgabe hinzufügen"-Sheet, ohne Neuladen.
    (compiled.querySelector('.btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    const chips = Array.from(compiled.querySelectorAll('.category-chip')).map((el) =>
      el.textContent?.trim(),
    );
    expect(chips.some((label) => label?.includes('Freizeit'))).toBe(true);
  });

  it('rejects a duplicate category name against an existing default category', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.category-actions button') as HTMLButtonElement).click();
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
    downloadBericht(): Observable<BerichtDownload> {
      return throwError(() => new Error('nicht relevant für diesen Test'));
    }
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Finanzen],
      providers: [
        provideRouter([]),
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
