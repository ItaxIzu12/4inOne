import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DemoPrivateFinanceApi } from '../finanzen/demo-private-finance-api';
import { PrivateFinanceApi } from '../finanzen/private-finance-api.service';
import { DemoHaushaltDataProvider } from './demo-haushalt-data-provider';
import { AufgabenTab } from './aufgaben-tab';
import { EinkaufTab } from './einkauf-tab';
import { Haushalt } from './haushalt';
import { HAUSHALT_DATA_PROVIDER } from './haushalt-data-provider';
import { daysUntil, todayIso } from './haushalt-logic';

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

  it('has exactly the four V1 tabs and starts on “Heute”', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const tabs = Array.from(compiled.querySelectorAll('[role="tab"][id^="hh-tab-"]')).map(text);
    expect(tabs).toEqual(['Heute', 'Aufgaben', 'Einkaufen', 'Zuhause']);
    expect(compiled.querySelector('[role="tab"][aria-selected="true"]')?.id).toBe('hh-tab-heute');
    // „Heute“ hat bewusst keinen Hauptknopf
    expect(compiled.querySelector('.page-head__action')).toBeNull();
    // Heute fällig: erst überfällig, dann heute fällig
    const chips = Array.from(compiled.querySelectorAll('app-uebersicht-tab .task .tag:not(.tag--prio)')).map(text);
    expect(chips).toEqual(['seit gestern überfällig', 'Heute', 'Heute']);
    expect(text(compiled.querySelector('#due-heading'))).toBe('Heute fällig 3');
    // Demnächst: Fristen der nächsten 30 Tage, früheste zuerst
    const soon = Array.from(compiled.querySelectorAll('app-uebersicht-tab .soon__text b')).map(text);
    expect(soon.slice(0, 3)).toEqual(['Geschirrspüler', 'Strom', 'Heizung']);
    // Einkauf: Anzahl, einige Artikel, „Einkauf öffnen“
    expect(compiled.querySelectorAll('app-uebersicht-tab .shop__preview li:not(.shop__more)').length).toBe(4);
    expect(text(compiled.querySelector('app-uebersicht-tab .shop__open'))).toBe('Einkauf öffnen');
  });

  it('old links land on the new tabs', async () => {
    const router = TestBed.inject(Router);
    await router.navigate([], { queryParams: { tab: 'routinen' } });
    let fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="tab"][aria-selected="true"]')?.id).toBe('hh-tab-aufgaben');
    expect(fixture.nativeElement.querySelector('app-routinen-tab')).not.toBeNull();
    fixture.destroy();

    await router.navigate([], { queryParams: { tab: 'ordner' } });
    fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="tab"][aria-selected="true"]')?.id).toBe('hh-tab-zuhause');
    expect(text(fixture.nativeElement.querySelector('.page-head__action'))).toBe('Vertrag hinzufügen');
  });

  it('completing a recurring task on “Heute” moves it on but keeps it open', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('button[aria-label="Bad putzen als erledigt markieren"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const rows = Array.from(compiled.querySelectorAll('app-uebersicht-tab .task'));
    expect(rows.map((row) => text(row.querySelector('.task__title')))).not.toContain('Bad putzen');
    expect(text(compiled.querySelector('app-save-feedback'))).toContain('wieder fällig');
  });

  it('“Aufgabe hinzufügen” in the page header of the tasks tab opens the task form', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'aufgaben');
    const compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('.page-head__action'))).toBe('Aufgabe hinzufügen');
    (compiled.querySelector('.page-head__action') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('[role="tab"][aria-selected="true"]')?.id).toBe('hh-tab-aufgaben');
    expect(text(compiled.querySelector('app-modal-form h2'))).toBe('Neue Aufgabe');
  });

  it('the task views filter by today, overdue and done', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'aufgaben');
    const compiled = fixture.nativeElement as HTMLElement;
    const chip = (label: string) =>
      Array.from(compiled.querySelectorAll<HTMLButtonElement>('app-aufgaben-tab .view-chip')).find((c) => text(c).startsWith(label))!;

    expect(Array.from(compiled.querySelectorAll('app-aufgaben-tab .view-chip')).map(text)).toEqual([
      'Alle', 'Heute 2', 'Überfällig 1', 'Wiederkehrend 8', 'Erledigt',
    ]);
    chip('Heute').click();
    fixture.detectChanges();
    expect(Array.from(compiled.querySelectorAll('app-aufgaben-tab .task__title')).map(text).sort()).toEqual([
      'Bad putzen', 'Winterreifen-Termin vereinbaren',
    ]);
    chip('Überfällig').click();
    fixture.detectChanges();
    expect(Array.from(compiled.querySelectorAll('app-aufgaben-tab .task__title')).map(text)).toEqual(['Pflanzen gießen']);
    expect(chip('Überfällig').getAttribute('aria-pressed')).toBe('true');
  });

  it('“Wiederkehrend” shows the recurring tasks with stats, streak and a pause switch', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'aufgaben');
    const compiled = fixture.nativeElement as HTMLElement;
    (Array.from(compiled.querySelectorAll<HTMLButtonElement>('app-aufgaben-tab .view-chip')).find((c) => text(c).startsWith('Wiederkehrend'))!).click();
    fixture.detectChanges();

    const titles = Array.from(compiled.querySelectorAll('app-routinen-tab .title-text')).map(text);
    expect(titles).toContain('Bad putzen');
    expect(titles).not.toContain('Winterreifen-Termin vereinbaren'); // einmalig
    const values = Array.from(compiled.querySelectorAll('app-routinen-tab .stat__value')).map(text);
    expect(values.slice(0, 3)).toEqual(['8', '2', '92 %']);
    const kitchen = Array.from(compiled.querySelectorAll('app-routinen-tab .row')).find((r) => text(r).includes('Küche sauber halten'))!;
    expect(text(kitchen.querySelector('.row__streak'))).toBe('12 Tage');
    const toggle = kitchen.querySelector('[role="switch"]') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(text(compiled.querySelector('app-routinen-tab .stat__value'))).toBe('7');

    // Hauptaktion öffnet hier das Formular für wiederkehrende Aufgaben — mit jährlich und „alle X …“
    (compiled.querySelector('.page-head__action') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(text(compiled.querySelector('app-modal-form h2'))).toBe('Neue Routine');
    const trigger = Array.from(compiled.querySelectorAll('app-modal-form .select__trigger')).find((t) =>
      text(compiled.querySelector('#' + t.getAttribute('aria-labelledby'))).startsWith('Wie oft?'),
    ) as HTMLButtonElement;
    expect(text(trigger)).toContain('Wöchentlich');
    trigger.click();
    fixture.detectChanges();
    expect(Array.from(compiled.querySelectorAll('app-modal-form [role="option"]')).map(text)).toEqual([
      'Einmalig', 'Täglich', 'Wöchentlich', 'Monatlich', 'Jährlich', 'Alle X Tage', 'Alle X Wochen',
    ]);
  });

  it('a one-off task can be completed and reopened from “Erledigt”', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'aufgaben');
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('button[aria-label="Winterreifen-Termin vereinbaren als erledigt markieren"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.querySelector('button[aria-label="Winterreifen-Termin vereinbaren als erledigt markieren"]')).toBeNull();

    const tab = fixture.debugElement.query((el) => el.componentInstance instanceof AufgabenTab).componentInstance as AufgabenTab;
    tab['selectView']('erledigt');
    fixture.detectChanges();
    (compiled.querySelector('button[aria-label="Winterreifen-Termin vereinbaren wieder öffnen"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.querySelector('button[aria-label="Winterreifen-Termin vereinbaren wieder öffnen"]')).toBeNull();
    tab['selectView']('alle');
    fixture.detectChanges();
    expect(compiled.querySelector('button[aria-label="Winterreifen-Termin vereinbaren als erledigt markieren"]')).not.toBeNull();
  });

  it('a task that is not yet due cannot be marked done, but can still be edited', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;
    // „Heute“ zeigt nur Fälliges: „Müll rausbringen“ (morgen) hat dort kein Kästchen.
    expect(compiled.querySelector('app-uebersicht-tab .box[aria-label*="Müll rausbringen"]')).toBeNull();

    openTab(fixture, 'aufgaben');
    compiled = fixture.nativeElement as HTMLElement;
    const taskCheck = compiled.querySelector('button[aria-label*="Müll rausbringen"]') as HTMLButtonElement;
    expect(taskCheck.disabled).toBe(true);
    (compiled.querySelector('button[aria-label*="Müll rausbringen"] ~ .task__main') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(text(compiled.querySelector('app-modal-form h2'))).toBe('Aufgabe bearbeiten');
  });

  it('shows the shopping list grouped by shop section with accessible check buttons', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'einkaufen');
    const compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('.page-head__action'))).toBe('Liste erstellen');
    const headings = Array.from(compiled.querySelectorAll('app-einkauf-tab h3')).map(text);
    expect(headings.slice(0, 3)).toEqual(['Obst & Gemüse', 'Brot & Backwaren', 'Kühlregal']);
    expect(compiled.querySelector('button[aria-label="Bananen, 1 kg abhaken"]')).not.toBeNull();
    expect(text(compiled.querySelector('app-einkauf-tab .group__count'))).toBe('2 von 4 erledigt');
    const lists = Array.from(compiled.querySelectorAll('app-einkauf-tab .list-card b')).map(text);
    expect(lists).toEqual(['Wocheneinkauf', 'Drogerie', 'Baumarkt', 'Getränke', 'Party / Gäste']);
    expect(compiled.querySelector('[role="tab"][aria-selected="true"]')?.id).toBe('hh-tab-einkaufen');
  });

  it('a list can be archived and restored', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'einkaufen');
    const compiled = fixture.nativeElement as HTMLElement;
    const tab = fixture.debugElement.query((el) => el.componentInstance instanceof EinkaufTab).componentInstance as EinkaufTab;
    const drogerie = tab['lists']().find((l) => l.name === 'Drogerie')!;

    tab['archive'](drogerie, true);
    fixture.detectChanges();
    expect(Array.from(compiled.querySelectorAll('app-einkauf-tab .list-card b')).map(text)).not.toContain('Drogerie');
    const toggle = compiled.querySelector('app-einkauf-tab .archive-toggle') as HTMLButtonElement;
    expect(text(toggle)).toBe('Archiv (1)');
    toggle.click();
    fixture.detectChanges();
    (compiled.querySelector('button[aria-label="Liste Drogerie wiederherstellen"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(Array.from(compiled.querySelectorAll('app-einkauf-tab .list-card b')).map(text)).toContain('Drogerie');
  });

  it('checking items shows the checkout bar, completing books a private expense in the demo finances', async () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'einkaufen');
    const compiled = fixture.nativeElement as HTMLElement;
    const finanzen = TestBed.inject(PrivateFinanceApi);
    const before = Number((await firstValueFrom(finanzen.summary())).expenses);

    (compiled.querySelector('button[aria-label="Bananen, 1 kg abhaken"]') as HTMLButtonElement).click();
    (compiled.querySelector('button[aria-label="Milch, 2 l abhaken"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(text(compiled.querySelector('.checkout-bar__count'))).toBe('4 im Wagen');

    const tab = fixture.debugElement.query((el) => el.componentInstance instanceof EinkaufTab)
      .componentInstance as EinkaufTab;
    tab['openComplete']();
    fixture.detectChanges();
    expect(tab['completeAmount']()).toBe(14);
    tab['nudge'](0.5);
    tab['complete'](true);
    fixture.detectChanges();

    const after = await firstValueFrom(finanzen.summary());
    expect(Number(after.expenses) - before).toBeCloseTo(14.5);
    expect(compiled.querySelector('button[aria-label="Bananen, 1 kg abhaken"]')).toBeNull();
    expect(text(compiled.querySelector('app-save-feedback'))).toContain('14,50');
  });

  it('the tasks tab is a calm list with search, like Organisation', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'aufgaben');
    const compiled = fixture.nativeElement as HTMLElement;

    // Keine Tabelle, keine Seitenleiste: Haken, Titel, darunter die Angaben
    expect(compiled.querySelector('app-aufgaben-tab .toolbar')).toBeNull();
    expect(compiled.querySelector('#ov-heading')).toBeNull();
    const first = compiled.querySelector('app-aufgaben-tab .task')!;
    expect(text(first.querySelector('.task__title'))).toBe('Pflanzen gießen');
    expect(text(first.querySelector('.task__meta'))).toContain('Überfällig');
    expect(text(first.querySelector('.task__meta'))).toContain('Wohnzimmer');
    // Suche über Titel, Raum und Person
    const search = compiled.querySelector('app-aufgaben-tab input[type="search"]') as HTMLInputElement;
    search.value = 'küche'; // Raum Küche und Waschküche
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(Array.from(compiled.querySelectorAll('app-aufgaben-tab .task__title')).map(text).sort()).toEqual([
      'Küche sauber halten', 'Kühlschrank reinigen', 'Wäsche waschen',
    ]);
    search.value = 'ben'; // zuständige Person
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(Array.from(compiled.querySelectorAll('app-aufgaben-tab .task__meta')).every((m) => text(m).includes('Ben'))).toBe(true);
  });

  it('completing a recurring task moves it forward instead of removing it', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'aufgaben');
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('button[aria-label="Pflanzen gießen als erledigt markieren"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    // nicht mehr überfällig, aber weiter in der Liste
    const row = Array.from(compiled.querySelectorAll('app-aufgaben-tab .task')).find((r) => text(r).includes('Pflanzen gießen'))!;
    expect(text(row.querySelector('.task__meta'))).not.toContain('Überfällig');
  });

  it('“Zuhause” shows devices first, contracts on the switch', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'zuhause');
    const compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('.page-head__action'))).toBe('Gerät hinzufügen');
    expect(Array.from(compiled.querySelectorAll('app-ordner-tab .stat__value')).map(text)).toEqual(['7', '1', '2', '0']);
    // Außer Betrieb gesetzte Geräte stehen am Ende
    const devices = Array.from(compiled.querySelectorAll('app-ordner-tab .row__name b')).map(text);
    expect(devices.at(-1)).toBe('Alter Trockner');
    expect(devices).not.toContain('Strom');

    const switchTo = (label: string) =>
      (Array.from(compiled.querySelectorAll<HTMLButtonElement>('app-ordner-tab .section-switch button')).find((b) => text(b) === label)!).click();
    switchTo('Verträge');
    fixture.detectChanges();
    expect(text(compiled.querySelector('.page-head__action'))).toBe('Vertrag hinzufügen');
    expect(Array.from(compiled.querySelectorAll('app-ordner-tab .stat__value')).map(text)).toEqual(['6', '227,47 €', '1', '1']);
    // Nächste Kündigungsfrist zuerst und gewählt — mit Vertragsnummer nur im Detail
    const names = Array.from(compiled.querySelectorAll('app-ordner-tab .row__name b')).map(text);
    expect(names[0]).toBe('Strom');
    expect(text(compiled.querySelector('#zuhause-detail-heading'))).toBe('Strom');
    expect(text(compiled.querySelector('app-ordner-tab .detail'))).toContain('4711-0815');
    expect(text(compiled.querySelector('app-ordner-tab .rows'))).not.toContain('4711-0815');

    // Kennzahl „ohne Frist“ filtert
    (compiled.querySelectorAll('app-ordner-tab .stat')[3] as HTMLElement).click();
    fixture.detectChanges();
    expect(Array.from(compiled.querySelectorAll('app-ordner-tab .row__name b')).map(text)).toEqual(['Streaming']);
  });

  it('a device can be retired and loses its deadlines', () => {
    const fixture = TestBed.createComponent(Haushalt);
    fixture.detectChanges();
    openTab(fixture, 'zuhause');
    const compiled = fixture.nativeElement as HTMLElement;
    const heizung = Array.from(compiled.querySelectorAll<HTMLButtonElement>('app-ordner-tab .row__main')).find((r) => text(r).includes('Heizung'))!;
    heizung.click();
    fixture.detectChanges();
    (Array.from(compiled.querySelectorAll<HTMLButtonElement>('app-ordner-tab .detail__actions button')).find((b) => text(b) === 'Außer Betrieb setzen')!).click();
    fixture.detectChanges();
    expect(text(compiled.querySelector('app-ordner-tab .detail .pill'))).toBe('Außer Betrieb');
    expect(text(compiled.querySelector('app-save-feedback'))).toContain('außer Betrieb gesetzt');
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
    expect(entry.cost).toBe('65.00');

    const detail = await firstValueFrom(haushalt.getFolderEntry(entry.id));
    await firstValueFrom(haushalt.updateFolderEntry(entry.id, { ...entry, contract_number: detail.contract_number ?? '', cost: '70.00' }));
    expect((await insurance()).cost).toBe('70.00');
    expect('recurring_deduction_id' in (await insurance())).toBe(false);
  });

  it('shows the contract number only in the detail view', async () => {
    const { haushalt } = setup();
    const entries = await firstValueFrom(haushalt.getFolder());
    const strom = entries.find((e) => e.name === 'Strom')!;
    expect('contract_number' in strom).toBe(false);
    expect((await firstValueFrom(haushalt.getFolderEntry(strom.id))).contract_number).toBe('4711-0815');
    expect(JSON.stringify(await firstValueFrom(haushalt.getOverview()))).not.toContain('4711-0815');
  });

  it('a retired device has no deadlines and leaves the summary', async () => {
    const { haushalt } = setup();
    const before = await firstValueFrom(haushalt.getOverview());
    const heizung = (await firstValueFrom(haushalt.getFolder())).find((e) => e.name === 'Heizung')!;
    expect(before.deadlines.some((d) => d.name === 'Heizung')).toBe(true);
    const retired = await firstValueFrom(haushalt.updateFolderStatus(heizung.id, 'RETIRED'));
    expect(retired.deadlines).toEqual([]);
    const after = await firstValueFrom(haushalt.getOverview());
    expect(after.deadlines.some((d) => d.name === 'Heizung')).toBe(false);
    expect(after.summary.devices).toBe(before.summary.devices - 1);
  });

  it('“Demnächst” only lists deadlines within the next 30 days', async () => {
    const { haushalt } = setup();
    const overview = await firstValueFrom(haushalt.getOverview());
    expect(overview.deadlines.length).toBeGreaterThan(0);
    expect(overview.deadlines.every((d) => d.days >= 0 && d.days <= 30)).toBe(true);
  });

  it('archived lists are hidden and never the default list', async () => {
    const { haushalt } = setup();
    const lists = await firstValueFrom(haushalt.getShoppingLists());
    await firstValueFrom(haushalt.updateShoppingList(lists[0].id, { archived: true }));
    const visible = await firstValueFrom(haushalt.getShoppingLists());
    expect(visible.map((l) => l.id)).not.toContain(lists[0].id);
    expect((await firstValueFrom(haushalt.getShoppingLists(true))).map((l) => l.id)).toEqual([lists[0].id]);
    expect((await firstValueFrom(haushalt.getShopping())).list.id).toBe(visible[0].id);
  });

  it('a recurring task moves on from its due date and keeps the weekday', async () => {
    const { haushalt } = setup();
    const bad = (await firstValueFrom(haushalt.getTasks())).find((t) => t.title === 'Bad putzen')!;
    const done = await firstValueFrom(haushalt.completeTask(bad.id));
    expect(daysUntil(done.due_date!)).toBe(daysUntil(bad.due_date!) + 7);
    const yearly = await firstValueFrom(
      haushalt.createTask({
        title: 'Heizöl bestellen', description: '', assigned_to: null, due_date: todayIso(), due_time: null, recurrence: 'yearly',
        effort: 1, room: '', duration_minutes: null, priority: 'mittel', rotate: false, rotation_member_ids: [],
      }),
    );
    expect([yearly.recurrence, yearly.recurrence_months]).toEqual(['yearly', 12]);
    const fortnight = await firstValueFrom(
      haushalt.createTask({
        title: 'Fenster', description: '', assigned_to: null, due_date: todayIso(), due_time: null, recurrence_days: 14,
        effort: 1, room: '', duration_minutes: null, priority: 'mittel', rotate: false, rotation_member_ids: [],
      }),
    );
    expect([fortnight.recurrence_days, fortnight.recurrence_months]).toEqual([14, null]);
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
