import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DemoFinanzenDataProvider } from '../finanzen/demo-finanzen-data-provider';
import { FINANZEN_DATA_PROVIDER } from '../finanzen/finanzen-data-provider';
import { RealFinanzenDataProvider } from '../finanzen/real-finanzen-data-provider';
import { FinanzenStateService } from '../finanzen/finanzen-state.service';
import { DemoHaushaltDataProvider } from './demo-haushalt-data-provider';
import { EinkaufTab } from './einkauf-tab';
import { Haushalt } from './haushalt';
import { HAUSHALT_DATA_PROVIDER } from './haushalt-data-provider';

describe('Haushalt (Demo)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Haushalt],
      // Dieselbe Kombination wie die öffentliche Demo-Route (app.routes.ts):
      // beide Provider rein im Speicher, keine HTTP-Aufrufe.
      providers: [
        provideRouter([]),
        { provide: FINANZEN_DATA_PROVIDER, useClass: DemoFinanzenDataProvider },
        { provide: HAUSHALT_DATA_PROVIDER, useClass: DemoHaushaltDataProvider },
        FinanzenStateService,
      ],
    }).compileComponents();
  });

  function text(element: Element | null): string {
    return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  it('shows the shopping list grouped by shop section with accessible check buttons', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const headings = Array.from(compiled.querySelectorAll('app-einkauf-tab h3')).map(text);
    expect(headings.slice(0, 3)).toEqual(['Obst & Gemüse', 'Brot & Backwaren', 'Kühlregal']);
    expect(compiled.querySelector('button[aria-label="Bananen abhaken"]')).not.toBeNull();
    expect(compiled.querySelector('[role="tab"][aria-selected="true"]')?.id).toBe('hh-tab-einkauf');
  });

  it('checking items shows the checkout bar, completing books an expense in the demo finances', async () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const finanzen = TestBed.inject(FINANZEN_DATA_PROVIDER);
    const before = await firstValueFrom(finanzen.getOverview());
    const haushaltBefore = Number(before.categories.find((c) => c.name === 'Haushalt')!.amount);

    (compiled.querySelector('button[aria-label="Bananen abhaken"]') as HTMLButtonElement).click();
    (compiled.querySelector('button[aria-label="Milch, 2 l abhaken"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(text(compiled.querySelector('.checkout-bar__count'))).toBe('2 im Wagen');

    const tab = fixture.debugElement.query((el) => el.componentInstance instanceof EinkaufTab)
      .componentInstance as EinkaufTab;
    tab['openComplete']();
    fixture.detectChanges();
    // 2 Artikel × 3,50 € Startwert
    expect(tab['completeAmount']()).toBe(7);
    tab['nudge'](0.5);
    tab['complete'](true);
    fixture.detectChanges();

    const after = await firstValueFrom(finanzen.getOverview());
    const haushaltAfter = Number(after.categories.find((c) => c.name === 'Haushalt')!.amount);
    expect(haushaltAfter - haushaltBefore).toBeCloseTo(7.5);
    expect(compiled.querySelector('button[aria-label="Bananen abhaken"]')).toBeNull();
    expect(text(compiled.querySelector('app-save-feedback'))).toContain('7,50');
  });

  it('switches to the task tab and shows the load per member', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('#hh-tab-aufgaben') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(text(compiled.querySelector('#tasks-heading'))).toBe('Anstehende Aufgaben');
    expect(text(compiled.querySelector('.load-list'))).toContain('Anna');
    expect(text(compiled.querySelector('.group--overdue'))).toContain('Pflanzen gießen');
  });

  it('completing a recurring task moves it forward instead of removing it', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('#hh-tab-aufgaben') as HTMLButtonElement).click();
    fixture.detectChanges();

    (compiled.querySelector('button[aria-label="Pflanzen gießen als erledigt markieren"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.group--overdue')).toBeNull();
    expect(text(compiled)).toContain('Pflanzen gießen');
    expect(text(compiled.querySelector('.load-list'))).toContain('6 Punkte');
  });

  it('lists upcoming folder deadlines including the contract cost from finance', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('#hh-tab-ordner') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(text(compiled.querySelector('#contracts-heading')?.parentElement ?? null)).toContain('65,00 €');
    const deadlines = Array.from(compiled.querySelectorAll('.deadline__title')).map(text);
    expect(deadlines).toEqual(['Heizung', 'Hausratversicherung']);
  });
});

describe('DemoHaushaltDataProvider', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        { provide: FINANZEN_DATA_PROVIDER, useClass: DemoFinanzenDataProvider },
        DemoHaushaltDataProvider,
      ],
    });
    return { haushalt: TestBed.inject(DemoHaushaltDataProvider), finanzen: TestBed.inject(FINANZEN_DATA_PROVIDER) };
  }

  async function bookTrip(haushalt: DemoHaushaltDataProvider, amount: number) {
    const shopping = await firstValueFrom(haushalt.getShopping());
    const open = shopping.items.filter((i) => !i.is_checked).slice(0, 2);
    for (const item of open) await firstValueFrom(haushalt.updateItem(item.id, { is_checked: true }));
    return firstValueFrom(haushalt.completeShopping(amount));
  }

  it('the price estimate follows corrections and deletions made in finance', async () => {
    const { haushalt, finanzen } = setup();
    const trip = await bookTrip(haushalt, 20);
    expect((await firstValueFrom(haushalt.getShopping())).price_per_item).toBe('10.00');

    await firstValueFrom(
      finanzen.updateTransaction(trip.transaction_id!, {
        amount: 8,
        description: 'Einkauf (2 Artikel)',
        categoryId: 'demo-haushalt',
        datum: new Date().toISOString().slice(0, 10),
      }),
    );
    expect((await firstValueFrom(haushalt.getShopping())).price_per_item).toBe('4.00');

    await firstValueFrom(finanzen.deleteTransaction(trip.transaction_id!));
    const afterDelete = await firstValueFrom(haushalt.getShopping());
    expect(afterDelete.price_from_history).toBe(false);
  });

  it('contract costs come from the finance deduction and vanish while it is paused', async () => {
    const { haushalt, finanzen } = setup();
    const insurance = () =>
      firstValueFrom(haushalt.getFolder()).then((entries) => entries.find((e) => e.name === 'Hausratversicherung')!);
    expect((await insurance()).monthly_cost).toBe('65');

    await firstValueFrom(finanzen.updateRecurringDeduction('demo-deduction-versicherung', 'Versicherung', 70, null, true));
    expect((await insurance()).monthly_cost).toBe('70');

    await firstValueFrom(finanzen.updateRecurringDeduction('demo-deduction-versicherung', 'Versicherung', 70, null, false));
    const paused = await insurance();
    expect(paused.monthly_cost).toBeNull();
    expect(paused.deduction_active).toBe(false);
  });

  it('refuses to run next to the real finance provider (never writes real data)', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: FINANZEN_DATA_PROVIDER, useValue: Object.create(RealFinanzenDataProvider.prototype) },
        DemoHaushaltDataProvider,
      ],
    });
    expect(() => TestBed.inject(DemoHaushaltDataProvider)).toThrowError(/DemoFinanzenDataProvider/);
  });
});
