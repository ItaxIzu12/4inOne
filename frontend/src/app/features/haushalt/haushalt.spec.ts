import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DemoPrivateFinanceApi } from '../finanzen/demo-private-finance-api';
import { PrivateFinanceApi } from '../finanzen/private-finance-api.service';
import { DemoHaushaltDataProvider } from './demo-haushalt-data-provider';
import { AufgabenTab } from './aufgaben-tab';
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
    expect(tabs).toEqual(['Übersicht', 'Aufgaben', 'Verträge', 'Einkaufslisten', 'Routinen']);
    expect(compiled.querySelector('[role="tab"][aria-selected="true"]')?.id).toBe('hh-tab-uebersicht');
    // Demo: zehn offene Aufgaben (pausierte Routinen zählen nicht), Zähler aus derselben Antwort
    expect(text(compiled.querySelector('app-uebersicht-tab .stat__value'))).toBe('10');
    expect(text(compiled.querySelector('app-uebersicht-tab .stat__label'))).toBe('offene Aufgaben');
    // „Heute im Haushalt“: erst überfällig, dann heute fällig — nur, was heute ansteht
    expect(compiled.querySelectorAll('app-uebersicht-tab .task').length).toBe(3);
    const chips = Array.from(compiled.querySelectorAll('app-uebersicht-tab .task .tag')).map(text);
    expect(chips).toEqual(['Überfällig', 'Heute', 'Heute']);
    // Die vier Karten des Entwurfs
    const cards = Array.from(compiled.querySelectorAll('app-uebersicht-tab .card h2')).map(text);
    expect(cards).toEqual(['Heute im Haushalt', 'Verträge', 'Einkauf', 'Routinen']);
    // Verträge statt Geräte: nächste Kündigungsfrist zuerst, Kennzahl mit Monatssumme
    expect(text(compiled.querySelector('app-uebersicht-tab .device strong'))).toBe('Hausratversicherung');
    expect(text(compiled.querySelectorAll('app-uebersicht-tab .stat')[2])).toContain('6Verträge');
    expect(text(compiled.querySelectorAll('app-uebersicht-tab .stat')[2])).toContain('227,47 € im Monat');
    // Die Übersicht hat bewusst keinen Hauptknopf
    expect(compiled.querySelector('.page-head__action')).toBeNull();
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
    const rows = Array.from(compiled.querySelectorAll('app-uebersicht-tab .task'));
    expect(rows.map((row) => text(row.querySelector('.task__title')))).not.toContain('Bad putzen');
    expect(text(compiled.querySelector('app-uebersicht-tab .stat__value'))).toBe('10');
  });

  it('"Neue Aufgabe" in the page header of the tasks tab opens the task form', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'aufgaben');
    const compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('.page-head__action'))).toBe('Neue Aufgabe');
    (compiled.querySelector('.page-head__action') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('[role="tab"][aria-selected="true"]')?.id).toBe('hh-tab-aufgaben');
    expect(text(compiled.querySelector('app-modal-form h2'))).toBe('Neue Aufgabe');
  });

  it('the routines tab groups recurring tasks by rhythm with stats, streak and a pause switch', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'routinen');
    const compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('.page-head__action'))).toBe('Routine hinzufügen');
    const titles = Array.from(compiled.querySelectorAll('app-routinen-tab .title-text')).map(text);
    expect(titles).toContain('Bad putzen');
    expect(titles).not.toContain('Winterreifen-Termin vereinbaren'); // einmalig
    const groups = Array.from(compiled.querySelectorAll('app-routinen-tab .group__long')).map(text);
    expect(groups).toEqual(['Tägliche Routinen', 'Wöchentliche Routinen', 'Monatliche Routinen']);
    // Kennzahlen: 8 aktiv, 2 pausiert, Erledigungsrate aus dem Provider
    const values = Array.from(compiled.querySelectorAll('app-routinen-tab .stat__value')).map(text);
    expect(values.slice(0, 3)).toEqual(['8', '2', '92 %']);
    expect(text(compiled.querySelector('app-routinen-tab .stat__hint'))).toBe('2 pausiert');
    const kitchen = Array.from(compiled.querySelectorAll('app-routinen-tab .row')).find((r) => text(r).includes('Küche sauber halten'))!;
    expect(text(kitchen.querySelector('.row__streak'))).toBe('12 Tage');

    // Schalter pausiert die Routine
    const toggle = kitchen.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(text(compiled.querySelector('app-routinen-tab .stat__value'))).toBe('7');

    // Filter-Chip „Pausiert“
    const chip = Array.from(compiled.querySelectorAll('app-routinen-tab .chip')).find((c) => text(c).startsWith('Pausiert'))!;
    (chip as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(Array.from(compiled.querySelectorAll('app-routinen-tab .title-text')).map(text).sort()).toEqual([
      'Fenster putzen', 'Küche sauber halten', 'Rasen mähen',
    ]);
    // „Wer macht wie viel?“ bleibt
    expect(text(compiled.querySelector('app-routinen-tab .load-list'))).toContain('Anna');
  });

  it('"Routine hinzufügen" opens the shared task form, starting weekly', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'routinen');
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.page-head__action') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(text(compiled.querySelector('app-modal-form h2'))).toBe('Neue Routine');
    const trigger = Array.from(compiled.querySelectorAll('app-modal-form .select__trigger')).find((t) =>
      text(compiled.querySelector('#' + t.getAttribute('aria-labelledby'))).startsWith('Wie oft?'),
    ) as HTMLButtonElement;
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

    // Status-Filter „Erledigt“ zeigt die erledigten Aufgaben
    const tab = fixture.debugElement.query((el) => el.componentInstance instanceof AufgabenTab).componentInstance as AufgabenTab;
    tab['setFilter']('status', 'done');
    fixture.detectChanges();
    (compiled.querySelector('button[aria-label="Winterreifen-Termin vereinbaren wieder öffnen"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.querySelector('button[aria-label="Winterreifen-Termin vereinbaren wieder öffnen"]')).toBeNull();
    tab['setFilter']('status', '');
    fixture.detectChanges();
    expect(compiled.querySelector('button[aria-label="Winterreifen-Termin vereinbaren als erledigt markieren"]')).not.toBeNull();
  });

  it('a task that is not yet due cannot be marked done, on the tab or the overview, but can still be edited', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    // Übersicht: „Müll rausbringen“ ist erst morgen fällig — „Heute im Haushalt“ bietet dafür kein Kästchen an,
    // die Routine erscheint nur mit ihrem nächsten Termin.
    expect(compiled.querySelector('app-uebersicht-tab .box[aria-label*="Müll rausbringen"]')).toBeNull();
    const routine = Array.from(compiled.querySelectorAll('app-uebersicht-tab .routine')).find((r) => text(r).includes('Müll rausbringen'));
    expect(text(routine ?? null)).toContain('Morgen');

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
    expect(compiled.querySelector('button[aria-label="Bananen, 1 kg abhaken"]')).not.toBeNull();
    // Abgehakte bleiben durchgestrichen im Bereich stehen: „2 von 4“
    expect(text(compiled.querySelector('app-einkauf-tab .group__count'))).toBe('2 von 4 erledigt');
    expect(compiled.querySelector('button[aria-label="Äpfel, 1 kg zurück auf die Liste"]')).not.toBeNull();
    // Mehrere Listen links, die erste ist gewählt
    const lists = Array.from(compiled.querySelectorAll('app-einkauf-tab .list-card b')).map(text);
    expect(lists).toEqual(['Wocheneinkauf', 'Drogerie', 'Baumarkt', 'Getränke', 'Party / Gäste']);
    expect(text(compiled.querySelector('app-einkauf-tab .role--owner'))).toBe('Eigentümer');
    expect(compiled.querySelector('[role="tab"][aria-selected="true"]')?.id).toBe('hh-tab-einkauf');
  });

  it('checking items shows the checkout bar, completing books a private expense in the demo finances', async () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'einkauf');
    const compiled = fixture.nativeElement as HTMLElement;
    const finanzen = TestBed.inject(PrivateFinanceApi);
    const before = Number((await firstValueFrom(finanzen.summary())).expenses);

    (compiled.querySelector('button[aria-label="Bananen, 1 kg abhaken"]') as HTMLButtonElement).click();
    (compiled.querySelector('button[aria-label="Milch, 2 l abhaken"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    // Äpfel und Tomaten sind in der Demo schon abgehakt
    expect(text(compiled.querySelector('.checkout-bar__count'))).toBe('4 im Wagen');

    const tab = fixture.debugElement.query((el) => el.componentInstance instanceof EinkaufTab)
      .componentInstance as EinkaufTab;
    tab['openComplete']();
    fixture.detectChanges();
    // 4 Artikel × 3,50 € Startwert
    expect(tab['completeAmount']()).toBe(14);
    tab['nudge'](0.5);
    tab['complete'](true);
    fixture.detectChanges();

    const after = await firstValueFrom(finanzen.summary());
    expect(Number(after.expenses) - before).toBeCloseTo(14.5);
    expect(after.categories.find((c) => c.name === 'Lebensmittel')).toBeTruthy();
    expect(compiled.querySelector('button[aria-label="Bananen, 1 kg abhaken"]')).toBeNull();
    expect(text(compiled.querySelector('app-save-feedback'))).toContain('14,50');
  });

  it('switches to the task tab and shows the load per member', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('#hh-tab-aufgaben') as HTMLButtonElement).click();
    fixture.detectChanges();

    // Wie im Entwurf: Filterleiste, Gruppen-Tabellen mit Spalten, rechts der Überblick
    expect(compiled.querySelectorAll('app-aufgaben-tab .toolbar app-select').length).toBe(4);
    expect(text(compiled.querySelector('.group--overdue'))).toContain('Pflanzen gießen');
    expect(text(compiled.querySelector('.group--overdue .col-heads'))).toBe('RaumZuständigFällig amDauerPriorität');
    expect(text(compiled.querySelector('#ov-heading'))).toBe('Aufgaben im Überblick');
    expect(text(compiled.querySelector('.tile--done'))).toContain('5');
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
    // „erledigt diese Woche“ zählt mit
    expect(text(compiled.querySelector('.tile--done b'))).toBe('6');
  });

  it('the contracts tab shows only contracts with costs, deadlines and the selected contract', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'ordner');
    const compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('.page-head__action'))).toBe('Neuer Vertrag');
    const values = Array.from(compiled.querySelectorAll('app-ordner-tab .stat__value')).map(text);
    expect(values).toEqual(['6', '227,47 €', '2', '1']);
    // Nächste Kündigungsfrist zuerst und gewählt
    const names = Array.from(compiled.querySelectorAll('app-ordner-tab .row__name b')).map(text);
    expect(names.slice(0, 2).sort()).toEqual(['Hausratversicherung', 'Strom']);
    expect(text(compiled.querySelector('#contract-detail-heading'))).toBe(names[0]);
    expect(text(compiled.querySelector('#contracts-heading')?.parentElement ?? null)).toContain('227,47 €');

    // Kennzahl „ohne Frist“ filtert
    (compiled.querySelectorAll('app-ordner-tab .stat')[3] as HTMLElement).click();
    fixture.detectChanges();
    expect(Array.from(compiled.querySelectorAll('app-ordner-tab .row__name b')).map(text)).toEqual(['Streaming']);

    // Nur Verträge: kein Umschalter, keine Geräte
    expect(compiled.querySelector('app-ordner-tab .switcher')).toBeNull();
    expect(text(compiled.querySelector('app-ordner-tab'))).not.toContain('Geschirrspüler');
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
    // Zwei neu abgehakte plus die zwei, die in der Demo schon im Wagen liegen
    expect(trip.item_count).toBe(4);
    expect((await firstValueFrom(haushalt.getShopping())).price_per_item).toBe('5.00');

    // Eine private Korrektur bleibt privat (ADR-001) und ändert die Schätzung des Haushalts nicht.
    await firstValueFrom(finanzen.save('transactions', { amount: '8.00' }, Number(trip.transaction_id)));
    await firstValueFrom(finanzen.delete('transactions', Number(trip.transaction_id)));
    const after = await firstValueFrom(haushalt.getShopping());
    expect(after.price_per_item).toBe('5.00');
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
