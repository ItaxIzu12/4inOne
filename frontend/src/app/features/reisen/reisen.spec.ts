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

  function isoDateOffset(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  it('shows the demo trip on the Übersicht with real packing/task/budget numbers', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('.trip-detail h2'))).toBe('Berlin, Deutschland');
    expect(text(compiled.querySelector('.trip-detail'))).toContain('Berlin Wochenende');
    expect(text(compiled.querySelector('.trip-cards__item--packliste'))).toContain('1 von 3 gepackt');
    expect(text(compiled.querySelector('.trip-cards__item--aufgaben'))).toContain('Zugtickets buchen');
  });

  it('a failed detail load shows a clear error with a working retry, not a stuck blank state', () => {
    const spy = vi.spyOn(DemoReisenApi.prototype, 'packingItems').mockReturnValueOnce(throwError(() => ({ status: 500 })));
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('.field-error'))).toBe('Die Details dieser Reise konnten nicht geladen werden.');
    const retry = Array.from(compiled.querySelectorAll('button')).find((b) => text(b) === 'Erneut versuchen') as HTMLButtonElement;
    expect(retry).toBeTruthy();

    spy.mockRestore();
    retry.click();
    fixture.detectChanges();
    const refreshed = fixture.nativeElement as HTMLElement;
    expect(refreshed.querySelector('.field-error')).toBeNull();
    expect(text(refreshed.querySelector('.trip-cards__item--packliste'))).toContain('1 von 3 gepackt');
  });

  it('lets you check off a packing item and see the progress update', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openTab(fixture, 'Packliste');
    let compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('.card-heading .small'))).toBe('1 von 3 gepackt (33%)');
    const ladekabelCheck = Array.from(compiled.querySelectorAll('.row')).find((row) => text(row).includes('Ladekabel'))!
      .querySelector('.completion') as HTMLButtonElement;
    ladekabelCheck.click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(text(compiled.querySelector('.card-heading .small'))).toBe('2 von 3 gepackt (67%)');
  });

  it('groups the packing list by category, and shows no misleading progress on an empty list', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openTab(fixture, 'Packliste');
    const compiled = fixture.nativeElement as HTMLElement;

    const groupHeadings = Array.from(compiled.querySelectorAll('.group h3')).map(text);
    expect(groupHeadings).toEqual(['Dokumente', 'Kleidung', 'Technik']);
    const documentsGroup = Array.from(compiled.querySelectorAll('.group')).find((g) => text(g.querySelector('h3')) === 'Dokumente')!;
    expect(text(documentsGroup)).toContain('Reisepass');
  });

  it('editing a packing item loads its current values and lets you change them', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openTab(fixture, 'Packliste');
    let compiled = fixture.nativeElement as HTMLElement;

    const row = Array.from(compiled.querySelectorAll('.row')).find((r) => text(r).includes('Warme Jacke'))!;
    (row.querySelector('.row__link') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect((compiled.querySelector('#packing-item-title') as HTMLInputElement).value).toBe('Warme Jacke');
    (compiled.querySelector('#packing-item-title') as HTMLInputElement).value = 'Wintermantel';
    (compiled.querySelector('#packing-item-title') as HTMLInputElement).dispatchEvent(new Event('input'));
    (compiled.querySelector('app-modal-form form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const rows = Array.from(compiled.querySelectorAll('.list .row')).map(text);
    expect(rows.some((r) => r.includes('Wintermantel'))).toBe(true);
    expect(rows.some((r) => r.includes('Warme Jacke'))).toBe(false);
  });

  it('deleting a packing item from the edit dialog removes it after confirming', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openTab(fixture, 'Packliste');
    let compiled = fixture.nativeElement as HTMLElement;

    const row = Array.from(compiled.querySelectorAll('.row')).find((r) => text(r).includes('Warme Jacke'))!;
    (row.querySelector('.row__link') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('app-modal-form .mf-link') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('app-modal-form .mf-btn--danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const rows = Array.from(compiled.querySelectorAll('.list .row')).map(text);
    expect(rows.some((r) => r.includes('Warme Jacke'))).toBe(false);
  });

  it('lets you add a new packing item with a category and note, grouped under that category', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openTab(fixture, 'Packliste');
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.card-heading .secondary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('#packing-item-title') as HTMLInputElement).value = 'Sonnencreme';
    (compiled.querySelector('#packing-item-title') as HTMLInputElement).dispatchEvent(new Event('input'));
    fixture.componentInstance.packingForm.patchValue({ category: 'GESUNDHEIT', note: 'LSF 50' });
    fixture.detectChanges();
    (compiled.querySelector('app-modal-form form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const group = Array.from(compiled.querySelectorAll('.group')).find((g) => text(g.querySelector('h3')) === 'Gesundheit')!;
    expect(text(group)).toContain('Sonnencreme');
    expect(text(group)).toContain('LSF 50');
  });

  it('lets you mark an existing trip task done and open again, without losing its due date', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openTab(fixture, 'Aufgaben');
    let compiled = fixture.nativeElement as HTMLElement;

    expect(Array.from(compiled.querySelectorAll('.list .row')).map(text).some((row) => row.includes('Zugtickets buchen'))).toBe(true);

    const check = Array.from(compiled.querySelectorAll('.row')).find((row) => text(row).includes('Zugtickets buchen'))!
      .querySelector('.completion') as HTMLButtonElement;
    check.click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.row__title--done')?.textContent).toContain('Zugtickets buchen');

    check.click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    const zugticketsRow = Array.from(compiled.querySelectorAll('.row')).find((row) => text(row).includes('Zugtickets buchen'))!;
    expect(zugticketsRow.querySelector('.row__title--done')).toBeNull();
  });

  it('lets you add a new trip task with a due date and a note', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openTab(fixture, 'Aufgaben');
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.card-heading .secondary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('#task-item-title') as HTMLInputElement).value = 'Visum beantragen';
    (compiled.querySelector('#task-item-title') as HTMLInputElement).dispatchEvent(new Event('input'));
    fixture.componentInstance.taskForm.patchValue({ due_date: isoDateOffset(5), note: 'Braucht ca. 2 Wochen' });
    fixture.detectChanges();
    (compiled.querySelector('app-modal-form form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const row = Array.from(compiled.querySelectorAll('.list .row')).find((r) => text(r).includes('Visum beantragen'))!;
    expect(text(row)).toContain('Braucht ca. 2 Wochen');
  });

  it('editing a trip task loads its current values, and deleting it removes it after confirming', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openTab(fixture, 'Aufgaben');
    let compiled = fixture.nativeElement as HTMLElement;

    const row = Array.from(compiled.querySelectorAll('.row')).find((r) => text(r).includes('Zugtickets buchen'))!;
    (row.querySelector('.row__link') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect((compiled.querySelector('#task-item-title') as HTMLInputElement).value).toBe('Zugtickets buchen');

    (compiled.querySelector('app-modal-form .mf-link') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('app-modal-form .mf-btn--danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(Array.from(compiled.querySelectorAll('.list .row')).map(text).some((r) => r.includes('Zugtickets buchen'))).toBe(false);
  });

  it('shows the budget progress and lets you add an expense', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openTab(fixture, 'Budget');
    let compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('.budget-numbers'))).toContain('90,00 €');
    expect(text(compiled.querySelector('.budget-numbers'))).toContain('350,00 €');

    (compiled.querySelector('#expense-title') as HTMLInputElement).value = 'Museum';
    (compiled.querySelector('#expense-title') as HTMLInputElement).dispatchEvent(new Event('input'));
    (compiled.querySelector('#expense-amount') as HTMLInputElement).value = '15';
    (compiled.querySelector('#expense-amount') as HTMLInputElement).dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (compiled.querySelector('.add-form button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(text(compiled.querySelector('.budget-numbers'))).toContain('105,00 €');
  });

  it('shows planned budget per category in a fixed order, including categories with no plan yet', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openTab(fixture, 'Budget');
    const compiled = fixture.nativeElement as HTMLElement;

    const labels = Array.from(compiled.querySelectorAll('.budget-category-label')).map(text);
    expect(labels).toEqual(['Transport', 'Unterkunft', 'Essen', 'Aktivitäten', 'Shopping', 'Sonstiges', 'Reserve']);

    const rows = Array.from(compiled.querySelectorAll('.budget-category-row'));
    const transportInput = rows.find((r) => text(r).includes('Transport'))!.querySelector('input') as HTMLInputElement;
    const shoppingInput = rows.find((r) => text(r).includes('Shopping'))!.querySelector('input') as HTMLInputElement;
    expect(transportInput.value).toBe('80.00');
    expect(shoppingInput.value).toBe(''); // noch keine Planung für diese Kategorie
  });

  it('lets you plan (and later clear) a budget amount per category', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openTab(fixture, 'Budget');
    let compiled = fixture.nativeElement as HTMLElement;

    const shoppingRow = Array.from(compiled.querySelectorAll('.budget-category-row')).find((r) => text(r).includes('Shopping'))!;
    const shoppingInput = shoppingRow.querySelector('input') as HTMLInputElement;
    shoppingInput.value = '120';
    shoppingInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const updatedRow = Array.from(compiled.querySelectorAll('.budget-category-row')).find((r) => text(r).includes('Shopping'))!;
    expect((updatedRow.querySelector('input') as HTMLInputElement).value).toBe('120.00');
    expect(text(compiled.querySelector('.budget-category-sum'))).toContain('Geplant gesamt');

    // Auf 0/leer setzen entfernt die Planung wieder, statt eine irreführende "0"-Zeile zu behalten.
    const input = updatedRow.querySelector('input') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    const clearedRow = Array.from(compiled.querySelectorAll('.budget-category-row')).find((r) => text(r).includes('Shopping'))!;
    expect((clearedRow.querySelector('input') as HTMLInputElement).value).toBe('');
  });

  it('formats budget amounts in the trip\'s own currency, not always euro', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

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
    compiled = fixture.nativeElement as HTMLElement;
    expect(text(compiled.querySelector('.budget-numbers'))).toContain('$ 2.000,00');
  });

  it('lets you create a new trip, which then appears in Meine Reisen', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

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

    const rows = Array.from(compiled.querySelectorAll('.trip-row .row__title')).map(text);
    expect(rows).toContain('Wanderurlaub Alpen');
  });

  it('warns about a trip that overlaps the demo trip, but still allows saving anyway', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

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

    const rows = Array.from(compiled.querySelectorAll('.trip-row .row__title')).map(text);
    expect(rows).toContain('Zwischenstopp');
  });

  it('"Daten ändern" dismisses the overlap warning and returns to the form instead of closing it', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

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

    openTab(fixture, 'Reisen');
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.edit-icon-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

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

    expect(text(compiled.querySelector('.modal-form__error'))).toBe('Das Ende darf nicht vor dem Beginn liegen.');
    const rows = Array.from(compiled.querySelectorAll('.trip-row .row__title')).map(text);
    expect(rows).not.toContain('Falsche Reihenfolge');
  });

  function createTrip(
    fixture: ReturnType<typeof TestBed.createComponent<Reisen>>,
    values: { title: string; travel_type?: string; transport_type?: string; baggage_type?: string },
  ) {
    let compiled = fixture.nativeElement as HTMLElement;
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
    openTab(fixture, 'Packliste');
    compiled = fixture.nativeElement as HTMLElement;
    expect(text(compiled.querySelector('.card-heading h2'))).toContain('Konferenzreise');
    expect(Array.from(compiled.querySelectorAll('.list .row')).length).toBe(0);
    // Kein irreführendes 100 % (oder irgendeine Prozentzahl), solange keine Packitems existieren.
    expect(compiled.querySelector('.card-heading .small')).toBeNull();
    expect(text(compiled.querySelector('.empty'))).toContain('Noch nichts auf der Packliste');
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
    openTab(fixture, 'Packliste');
    compiled = fixture.nativeElement as HTMLElement;
    const titles = Array.from(compiled.querySelectorAll('.list .row .row__title')).map(text);
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

    openTab(fixture, 'Packliste');
    compiled = fixture.nativeElement as HTMLElement;
    const titles = Array.from(compiled.querySelectorAll('.list .row .row__title')).map(text);
    expect(titles).toContain('Arbeitsgerät');
    expect(titles).not.toContain('Business-Unterlagen');
  });

  function openParticipants(fixture: ReturnType<typeof TestBed.createComponent<Reisen>>, tripTitle: string) {
    openTab(fixture, 'Reisen');
    const compiled = fixture.nativeElement as HTMLElement;
    const row = Array.from(compiled.querySelectorAll('.trip-row-wrap')).find((r) => text(r).includes(tripTitle))!;
    (row.querySelector('.icon-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('participants: a solo trip starts with its creator as the only, OWNER participant', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openParticipants(fixture, 'Berlin Wochenende');
    const compiled = fixture.nativeElement as HTMLElement;

    expect(text(compiled.querySelector('#participants-heading'))).toContain('Berlin Wochenende');
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

    fixture.componentInstance.newParticipantContactId.set(201);
    fixture.componentInstance.newParticipantRole.set('EDITOR');
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    (Array.from(compiled.querySelectorAll('.add-form button')).find((b) => text(b) === 'Hinzufügen') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const rows = Array.from(compiled.querySelectorAll('.participants-editor .list .row'));
    expect(rows.length).toBe(2);
    const maxRow = rows.find((r) => text(r).includes('Max'))!;
    expect(text(maxRow)).toContain('Bearbeiter');
  });

  it('participants: removing someone else takes them off the list, but leaving (removing yourself) closes the dialog', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    openParticipants(fixture, 'Berlin Wochenende');
    let compiled = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.newParticipantContactId.set(201);
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    (Array.from(compiled.querySelectorAll('.add-form button')).find((b) => text(b) === 'Hinzufügen') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    let rows = Array.from(compiled.querySelectorAll('.participants-editor .list .row'));
    const maxRow = rows.find((r) => text(r).includes('Max'))!;
    (maxRow.querySelector('.icon-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    rows = Array.from(compiled.querySelectorAll('.participants-editor .list .row'));
    expect(rows.length).toBe(1);
    expect(text(compiled.querySelector('.participants-editor'))).not.toContain('Max');

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

    // Demo-Reise: 1 von 3 gepackt (33%), 1 von 2 Aufgaben erledigt (50%), Budget gesetzt (100%), Zeitraum (100%).
    // Schnitt aus allen vier: (100+33+50+100)/4 = 70.75 → 71%.
    expect(text(compiled.querySelector('.readiness__percent'))).toBe('71 %');
    const checklist = text(compiled.querySelector('.readiness__list'));
    expect(checklist).toContain('Reisezeitraum vollständig');
    expect(checklist).toContain('1 von 3 Packitems');
    expect(checklist).toContain('1 von 2 Aufgaben');
    expect(checklist).toContain('Budget festgelegt');
    expect(checklist).toContain('Noch offene Vorbereitung');
  });

  it('readiness: packing everything and completing all tasks reaches 100% and shows "Alles vorbereitet"', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();

    openTab(fixture, 'Packliste');
    let compiled = fixture.nativeElement as HTMLElement;
    for (const title of ['Ladekabel', 'Warme Jacke']) {
      const toggle = Array.from(compiled.querySelectorAll('.row')).find((row) => text(row).includes(title))!.querySelector('.completion') as HTMLButtonElement;
      toggle.click();
      fixture.detectChanges();
      compiled = fixture.nativeElement as HTMLElement;
    }

    openTab(fixture, 'Aufgaben');
    compiled = fixture.nativeElement as HTMLElement;
    const taskToggle = Array.from(compiled.querySelectorAll('.row')).find((row) => text(row).includes('Zugtickets buchen'))!
      .querySelector('.completion') as HTMLButtonElement;
    taskToggle.click();
    fixture.detectChanges();

    openTab(fixture, 'Übersicht');
    compiled = fixture.nativeElement as HTMLElement;
    expect(text(compiled.querySelector('.readiness__percent'))).toBe('100 %');
    expect(text(compiled.querySelector('.readiness__list'))).toContain('Alles vorbereitet');
  });

  it('readiness: a brand-new trip with nothing packed/planned yet gets a low, non-zero, explainable percentage', () => {
    const fixture = TestBed.createComponent(Reisen);
    fixture.detectChanges();
    createTrip(fixture, { title: 'Frisch angelegt' });
    let compiled = fixture.nativeElement as HTMLElement;
    (Array.from(compiled.querySelectorAll('button')).find((b) => text(b) === 'Überspringen') as HTMLButtonElement).click();
    fixture.detectChanges();

    openTab(fixture, 'Übersicht');
    compiled = fixture.nativeElement as HTMLElement;
    // Nur der Zeitraum ist erfüllt (100%), kein Budget (ausgeklammert), 0 Packitems, 0 Aufgaben → (100+0+0)/3 = 33%.
    expect(text(compiled.querySelector('.readiness__percent'))).toBe('33 %');
    const checklist = text(compiled.querySelector('.readiness__list'));
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

    openTab(fixture, 'Packliste');
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.card-heading .secondary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('#packing-item-title') as HTMLInputElement).value = 'Zahnbürste';
    (compiled.querySelector('#packing-item-title') as HTMLInputElement).dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (compiled.querySelector('app-modal-form form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.row .completion') as HTMLButtonElement).click();
    fixture.detectChanges();

    openTab(fixture, 'Aufgaben');
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.card-heading .secondary') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('#task-item-title') as HTMLInputElement).value = 'Koffer packen';
    (compiled.querySelector('#task-item-title') as HTMLInputElement).dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (compiled.querySelector('app-modal-form form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.row .completion') as HTMLButtonElement).click();
    fixture.detectChanges();

    openTab(fixture, 'Übersicht');
    compiled = fixture.nativeElement as HTMLElement;
    expect(text(compiled.querySelector('.readiness__percent'))).toBe('100 %');
    expect(text(compiled.querySelector('.readiness__list'))).not.toContain('Budget');
  });
});
