import { ErrorNoticeService } from '../../shared/error-notice/error-notice';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { DemoReisenApi } from './demo-reisen-api';
import { Reisen } from './reisen';
import { ReisenApi } from './reisen-api.service';

describe('Reisen (Demo)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Reisen],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ReisenApi, useClass: DemoReisenApi }],
    }).compileComponents();
  });

  function text(element: Element | null): string {
    return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function openTab(fixture: ReturnType<typeof TestBed.createComponent<Reisen>>, label: string) {
    const compiled = fixture.nativeElement as HTMLElement;
    const button = Array.from(compiled.querySelectorAll('.tabs button')).find((b) => text(b) === label) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
  }

  function render(fixture: ReturnType<typeof TestBed.createComponent<Reisen>>): HTMLElement {
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  function find(root: HTMLElement, selector: string, content: string): HTMLElement {
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).find((el) => text(el).includes(content))!;
  }
  function submitModal(fixture: ReturnType<typeof TestBed.createComponent<Reisen>>) {
    ((fixture.nativeElement as HTMLElement).querySelector('app-modal-form form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
  }
  function type(root: HTMLElement, selector: string, value: string) {
    const input = root.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function isoDateOffset(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  it('shows the demo trip on the Übersicht with real packing/task/budget numbers', () => {
    const fixture = TestBed.createComponent(Reisen);
    const compiled = render(fixture);

    const next = compiled.querySelector('app-trip-overview .next');
    expect(text(next?.querySelector('h2') ?? null)).toBe('Berlin Wochenende');
    expect(text(next)).toContain('Nächste Reise');
    expect(text(next)).toContain('in 12 Tagen');
    expect(text(next)).toContain('12 / 24');
    expect(text(next)).toContain('8 offen');
    expect(text(next)).toContain('420 € von 700 €');
    expect(text(compiled.querySelector('.tip'))).toContain('Packliste noch unvollständig');
    expect(Array.from(compiled.querySelectorAll('.kpi__value')).map(text)).toEqual(['2', '8', '60 %']);
    // To-dos (ohne Uhrzeit) und Erinnerungen (mit Uhrzeit) überschneiden sich nicht
    const lists = Array.from(compiled.querySelectorAll('.lists .card'));
    const todos = Array.from(lists[0].querySelectorAll('.row__text b')).map(text);
    const reminders = Array.from(lists[1].querySelectorAll('.row__text b')).map(text);
    expect(todos[0]).toBe('Reiseversicherung prüfen');
    expect(text(lists[0].querySelector('.row__when'))).toBe('Heute');
    expect(reminders).toEqual(expect.arrayContaining(['Online Check-in öffnen', 'Pflanzen gießen', 'Abreise']));
    expect(todos.filter((t) => reminders.includes(t))).toEqual([]);
  });

  it('a failed detail load shows a clear error with a working retry, not a stuck blank state', () => {
    const spy = vi.spyOn(DemoReisenApi.prototype, 'packingItems').mockReturnValueOnce(throwError(() => ({ status: 500 })));
    const fixture = TestBed.createComponent(Reisen);
    const compiled = render(fixture);

    expect(text(compiled.querySelector('.field-error'))).toBe('Die Details dieser Reise konnten nicht geladen werden.');
    const retry = find(compiled, 'button', 'Erneut versuchen') as HTMLButtonElement;
    spy.mockRestore();
    retry.click();
    const refreshed = render(fixture);
    expect(refreshed.querySelector('.field-error')).toBeNull();
    expect(text(refreshed.querySelector('app-trip-overview .next'))).toContain('12 / 24');
  });

  it('Reisen tab: filters by status, sorts, and shows the details of the chosen trip', () => {
    const fixture = TestBed.createComponent(Reisen);
    render(fixture);
    openTab(fixture, 'Reisen');
    let compiled = render(fixture);

    expect(text(compiled.querySelector('#tl-count'))).toBe('3 Reisen');
    expect(Array.from(compiled.querySelectorAll('.trip b')).map(text)).toEqual(['Berlin Wochenende', 'Italien Sommerurlaub', 'Skifahren Schweiz']);
    const detail = text(compiled.querySelector('.detail'));
    expect(detail).toContain('Hotel Central');
    expect(detail).toContain('2 Nächte · Berlin Mitte');
    expect(detail).toContain('Hin- und Rückfahrt gebucht');
    expect(detail).toContain('12 / 24 erledigt');
    expect(detail).toContain('420 € von 700 €');
    expect(detail).toContain('8 offene Aufgaben');

    const list = fixture.debugElement.query((el) => el.name === 'app-trip-list').componentInstance;
    list.status.set('IDEA');
    compiled = render(fixture);
    expect(Array.from(compiled.querySelectorAll('.trip b')).map(text)).toEqual(['Skifahren Schweiz']);
    list.status.set('');
    list.sort.set('date-desc');
    compiled = render(fixture);
    expect(text(compiled.querySelector('.trip b'))).toBe('Skifahren Schweiz');

    (find(compiled, '.trip', 'Italien Sommerurlaub') as HTMLButtonElement).click();
    compiled = render(fixture);
    expect(text(compiled.querySelector('#tl-detail-heading'))).toBe('Italien Sommerurlaub');
    expect(text(compiled.querySelector('.detail'))).toContain('4 Personen');
  });

  it('Packlisten: checking an item updates the progress and shows when it was done', () => {
    const fixture = TestBed.createComponent(Reisen);
    render(fixture);
    openTab(fixture, 'Packlisten');
    let compiled = render(fixture);

    expect(text(compiled.querySelector('#pk-progress'))).toBe('12 von 24 erledigt');
    const ladegeraet = find(compiled, '.item', 'Ladegerät');
    (ladegeraet.querySelector('input') as HTMLInputElement).click();
    compiled = render(fixture);
    expect(text(compiled.querySelector('#pk-progress'))).toBe('13 von 24 erledigt');
    expect(text(find(compiled, '.item', 'Ladegerät'))).toContain('Erledigt am');
  });

  it('Packlisten: grouped by category in a fixed order, with the open/done views', () => {
    const fixture = TestBed.createComponent(Reisen);
    render(fixture);
    openTab(fixture, 'Packlisten');
    let compiled = render(fixture);

    expect(Array.from(compiled.querySelectorAll('.group h3')).map(text)).toEqual(['Wichtige Dokumente', 'Kleidung', 'Technik', 'Hygiene', 'Unterwegs']);
    expect(text(find(compiled, '.group', 'Wichtige Dokumente'))).toContain('2 von 4');
    (find(compiled, '.views button', 'Erledigt') as HTMLButtonElement).click();
    compiled = render(fixture);
    expect(compiled.querySelectorAll('.item').length).toBe(12);
    expect(Array.from(compiled.querySelectorAll('.item__title')).map(text)).not.toContain('Bahn-Ticket');
  });

  it('Packlisten: editing an item loads its values, and deleting it removes it after confirming', () => {
    const fixture = TestBed.createComponent(Reisen);
    render(fixture);
    openTab(fixture, 'Packlisten');
    let compiled = render(fixture);

    (find(compiled, '.item', 'Regenjacke').querySelector('.item__more') as HTMLButtonElement).click();
    compiled = render(fixture);
    expect((compiled.querySelector('#packing-item-title') as HTMLInputElement).value).toBe('Regenjacke');
    type(compiled, '#packing-item-title', 'Wintermantel');
    submitModal(fixture);
    compiled = render(fixture);
    expect(text(find(compiled, '.group', 'Kleidung'))).toContain('Wintermantel');

    (find(compiled, '.item', 'Wintermantel').querySelector('.item__more') as HTMLButtonElement).click();
    compiled = render(fixture);
    (compiled.querySelector('app-modal-form .mf-link') as HTMLButtonElement).click();
    compiled = render(fixture);
    (compiled.querySelector('app-modal-form .mf-btn--danger') as HTMLButtonElement).click();
    compiled = render(fixture);
    expect(text(compiled.querySelector('app-trip-packing'))).not.toContain('Wintermantel');
  });

  it('Packlisten: a new item lands in the chosen category, and reset unchecks everything', () => {
    const fixture = TestBed.createComponent(Reisen);
    render(fixture);
    openTab(fixture, 'Packlisten');
    let compiled = render(fixture);

    (compiled.querySelector('.page-heading .primary') as HTMLButtonElement).click();
    compiled = render(fixture);
    type(compiled, '#packing-item-title', 'Pflaster');
    fixture.componentInstance.packingForm.patchValue({ category: 'GESUNDHEIT', note: 'wasserfest' });
    submitModal(fixture);
    compiled = render(fixture);
    expect(text(find(compiled, '.group', 'Gesundheit'))).toContain('Pflaster');

    (find(compiled, '.actions button', 'Packliste zurücksetzen') as HTMLButtonElement).click();
    compiled = render(fixture);
    (find(compiled, '.confirm button', 'Zurücksetzen') as HTMLButtonElement).click();
    compiled = render(fixture);
    expect(text(compiled.querySelector('#pk-progress'))).toBe('0 von 25 erledigt');
  });

  it('Erinnerungen: trip tasks, household and calendar items in one timeline, filterable by area', () => {
    const fixture = TestBed.createComponent(Reisen);
    render(fixture);
    openTab(fixture, 'Erinnerungen');
    let compiled = render(fixture);

    const titles = Array.from(compiled.querySelectorAll('.item__text b')).map(text);
    expect(titles).toEqual(expect.arrayContaining(['Online Check-in öffnen', 'Koffer packen', 'Pflanzen gießen', 'Abreise']));
    expect(text(find(compiled, '.item', 'Online Check-in öffnen'))).toContain('18:00');
    expect(text(find(compiled, '.item', 'Pflanzen gießen'))).toContain('Haushalt');
    // Demo ohne Anmeldung: der Hinweis zur Haushaltsaufgabe in der Reisezeit
    expect(text(compiled.querySelector('.hint--warn'))).toContain('„Pflanzen gießen“ fällt in deine Reisezeit');

    const reminders = fixture.debugElement.query((el) => el.name === 'app-trip-reminders').componentInstance;
    reminders.area.set('HAUSHALT');
    compiled = render(fixture);
    expect(Array.from(compiled.querySelectorAll('.item__text b')).map(text)).toEqual(['Pflanzen gießen']);
  });

  it('Erinnerungen: a new reminder with date and time appears, and can be marked done', () => {
    const fixture = TestBed.createComponent(Reisen);
    render(fixture);
    openTab(fixture, 'Erinnerungen');
    let compiled = render(fixture);

    (compiled.querySelector('.page-heading .primary') as HTMLButtonElement).click();
    compiled = render(fixture);
    expect(text(compiled.querySelector('app-modal-form h2'))).toBe('Erinnerung hinzufügen');
    type(compiled, '#task-item-title', 'Visum beantragen');
    fixture.componentInstance.taskForm.patchValue({ due_date: isoDateOffset(5), due_time: '10:30', note: 'Braucht ca. 2 Wochen' });
    submitModal(fixture);
    compiled = render(fixture);
    const row = find(compiled, '.item', 'Visum beantragen');
    expect(text(row)).toContain('10:30');

    (row.querySelector('.icon-btn') as HTMLButtonElement).click();
    compiled = render(fixture);
    (find(compiled, '.menu button', 'Als erledigt markieren') as HTMLButtonElement).click();
    compiled = render(fixture);
    expect(find(compiled, '.item', 'Visum beantragen').classList).toContain('is-done');
    expect(fixture.componentInstance.tasks().find((t) => t.title === 'Visum beantragen')?.status).toBe('DONE');
  });

  it('Erinnerungen: a time without a date is rejected with a clear message', () => {
    const fixture = TestBed.createComponent(Reisen);
    render(fixture);
    const component = fixture.componentInstance;
    component.openTaskEditor();
    component.taskForm.patchValue({ title: 'Nur Uhrzeit', due_time: '09:00' });
    component.saveTaskForm();
    expect(component.taskFormError()).toBe('Bitte wähle zur Uhrzeit auch ein Datum.');
  });

  it('Budget: totals, per-category plan vs. spent, and a new expense in its category', () => {
    const fixture = TestBed.createComponent(Reisen);
    render(fixture);
    openTab(fixture, 'Budget');
    let compiled = render(fixture);

    const kpis = Array.from(compiled.querySelectorAll('.kpi')).map(text);
    expect(kpis[0]).toContain('700 €');
    expect(kpis[1]).toContain('420 €');
    expect(kpis[1]).toContain('60 % von 700 €');
    expect(kpis[2]).toContain('280 €');
    expect(kpis[3]).toContain('150 €');
    expect(text(find(compiled, '.cats__row', 'Unterkunft'))).toContain('80 %');

    (compiled.querySelector('.page-heading .primary') as HTMLButtonElement).click();
    compiled = render(fixture);
    type(compiled, '#expense-title', 'Taxi zum Hotel');
    type(compiled, '#expense-amount', '20');
    fixture.componentInstance.expenseForm.patchValue({ category: 'TRANSPORT' });
    submitModal(fixture);
    compiled = render(fixture);
    expect(text(compiled.querySelectorAll('.kpi')[1])).toContain('440 €');
    expect(text(find(compiled, '.cats__row', 'Transport'))).toContain('100 €');
    expect(text(compiled.querySelector('.exp'))).toContain('Taxi zum Hotel');
  });

  it('Budget: planning a category and clearing it again', () => {
    const fixture = TestBed.createComponent(Reisen);
    render(fixture);
    openTab(fixture, 'Budget');
    let compiled = render(fixture);

    (find(compiled, 'button', 'Planung bearbeiten') as HTMLButtonElement).click();
    compiled = render(fixture);
    type(compiled, '#plan-SHOPPING', '120');
    submitModal(fixture);
    compiled = render(fixture);
    expect(text(find(compiled, '.cats__row', 'Shopping'))).toContain('120 €');

    (find(compiled, 'button', 'Planung bearbeiten') as HTMLButtonElement).click();
    compiled = render(fixture);
    expect((compiled.querySelector('#plan-SHOPPING') as HTMLInputElement).value).toBe('120,00');
    type(compiled, '#plan-SHOPPING', '');
    submitModal(fixture);
    compiled = render(fixture);
    expect(find(compiled, '.cats__row', 'Shopping')).toBeUndefined();
  });

  it('formats budget amounts in the trip\'s own currency, not always euro', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    openTab(fixture, 'Reisen'); // die Übersicht hat keinen Hauptknopf
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.page-heading .primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance.tripForm.patchValue({
      title: 'USA-Reise',
      start_date: isoDateOffset(90),
      end_date: isoDateOffset(95),
      budget_amount: '2000',
      currency: 'USD',
    });
    (compiled.querySelector('app-modal-form form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.smart-setup-actions .btn-link') as HTMLButtonElement)?.click(); // Smart Setup überspringen
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    openTab(fixture, 'Budget');
    compiled = render(fixture);
    expect(text(compiled.querySelector('.kpi'))).toContain('$ 2.000');
  });

  it('lets you create a new trip, which then appears in Meine Reisen', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    openTab(fixture, 'Reisen'); // die Übersicht hat keinen Hauptknopf
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.page-heading .primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('#trip-title') as HTMLInputElement).value = 'Wanderurlaub Alpen';
    (compiled.querySelector('#trip-title') as HTMLInputElement).dispatchEvent(new Event('input'));
    fixture.componentInstance.tripForm.patchValue({
      start_date: isoDateOffset(30),
      end_date: isoDateOffset(35),
    });
    fixture.detectChanges();
    (compiled.querySelector('app-modal-form form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const rows = fixture.componentInstance.trips().map((t) => t.title);
    expect(rows).toContain('Wanderurlaub Alpen');
  });

  it('warns about a trip that overlaps the demo trip, but still allows saving anyway', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    openTab(fixture, 'Reisen'); // die Übersicht hat keinen Hauptknopf
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.page-heading .primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance.tripForm.patchValue({
      title: 'Zwischenstopp',
      start_date: isoDateOffset(13),
      end_date: isoDateOffset(20),
    });
    fixture.detectChanges();

    (compiled.querySelector('app-modal-form form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('app-modal-form h2'))).toBe('Terminüberschneidung');
    expect(text(compiled.querySelector('.overlap-warning'))).toContain('Berlin Wochenende');
    // Titel/Datum-Felder sind während der Warnung nicht sichtbar, nur die Warnung selbst.
    expect(compiled.querySelector('#trip-title')).toBeNull();

    (compiled.querySelector('app-modal-form form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const rows = fixture.componentInstance.trips().map((t) => t.title);
    expect(rows).toContain('Zwischenstopp');
  });

  it('"Daten ändern" dismisses the overlap warning and returns to the form instead of closing it', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    openTab(fixture, 'Reisen'); // die Übersicht hat keinen Hauptknopf
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.page-heading .primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance.tripForm.patchValue({
      title: 'Zwischenstopp',
      start_date: isoDateOffset(13),
      end_date: isoDateOffset(20),
    });
    fixture.detectChanges();
    (compiled.querySelector('app-modal-form form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(text(compiled.querySelector('app-modal-form h2'))).toBe('Terminüberschneidung');

    (compiled.querySelector('app-modal-form .mf-btn--soft') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('app-modal-form h2'))).toBe('Neue Reise');
    expect((compiled.querySelector('#trip-title') as HTMLInputElement).value).toBe('Zwischenstopp');
  });

  it('does not warn when editing a trip against its own unchanged dates', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.openTripEditor(fixture.componentInstance.trips()[0]);
    compiled = render(fixture);

    (compiled.querySelector('app-modal-form form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('app-modal-form h2'))).not.toBe('Terminüberschneidung');
  });

  it('blocks a past start date for a new trip, but not when editing one that already started', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openTripEditor();
    expect(component.minStartDate()).toBe(isoDateOffset(0));

    const pastTrip = {
      id: 999,
      title: 'Vergangene Reise',
      destination: '',
      notes: '',
      status: 'DONE' as const,
      travel_type: '' as const,
      transport_type: '' as const,
      baggage_type: '' as const,
      budget_amount: null,
      currency: 'EUR' as const,
      accommodation: '',
      accommodation_area: '',
      transport_note: '',
      created_at: '',
      updated_at: '',
      start_date: isoDateOffset(-20),
      end_date: isoDateOffset(-15),
      packing_total: 0,
      packing_packed: 0,
      tasks_open: 0,
      tasks_total: 0,
      events_count: 0,
      budget_spent: '0.00',
      participants: [],
      my_role: 'OWNER' as const,
    };
    component.openTripEditor(pastTrip);
    expect(component.minStartDate()).toBe('');
  });

  it('rejects an end date before the start date with a clear message, and saves nothing', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    let compiled = fixture.nativeElement as HTMLElement;

    openTab(fixture, 'Reisen'); // die Übersicht hat keinen Hauptknopf
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.page-heading .primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    component.tripForm.patchValue({
      title: 'Falsche Reihenfolge',
      start_date: isoDateOffset(35),
      end_date: isoDateOffset(30),
    });
    (compiled.querySelector('app-modal-form form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(TestBed.inject(ErrorNoticeService).message()).toBe('Das Ende darf nicht vor dem Beginn liegen.');
    const rows = fixture.componentInstance.trips().map((t) => t.title);
    expect(rows).not.toContain('Falsche Reihenfolge');
  });

  function createTrip(
    fixture: ReturnType<typeof TestBed.createComponent<Reisen>>,
    values: { title: string; travel_type?: string; transport_type?: string; baggage_type?: string },
  ) {
    let compiled = fixture.nativeElement as HTMLElement;
    openTab(fixture, 'Reisen'); // die Übersicht hat keinen Hauptknopf
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.page-heading .primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance.tripForm.patchValue({
      title: values.title,
      start_date: isoDateOffset(100),
      end_date: isoDateOffset(103),
      travel_type: values.travel_type ?? '',
      transport_type: values.transport_type ?? '',
      baggage_type: values.baggage_type ?? '',
    });
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('app-modal-form form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
  }

  it('smart setup: skipping the suggestions after creating a trip adds nothing to its packing list', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    createTrip(fixture, { title: 'Konferenzreise', travel_type: 'BUSINESS' });
    let compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('#smart-setup-heading'))).toBe('Deine Reise ist vorbereitet.');

    const skipButton = Array.from(compiled.querySelectorAll('button')).find((b) => text(b) === 'Überspringen') as HTMLButtonElement;
    skipButton.click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#smart-setup-heading')).toBeNull();
    openTab(fixture, 'Packlisten');
    compiled = render(fixture);
    expect(text(compiled.querySelector('.trip-name'))).toContain('Konferenzreise');
    expect(compiled.querySelectorAll('.item').length).toBe(0);
    // Kein irreführendes 100 %, solange keine Packitems existieren.
    expect(text(compiled.querySelector('.progress-card'))).toContain('0 %');
    expect(text(compiled.querySelector('app-trip-packing .empty'))).toContain('Die Packliste ist noch leer');
  });

  it('smart setup: "Alles passende übernehmen" adds every suggested packing item and task', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    createTrip(fixture, { title: 'Konferenzreise 2', travel_type: 'BUSINESS' });
    let compiled = fixture.nativeElement as HTMLElement;

    const acceptAllButton = Array.from(compiled.querySelectorAll('button')).find((b) => text(b) === 'Alles passende übernehmen') as HTMLButtonElement;
    acceptAllButton.click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#smart-setup-heading')).toBeNull();
    openTab(fixture, 'Packlisten');
    compiled = render(fixture);
    const titles = Array.from(compiled.querySelectorAll('.item__title')).map(text);
    expect(titles).toEqual(expect.arrayContaining(['Reisepass / Ausweis', 'Arbeitsgerät', 'Business-Unterlagen']));
  });

  it('smart setup: reviewing and deselecting a suggestion only creates the ones left checked', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    createTrip(fixture, { title: 'Konferenzreise 3', travel_type: 'BUSINESS' });
    let compiled = fixture.nativeElement as HTMLElement;

    const reviewButton = Array.from(compiled.querySelectorAll('button')).find((b) => text(b) === 'Vorschläge prüfen') as HTMLButtonElement;
    reviewButton.click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('#smart-setup-review-heading'))).toContain('Konferenzreise 3');
    const labels = Array.from(compiled.querySelectorAll('.suggestion-list .checkbox'));
    const businessDocsCheckbox = labels.find((l) => text(l).includes('Business-Unterlagen'))!.querySelector('input') as HTMLInputElement;
    businessDocsCheckbox.click();
    fixture.detectChanges();

    const acceptButton = Array.from(compiled.querySelectorAll('button')).find((b) => text(b) === 'Übernehmen') as HTMLButtonElement;
    acceptButton.click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    openTab(fixture, 'Packlisten');
    compiled = render(fixture);
    const titles = Array.from(compiled.querySelectorAll('.item__title')).map(text);
    expect(titles).toContain('Arbeitsgerät');
    expect(titles).not.toContain('Business-Unterlagen');
  });

  function openParticipants(fixture: ReturnType<typeof TestBed.createComponent<Reisen>>, tripTitle: string) {
    const component = fixture.componentInstance;
    component.openParticipantsEditor(component.trips().find((t) => t.title === tripTitle)!);
    render(fixture);
  }

  it('participants: a solo trip starts with its creator as the only, OWNER participant', () => {
    const fixture = TestBed.createComponent(Reisen);
    render(fixture);
    createTrip(fixture, { title: 'Solo-Reise' });
    (find(fixture.nativeElement, 'button', 'Überspringen') as HTMLButtonElement).click();
    render(fixture);
    openParticipants(fixture, 'Solo-Reise');
    const compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('#participants-heading'))).toContain('Solo-Reise');
    const rows = Array.from(compiled.querySelectorAll('.participants-editor .list .row'));
    expect(rows.length).toBe(1);
    expect(text(rows[0])).toContain('Anna');
    expect(text(rows[0])).toContain('(Du)');
    expect(text(rows[0])).toContain('Besitzer');
    // Keine Gruppe/Haushalt-Pflicht: eine Solo-Reise zeigt trotzdem sofort "Teilnehmer hinzufügen" für den Owner.
    expect(text(compiled.querySelector('.participants-editor'))).toContain('Teilnehmer hinzufügen');
  });

  it('participants: the owner can add a contact, who then appears with the chosen role', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openParticipants(fixture, 'Berlin Wochenende');
    let compiled = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.newParticipantContactId.set(202);
    fixture.componentInstance.newParticipantRole.set('EDITOR');
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    (Array.from(compiled.querySelectorAll('.add-form button')).find((b) => text(b) === 'Hinzufügen') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const rows = Array.from(compiled.querySelectorAll('.participants-editor .list .row'));
    expect(rows.length).toBe(3);
    const lenaRow = rows.find((r) => text(r).includes('Lena'))!;
    expect(text(lenaRow)).toContain('Bearbeiter');
  });

  it('participants: removing someone else takes them off the list, but leaving (removing yourself) closes the dialog', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openParticipants(fixture, 'Berlin Wochenende');
    let compiled = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.newParticipantContactId.set(202);
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    (Array.from(compiled.querySelectorAll('.add-form button')).find((b) => text(b) === 'Hinzufügen') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    let rows = Array.from(compiled.querySelectorAll('.participants-editor .list .row'));
    const lenaRow = rows.find((r) => text(r).includes('Lena'))!;
    (lenaRow.querySelector('.icon-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    rows = Array.from(compiled.querySelectorAll('.participants-editor .list .row'));
    expect(rows.length).toBe(2);
    expect(text(compiled.querySelector('.participants-editor'))).not.toContain('Lena');

    const selfRow = rows.find((r) => text(r).includes('Anna'))!;
    (selfRow.querySelector('.icon-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#participants-heading')).toBeNull();
  });

  // ---------- Reise-Detailübersicht: Reisebereitschaft ----------

  it('readiness: the demo trip\'s percentage and checklist reflect its real packing/task/budget data', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    // Demo-Reise: 12 von 24 gepackt (50%), 1 von 9 Aufgaben erledigt (11%), Budget gesetzt (100%), Zeitraum (100%).
    // Schnitt aus allen vier: (100+50+11+100)/4 = 65.25 → 65%.
    expect(text(compiled.querySelector('.prep .num'))).toBe('65 %');
    const r = fixture.componentInstance.readiness()!;
    expect(r.items.map((i) => i.label)).toEqual([
      'Reisezeitraum vollständig',
      '12 von 24 Packitems',
      '1 von 9 Aufgaben',
      'Budget festgelegt',
      'Noch offene Vorbereitung',
    ]);
  });

  it('readiness: packing everything and completing all tasks reaches 100% and shows "Alles vorbereitet"', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    for (const item of component.packing().filter((i) => !i.is_packed)) component.togglePacking(item);
    for (const task of component.tasks().filter((t) => t.status === 'OPEN')) component.toggleTask(task);
    render(fixture);

    openTab(fixture, 'Übersicht');
    const compiled = render(fixture);
    expect(text(compiled.querySelector('.prep .num'))).toBe('100 %');
    expect(fixture.componentInstance.readiness()!.allDone).toBe(true);
    expect(text(compiled.querySelector('.tip'))).toContain('Alles vorbereitet');
  });

  it('readiness: a brand-new trip with nothing packed/planned yet gets a low, non-zero, explainable percentage', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    createTrip(fixture, { title: 'Frisch angelegt' });
    let compiled = fixture.nativeElement as HTMLElement;
    (Array.from(compiled.querySelectorAll('button')).find((b) => text(b) === 'Überspringen') as HTMLButtonElement).click();
    fixture.detectChanges();

    openTab(fixture, 'Übersicht');
    compiled = render(fixture);
    // Nur der Zeitraum ist erfüllt (100%), kein Budget (ausgeklammert), 0 Packitems, 0 Aufgaben → (100+0+0)/3 = 33%.
    expect(text(compiled.querySelector('.prep .num'))).toBe('33 %');
    const checklist = fixture.componentInstance.readiness()!.items.map((i) => i.label).join(' ');
    expect(checklist).toContain('Noch keine Packliste');
    expect(checklist).toContain('Noch keine Aufgaben');
    expect(checklist).not.toContain('Budget');
  });

  it('readiness: a trip without a budget can still reach 100% once packing and tasks are fully done', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    createTrip(fixture, { title: 'Ohne Budget' });
    let compiled = fixture.nativeElement as HTMLElement;
    (Array.from(compiled.querySelectorAll('button')).find((b) => text(b) === 'Überspringen') as HTMLButtonElement).click();
    fixture.detectChanges();

    openTab(fixture, 'Packlisten');
    compiled = render(fixture);
    (compiled.querySelector('.page-heading .primary') as HTMLButtonElement).click();
    compiled = render(fixture);
    type(compiled, '#packing-item-title', 'Zahnbürste');
    submitModal(fixture);
    compiled = render(fixture);
    (compiled.querySelector('.item input') as HTMLInputElement).click();
    render(fixture);

    openTab(fixture, 'Erinnerungen');
    compiled = render(fixture);
    (compiled.querySelector('.page-heading .primary') as HTMLButtonElement).click();
    compiled = render(fixture);
    type(compiled, '#task-item-title', 'Koffer packen');
    submitModal(fixture);
    compiled = render(fixture);
    (find(compiled, '.item', 'Koffer packen').querySelector('.icon-btn') as HTMLButtonElement).click();
    compiled = render(fixture);
    (find(compiled, '.menu button', 'Als erledigt markieren') as HTMLButtonElement).click();
    render(fixture);

    openTab(fixture, 'Übersicht');
    compiled = render(fixture);
    expect(text(compiled.querySelector('.prep .num'))).toBe('100 %');
    expect(fixture.componentInstance.readiness()!.items.map((i) => i.label).join(' ')).not.toContain('Budget');
  });
});
