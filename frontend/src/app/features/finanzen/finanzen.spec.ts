import { TestBed } from '@angular/core/testing';
import { DemoFinanzenDataProvider } from './demo-finanzen-data-provider';
import { FINANZEN_DATA_PROVIDER } from './finanzen-data-provider';
import { Finanzen } from './finanzen';

describe('Finanzen', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Finanzen],
      // DemoFinanzenDataProvider statt HttpClient: liefert synchron (of())
      // feste Beispieldaten, macht KEINE HTTP-Aufrufe — dieselbe
      // Implementierung, die auch die öffentliche Demo-Route nutzt (siehe
      // app.routes.ts).
      providers: [{ provide: FINANZEN_DATA_PROVIDER, useClass: DemoFinanzenDataProvider }],
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

  it('only marks "Übersicht" as selected initially; Transaktionen/Budgets stay disabled placeholders, Analysen is a real tab', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const tabs = compiled.querySelectorAll('.subtab');
    expect(tabs.length).toBe(4);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true'); // Übersicht
    expect(tabs[1].hasAttribute('disabled')).toBe(true); // Transaktionen
    expect(tabs[2].hasAttribute('disabled')).toBe(true); // Budgets
    expect(tabs[3].hasAttribute('disabled')).toBe(false); // Analysen
    expect(tabs[3].getAttribute('aria-selected')).toBe('false');
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

  it('renders the household strip with the demo household name and member avatars', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.household-strip__name')?.textContent).toContain('Haushalt Zuhause');
    expect(compiled.querySelectorAll('.household-strip__avatar').length).toBe(2);
  });

  it('shows Faire Aufteilung for the demo household (2 members) since the field is present', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#fairness-heading')).toBeTruthy();
    expect(compiled.querySelectorAll('.person').length).toBe(2);
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

    expect(compiled.querySelector('.legend-goal')?.textContent).toContain('900');
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
    expect(input.value).toBe('900'); // Fixkosten ist die höchste Ausgabe, steht zuerst in der sortierten Legende
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

    // Fixkosten: 850 € ausgegeben, Ziel startet bei 900 € -> ~94 %.
    const barBefore = compiled.querySelector('.legend-goal-bar') as HTMLElement;
    expect(barBefore.getAttribute('aria-valuenow')).toBe('94');

    (compiled.querySelector('.legend-item--clickable') as HTMLElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector('#category-goal-input') as HTMLInputElement;
    input.value = '1000';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (compiled.querySelector('.add-expense-form .btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    // 850 / 1000 = 85 %.
    const barAfter = compiled.querySelector('.legend-goal-bar') as HTMLElement;
    expect(barAfter.getAttribute('aria-valuenow')).toBe('85');
  });

  // ---------- Analysen-Tab (Verfügbares Einkommen) ----------

  it('switching to the Analysen tab loads and shows own income, household total, buffer and deductions', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as { selectTab: (tab: 'uebersicht' | 'analysen') => void };

    instance.selectTab('analysen');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect((compiled.querySelector('#own-income-input') as HTMLInputElement).value).toBe('3200');
    // Verfügbares Einkommen: (3200 + 2400 Demo-Haushaltssumme) - (900 + 65 aktive Abzüge) - 300 Puffer = 4335
    expect(compiled.querySelector('#income-heading')?.textContent).toContain('4.335');
    expect(compiled.querySelectorAll('.deduction-row').length).toBe(2);
  });

  it('the Analysen tab never renders another members individual income anywhere, only the household total', () => {
    const fixture = TestBed.createComponent(Finanzen);
    fixture.detectChanges();
    const instance = fixture.componentInstance as unknown as { selectTab: (tab: 'uebersicht' | 'analysen') => void };

    instance.selectTab('analysen');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    // 2400 ist der Demo-Anteil des ANDEREN Mitglieds (siehe
    // demo-finanzen-data-provider.ts DEMO_OTHER_MEMBERS_INCOME_TOTAL) — darf
    // an keiner Stelle als Einzelbetrag im DOM auftauchen, nur als Teil der
    // bereits summierten Kennzahlen.
    expect(compiled.textContent).not.toContain('2.400');
    expect(compiled.textContent).not.toContain('2400');
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

    // (4000 + 2400) - 965 - 300 = 5135
    expect(compiled.querySelector('#income-heading')?.textContent).toContain('5.135');
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
});
