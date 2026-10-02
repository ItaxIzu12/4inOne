import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DemoPrivateFinanceApi } from '../finanzen/demo-private-finance-api';
import { PrivateFinanceApi } from '../finanzen/private-finance-api.service';
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
        { provide: PrivateFinanceApi, useClass: DemoPrivateFinanceApi },
        { provide: HAUSHALT_DATA_PROVIDER, useClass: DemoHaushaltDataProvider },
      ],
    }).compileComponents();
  });

  function text(element: Element | null): string {
    return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function openTab(fixture: ReturnType<typeof TestBed.createComponent<Haushalt>>, key: string) {
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector(`#hh-tab-${key}`) as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('starts on the overview with the five tabs from the design', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const tabs = Array.from(compiled.querySelectorAll('[role="tab"]')).map(text);
    expect(tabs).toEqual(['Übersicht', 'Aufgaben', 'Geräte', 'Einkaufsliste', 'Routinen']);
    expect(compiled.querySelector('[role="tab"][aria-selected="true"]')?.id).toBe('hh-tab-uebersicht');
    // Demo: 2 fällige Aufgaben (gestern + heute), Zähler aus derselben Antwort
    expect(text(compiled.querySelector('app-uebersicht-tab .stat__value'))).toBe('4');
    expect(text(compiled.querySelector('app-uebersicht-tab .stat__label'))).toBe('offene Aufgaben');
    // „Aktuelle Aufgaben“: überfällig, dann heute (zwei fällig heute), dann die nächsten (vier Zeilen)
    expect(compiled.querySelectorAll('app-uebersicht-tab .row').length).toBe(4);
    const subtitles = Array.from(compiled.querySelectorAll('app-uebersicht-tab .row__meta')).map(text);
    expect(subtitles).toEqual(['Überfällig', 'Heute', 'Heute', 'Morgen']);
    expect(compiled.querySelector('app-uebersicht-tab .device')).not.toBeNull(); // „Meine Geräte“
    expect(text(compiled.querySelector('.page-head__action'))).toBe('Neue Aufgabe');
    expect(compiled.querySelector('button[aria-label="Bad putzen als erledigt markieren"]')).not.toBeNull();
  });

  it('completing a recurring task on the overview moves it out of today but keeps it open', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('button[aria-label="Bad putzen als erledigt markieren"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    // wiederkehrend: rückt weiter, bleibt offen, ist aber nicht mehr heute fällig (Winterreifen bleibt „Heute“,
    // das ist eine andere, einmalige Aufgabe)
    const rows = Array.from(compiled.querySelectorAll('app-uebersicht-tab .row'));
    const badPutzenRow = rows.find((row) => text(row.querySelector('.row__title')) === 'Bad putzen');
    expect(text(badPutzenRow?.querySelector('.row__meta') ?? null)).not.toBe('Heute');
    expect(text(compiled.querySelector('app-uebersicht-tab .stat__value'))).toBe('4');
  });

  it('"Neue Aufgabe" in the page header opens the task form on the tasks tab', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.page-head__action') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('[role="tab"][aria-selected="true"]')?.id).toBe('hh-tab-aufgaben');
    expect(text(compiled.querySelector('app-modal-form h2'))).toBe('Neue Aufgabe');
  });

  it('the routines tab lists only recurring tasks and offers daily, weekly and monthly', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'routinen');
    const compiled = fixture.nativeElement as HTMLElement;

    const rows = Array.from(compiled.querySelectorAll('app-aufgaben-tab .row__title')).map(text);
    expect(rows).toContain('Bad putzen');
    expect(rows).not.toContain('Winterreifen-Termin vereinbaren'); // einmalig
    (compiled.querySelector('app-aufgaben-tab .card-head .btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    const trigger = Array.from(compiled.querySelectorAll('app-modal-form .select__trigger')).find((t) =>
      text(compiled.querySelector('#' + t.getAttribute('aria-labelledby'))).startsWith('Wie oft?'),
    ) as HTMLButtonElement;
    // Eine neue Routine startet wöchentlich, nicht einmalig
    expect(text(trigger)).toContain('Wöchentlich');
    trigger.click();
    fixture.detectChanges();
    const options = Array.from(compiled.querySelectorAll('app-modal-form [role="option"]')).map(text);
    expect(options).toEqual(['Einmalig', 'Täglich', 'Wöchentlich', 'Monatlich']);
  });

  it('a one-off task can be completed and reopened from the done list', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'aufgaben');
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('button[aria-label="Winterreifen-Termin vereinbaren als erledigt markieren"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.querySelector('button[aria-label="Winterreifen-Termin vereinbaren als erledigt markieren"]')).toBeNull();

    (compiled.querySelector('#toggle-done') as HTMLButtonElement).click();
    fixture.detectChanges();
    (compiled.querySelector('button[aria-label="Winterreifen-Termin vereinbaren wieder öffnen"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.querySelector('button[aria-label="Winterreifen-Termin vereinbaren als erledigt markieren"]')).not.toBeNull();
  });

  it('a task that is not yet due cannot be marked done, on the tab or the overview, but can still be edited', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    // Übersicht: „Müll rausbringen“ ist erst morgen fällig
    const overviewCheck = compiled.querySelector(
      'app-uebersicht-tab button[aria-label*="Müll rausbringen"]',
    ) as HTMLButtonElement;
    expect(overviewCheck.disabled).toBe(true);
    expect(overviewCheck.getAttribute('aria-label')).toContain('noch nicht abhakbar');
    expect(overviewCheck.getAttribute('title')).toContain('Erst');

    openTab(fixture, 'aufgaben');
    compiled = fixture.nativeElement as HTMLElement;
    const taskCheck = compiled.querySelector('button[aria-label*="Müll rausbringen"]') as HTMLButtonElement;
    expect(taskCheck.disabled).toBe(true);
    taskCheck.click();
    fixture.detectChanges();
    // Ein Klick auf den deaktivierten Haken ändert nichts — die Aufgabe bleibt unter „Nächste 7 Tage“
    expect(text(compiled.querySelector('.group h3'))).not.toBe('Erledigt');
    expect(compiled.querySelector('button[aria-label="Bad putzen als erledigt markieren"]')).not.toBeNull();

    // Bearbeiten bleibt jederzeit möglich, nur das Abhaken ist gesperrt
    (compiled.querySelector('button[aria-label*="Müll rausbringen"] ~ .row__edit') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(text(compiled.querySelector('app-modal-form h2'))).toBe('Aufgabe bearbeiten');
  });

  it('shows the shopping list grouped by shop section with accessible check buttons', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'einkauf');
    const compiled = fixture.nativeElement as HTMLElement;

    const headings = Array.from(compiled.querySelectorAll('app-einkauf-tab h3')).map(text);
    expect(headings.slice(0, 3)).toEqual(['Obst & Gemüse', 'Brot & Backwaren', 'Kühlregal']);
    expect(compiled.querySelector('button[aria-label="Bananen abhaken"]')).not.toBeNull();
    expect(compiled.querySelector('[role="tab"][aria-selected="true"]')?.id).toBe('hh-tab-einkauf');
  });

  it('checking items shows the checkout bar, completing books a private expense in the demo finances', async () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'einkauf');
    const compiled = fixture.nativeElement as HTMLElement;
    const finanzen = TestBed.inject(PrivateFinanceApi);
    const before = Number((await firstValueFrom(finanzen.summary())).expenses);

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

    const after = await firstValueFrom(finanzen.summary());
    expect(Number(after.expenses) - before).toBeCloseTo(7.5);
    expect(after.categories.find((c) => c.name === 'Lebensmittel')).toBeTruthy();
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

  it('lists upcoming folder deadlines including the contract cost', () => {
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
      providers: [{ provide: PrivateFinanceApi, useClass: DemoPrivateFinanceApi }, DemoHaushaltDataProvider],
    });
    return { haushalt: TestBed.inject(DemoHaushaltDataProvider), finanzen: TestBed.inject(PrivateFinanceApi) };
  }

  async function bookTrip(haushalt: DemoHaushaltDataProvider, amount: number) {
    const shopping = await firstValueFrom(haushalt.getShopping());
    const open = shopping.items.filter((i) => !i.is_checked).slice(0, 2);
    for (const item of open) await firstValueFrom(haushalt.updateItem(item.id, { is_checked: true }));
    return firstValueFrom(haushalt.completeShopping(amount));
  }

  it('the price estimate uses the shopping amounts, never the private booking', async () => {
    const { haushalt, finanzen } = setup();
    const trip = await bookTrip(haushalt, 20);
    expect((await firstValueFrom(haushalt.getShopping())).price_per_item).toBe('10.00');

    // Eine private Korrektur bleibt privat (ADR-001) und ändert die Schätzung des Haushalts nicht.
    await firstValueFrom(finanzen.save('transactions', { amount: '8.00' }, Number(trip.transaction_id)));
    await firstValueFrom(finanzen.delete('transactions', Number(trip.transaction_id)));
    const after = await firstValueFrom(haushalt.getShopping());
    expect(after.price_per_item).toBe('10.00');
    expect(after.price_from_history).toBe(true);
  });

  it('contract costs belong to the household entry, not to the frozen household finances', async () => {
    const { haushalt } = setup();
    const insurance = () =>
      firstValueFrom(haushalt.getFolder()).then((entries) => entries.find((e) => e.name === 'Hausratversicherung')!);
    const entry = await insurance();
    expect(entry.monthly_cost).toBe('65.00');

    await firstValueFrom(haushalt.updateFolderEntry(entry.id, { ...entry, monthly_cost: '70.00' }));
    expect((await insurance()).monthly_cost).toBe('70.00');
    expect('recurring_deduction_id' in (await insurance())).toBe(false);
  });

  it('refuses to run next to the real finance provider (never writes real data)', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PrivateFinanceApi, useValue: Object.create(PrivateFinanceApi.prototype) },
        DemoHaushaltDataProvider,
      ],
    });
    expect(() => TestBed.inject(DemoHaushaltDataProvider)).toThrowError(/DemoPrivateFinanceApi/);
  });
});
