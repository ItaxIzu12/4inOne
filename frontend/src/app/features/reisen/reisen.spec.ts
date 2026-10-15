import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { DemoReisenApi } from './demo-reisen-api';
import { Reisen } from './reisen';
import { ReisenApi } from './reisen-api.service';

type Fixture = ComponentFixture<Reisen>;

function text(element: Element | null | undefined): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}
function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('Reisen V1 (Demo)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Reisen],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ReisenApi, useClass: DemoReisenApi }],
    }).compileComponents();
  });

  async function settle(fixture: Fixture): Promise<HTMLElement> {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  /** Seite unter einer Adresse öffnen, z. B. '/?trip=1&tab=planung'. */
  async function open(url = '/'): Promise<{ fixture: Fixture; root: HTMLElement }> {
    await TestBed.inject(Router).navigateByUrl(url);
    const fixture = TestBed.createComponent(Reisen);
    return { fixture, root: await settle(fixture) };
  }
  function button(root: HTMLElement, label: string, scope = 'button'): HTMLButtonElement {
    const match = Array.from(root.querySelectorAll<HTMLButtonElement>(scope)).find((b) => text(b) === label || b.getAttribute('aria-label') === label);
    if (!match) throw new Error(`Knopf „${label}“ nicht gefunden`);
    return match;
  }
  function type(root: HTMLElement, selector: string, value: string) {
    const input = root.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
  async function submitModal(fixture: Fixture) {
    ((fixture.nativeElement as HTMLElement).querySelector('app-modal-form form') as HTMLFormElement).requestSubmit();
    await settle(fixture);
  }
  function fillTrip(fixture: Fixture, values: Partial<Record<'title' | 'destination' | 'start_date' | 'end_date', string>>) {
    fixture.componentInstance.tripForm.patchValue(values);
    fixture.detectChanges();
  }

  // ---------- Meine Reisen ----------

  it('Meine Reisen groups upcoming and past trips; a card shows dates, countdown, tasks, packing and budget', async () => {
    const { root } = await open();
    const groups = Array.from(root.querySelectorAll('app-trip-list .group__title')).map(text);
    expect(groups).toEqual(['Bevorstehend 3', 'Vergangen 1']);
    const berlin = Array.from(root.querySelectorAll('app-trip-list .trip')).find((c) => text(c).includes('Berlin Wochenende'))!;
    expect(text(berlin)).toContain('In 12 Tagen');
    expect(text(berlin)).toContain('4 Aufgaben offen');
    expect(text(berlin)).toContain('12 / 24 gepackt');
    expect(text(berlin)).toContain('420 € / 700 €');
    expect(berlin.getAttribute('aria-label')).toContain('Berlin Wochenende');
    // Keine globalen Reiter wie Packlisten/Budget/Erinnerungen auf Meine Reisen.
    expect(root.querySelector('.tabs')).toBeNull();
  });

  it('a real account without trips shows the empty state with one way to start, never a demo trip', async () => {
    vi.spyOn(DemoReisenApi.prototype, 'trips').mockReturnValue(of([]));
    const { root } = await open();
    expect(text(root.querySelector('app-trip-list h2'))).toBe('Noch keine Reisen');
    expect(text(root.querySelector('app-trip-list'))).toContain('Plane deine erste Reise');
    expect(root.querySelectorAll('app-trip-list .trip, app-trip-list .row').length).toBe(0);
    // Nur ein „Reise erstellen“ — kein zweiter Knopf im Kopf.
    expect(Array.from(root.querySelectorAll('button')).filter((b) => text(b) === 'Reise erstellen').length).toBe(1);
  });

  it('shows a stable loading state and a clear error with retry', async () => {
    const spy = vi.spyOn(DemoReisenApi.prototype, 'trips').mockReturnValue(NEVER);
    let { fixture, root } = await open();
    expect(text(root.querySelector('[role=status]'))).toBe('Deine Reisen werden geladen …');
    fixture.destroy();
    spy.mockReturnValue(throwError(() => ({ status: 500 })));
    ({ fixture, root } = await open());
    expect(text(root)).toContain('Deine Reisen konnten nicht geladen werden.');
    expect(text(root)).not.toContain('500');
    spy.mockRestore();
    button(root, 'Erneut versuchen').click();
    root = await settle(fixture);
    expect(root.querySelectorAll('app-trip-list .trip, app-trip-list .row').length).toBe(4);
  });

  it('restricts new trip dates and validates changed ranges without locking historical edits', async () => {
    const { fixture } = await open();
    const component = fixture.componentInstance;
    component.openTripEditor();
    expect(component.tripStartMin()).toBe(isoDateOffset(0));
    expect(component.tripEndMin()).toBe(isoDateOffset(0));
    component.tripForm.patchValue({ start_date: isoDateOffset(-1), end_date: isoDateOffset(0) });
    component.tripTouched.set(true);
    expect(component.startError()).toContain('nicht vor heute');
    component.tripForm.patchValue({ start_date: isoDateOffset(3), end_date: isoDateOffset(2) });
    expect(component.tripEndMin()).toBe(isoDateOffset(3));
    expect(component.endError()).toContain('nicht vor dem Beginn');
    component.tripForm.controls.end_date.setValue(isoDateOffset(3));
    expect(component.endError()).toBe('');
    component.editTripId.set(1);
    component.tripForm.patchValue({ start_date: isoDateOffset(-3), end_date: isoDateOffset(-2) });
    expect(component.tripStartMin()).toBe('');
    expect(component.startError()).toBe('');
  });

  // ---------- Reise öffnen ----------

  it('opening a trip shows exactly four tabs and the overview with concrete numbers', async () => {
    const { fixture, root } = await open();
    (Array.from(root.querySelectorAll<HTMLButtonElement>('app-trip-list .trip')).find((c) => text(c).includes('Berlin')))!.click();
    const page = await settle(fixture);
    expect(text(page.querySelector('h1'))).toBe('Berlin Wochenende');
    expect(Array.from(page.querySelectorAll('.tabs button')).map(text)).toEqual(['Übersicht', 'Planung', 'Packliste', 'Budget']);
    const tiles = Array.from(page.querySelectorAll('app-trip-overview .tile-card')).map(text);
    expect(tiles[0]).toContain('4 Aufgaben offen');
    expect(tiles[1]).toContain('12 von 24 gepackt');
    expect(tiles[2]).toContain('420 € von 700 €');
    expect(tiles[3]).toContain('2 Personen');
    expect(text(page.querySelector('app-trip-overview .countdown'))).toContain('In 12 Tagen');
    expect(text(page.querySelector('app-trip-overview .facts'))).toContain('Düsseldorf');
    // Kein erfundener Bereitschafts-Score.
    expect(text(page)).not.toMatch(/\d+ % vorbereitet/);
  });

  it('old links (?tab=packlisten, ?tab=erinnerungen) land in the new tabs', async () => {
    let { root } = await open('/?trip=1&tab=packlisten');
    expect(root.querySelector('.tabs button[aria-current]')?.id).toBe('reisen-tab-packliste');
    ({ root } = await open('/?trip=1&tab=erinnerungen'));
    expect(root.querySelector('.tabs button[aria-current]')?.id).toBe('reisen-tab-planung');
  });

  it('tabs can be switched with the arrow keys, and "Meine Reisen" leads back', async () => {
    const { fixture, root } = await open('/?trip=1');
    root.querySelector('.tabs')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    let page = await settle(fixture);
    expect(page.querySelector('.tabs button[aria-current]')?.id).toBe('reisen-tab-planung');
    page.querySelector('.tabs')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    page = await settle(fixture);
    expect(page.querySelector('.tabs button[aria-current]')?.id).toBe('reisen-tab-uebersicht');
    button(page, 'Meine Reisen').click();
    page = await settle(fixture);
    expect(page.querySelector('app-trip-list')).not.toBeNull();
  });

  it('an unknown or foreign trip id shows one neutral message without details', async () => {
    const { root } = await open('/?trip=999');
    expect(text(root)).toContain('Reise nicht gefunden');
    expect(text(root)).toContain('oder du hast keinen Zugriff');
  });

  it('a failed detail load shows a clear error with a working retry', async () => {
    const spy = vi.spyOn(DemoReisenApi.prototype, 'packingItems').mockReturnValueOnce(throwError(() => ({ status: 500 })));
    const { fixture, root } = await open('/?trip=1');
    expect(text(root.querySelector('.field-error'))).toBe('Diese Reise konnte nicht geladen werden.');
    spy.mockRestore();
    button(root, 'Erneut versuchen').click();
    const page = await settle(fixture);
    expect(page.querySelector('.field-error')).toBeNull();
    expect(text(page.querySelector('app-trip-overview'))).toContain('12 von 24 gepackt');
  });

  // ---------- Reise anlegen, prüfen, bearbeiten ----------

  it('the trip form requires name, destination and both dates, with messages at the fields', async () => {
    const { fixture, root } = await open();
    button(root, 'Reise erstellen', '.domain-heading button').click();
    await settle(fixture);
    await submitModal(fixture);
    const errors = Array.from(fixture.nativeElement.querySelectorAll('app-modal-form app-field')).map((f) => text(f as Element));
    expect(errors.join(' ')).toContain('Bitte gib der Reise einen Namen.');
    expect(errors.join(' ')).toContain('Bitte gib ein Reiseziel an.');
    expect(errors.join(' ')).toContain('Bitte wähle den ersten Reisetag.');
    expect(fixture.componentInstance.tripEditor()).toBe(true);
  });

  it('rejects an end before the start, and saves nothing', async () => {
    const { fixture, root } = await open();
    const before = fixture.componentInstance.trips().length;
    button(root, 'Reise erstellen', '.domain-heading button').click();
    fillTrip(fixture, { title: 'x', destination: 'y', start_date: '2027-11-15', end_date: '2027-11-12' });
    await submitModal(fixture);
    expect(text(fixture.nativeElement.querySelector('app-modal-form'))).toContain('Das Ende darf nicht vor dem Beginn liegen.');
    expect(fixture.componentInstance.trips().length).toBe(before);
  });

  it('a future trip can be created and opens with the optional suggestions', async () => {
    const { fixture, root } = await open();
    button(root, 'Reise erstellen', '.domain-heading button').click();
    fillTrip(fixture, { title: 'Wien', destination: 'Wien', start_date: isoDateOffset(365), end_date: isoDateOffset(367) });
    await submitModal(fixture);
    const page = await settle(fixture);
    expect(text(page.querySelector('h1'))).toBe('Wien');
    expect(text(page.querySelector('#smart-setup-heading'))).toBe('Reise erstellt');
    button(page, 'Ohne Vorschläge starten').click();
    await settle(fixture);
    expect(fixture.componentInstance.packing()).toEqual([]);
    expect(fixture.componentInstance.trips().some((t) => t.title === 'Wien' && t.status === 'PLANNED')).toBe(true);
  });

  it('an overlap is explained, "Daten prüfen" returns to the form, "Trotzdem speichern" saves', async () => {
    const { fixture, root } = await open();
    button(root, 'Reise erstellen', '.domain-heading button').click();
    fillTrip(fixture, { title: 'Potsdam', destination: 'Potsdam', start_date: isoDateOffset(13), end_date: isoDateOffset(15) });
    await submitModal(fixture);
    let modal = fixture.nativeElement.querySelector('app-modal-form') as HTMLElement;
    expect(text(modal.querySelector('.overlap-warning'))).toContain('Diese Reise überschneidet sich mit „Berlin Wochenende“');
    button(modal, 'Daten prüfen').click();
    await settle(fixture);
    modal = fixture.nativeElement.querySelector('app-modal-form') as HTMLElement;
    expect(modal.querySelector('#trip-title')).not.toBeNull();
    await submitModal(fixture);
    await submitModal(fixture); // Trotzdem speichern
    expect(fixture.componentInstance.trips().some((t) => t.title === 'Potsdam')).toBe(true);
  });

  it('editing can cancel a trip; it then moves to the collapsed "Abgesagt" group', async () => {
    const { fixture, root } = await open('/?trip=2');
    button(root, 'Reise bearbeiten').click();
    await settle(fixture);
    fixture.componentInstance.tripForm.patchValue({ status: 'CANCELLED' });
    await submitModal(fixture);
    expect(fixture.componentInstance.trips().find((t) => t.id === 2)?.status).toBe('CANCELLED');
    fixture.componentInstance.backToList();
    const page = await settle(fixture);
    expect(Array.from(page.querySelectorAll('app-trip-list .group__title')).map(text)).toContain('Abgesagt 1');
    expect(text(page.querySelector('app-trip-list'))).not.toContain('Italien Sommerurlaub');
  });

  it('deleting a trip asks first and then returns to Meine Reisen', async () => {
    const { fixture, root } = await open('/?trip=3');
    button(root, 'Reise bearbeiten').click();
    let page = await settle(fixture);
    button(page, 'Reise löschen').click();
    page = await settle(fixture);
    expect(text(page.querySelector('.modal-form__confirm'))).toContain('Wirklich löschen?');
    button(page, 'Ja, löschen').click();
    page = await settle(fixture);
    expect(fixture.componentInstance.trips().some((t) => t.id === 3)).toBe(false);
    expect(page.querySelector('app-trip-list')).not.toBeNull();
  });

  // ---------- Planung ----------

  it('Planung: quick-add a task, tick it off, and the open count follows', async () => {
    const { fixture, root } = await open('/?trip=1&tab=planung');
    type(root, '#trip-task-quick', 'Hotel buchen');
    (root.querySelector('app-trip-planning form.quick') as HTMLFormElement).requestSubmit();
    let page = await settle(fixture);
    expect(text(page.querySelector('app-trip-planning .chips'))).toContain('Offen 5');
    const row = Array.from(page.querySelectorAll('app-trip-planning .row')).find((r) => text(r).includes('Hotel buchen'))!;
    (row.querySelector('input[type=checkbox]') as HTMLInputElement).click();
    page = await settle(fixture);
    expect(text(page.querySelector('app-trip-planning .chips'))).toContain('Offen 4');
    expect(text(page.querySelector('app-trip-planning .chips'))).toContain('Erledigt 2');
  });

  it('Planung: "Meine" shows only my tasks, and the task form offers the people on this trip', async () => {
    const { fixture, root } = await open('/?trip=1&tab=planung');
    button(root, 'Meine 2').click();
    let page = await settle(fixture);
    expect(Array.from(page.querySelectorAll('app-trip-planning .row__text b')).map(text)).toEqual(['Online Check-in', 'Reisepass prüfen']);
    button(page, 'Offen 4').click();
    page = await settle(fixture);
    button(page, 'Restaurant reservieren bearbeiten').click();
    page = await settle(fixture);
    expect(fixture.componentInstance.taskForm.getRawValue().assignee).toBe('201');
    expect(fixture.componentInstance.assigneeOptions().map((o) => o.label)).toEqual(['Niemand bestimmtes', 'Anna (Du)', 'Tom Schulz']);
  });

  it('Planung: an empty trip shows "Noch nichts geplant", and a time without a date is rejected', async () => {
    const { fixture, root } = await open('/?trip=3&tab=planung');
    expect(text(root.querySelector('app-trip-planning .empty h3'))).toBe('Noch nichts geplant');
    button(root, 'Aufgabe hinzufügen', 'app-trip-planning button').click();
    await settle(fixture);
    fixture.componentInstance.taskForm.patchValue({ title: 'Check-in', due_time: '18:00' });
    await submitModal(fixture);
    expect(fixture.componentInstance.taskFormError()).toBe('Bitte wähle zur Uhrzeit auch ein Datum.');
  });

  it('Planung: participants are listed with roles and a privacy note; the owner invites people in a dialog', async () => {
    const { fixture, root } = await open('/?trip=1&tab=planung');
    expect(Array.from(root.querySelectorAll('app-trip-planning .people__name')).map(text)).toEqual(['Anna (Du)', 'Tom Schulz']);
    expect(text(root.querySelector('app-trip-planning .privacy'))).toContain('nie deine Finanzen');
    button(root, 'Verwalten').click();
    const page = await settle(fixture);
    expect(text(page.querySelector('#participants-heading'))).toBe('Teilnehmer – Berlin Wochenende');
    fixture.componentInstance.newParticipantContactId.set(202);
    fixture.componentInstance.addParticipant();
    await settle(fixture);
    // Einladen statt Hinzufügen: Lena ist erst dabei, wenn sie annimmt.
    expect(fixture.componentInstance.selectedTrip()!.participants.map((p) => p.display_name)).not.toContain('Lena');
    expect(fixture.componentInstance.participantsNotice()).toBe('Einladung gesendet. Lena ist dabei, sobald Lena annimmt.');
    expect(fixture.componentInstance.inviteRoleOptions.map((o) => o.value)).toEqual(['VIEWER', 'EDITOR']);
  });

  // ---------- Packliste ----------

  it('Packliste: quick add without a category, tick items, progress "x von y gepackt"', async () => {
    vi.spyOn(DemoReisenApi.prototype, 'packingItems').mockReturnValue(of([]));
    const { fixture, root } = await open('/?trip=3&tab=packliste');
    expect(text(root.querySelector('app-trip-packing h2'))).toBe('Noch keine Packliste');
    vi.restoreAllMocks();
    for (const title of ['Reisepass', 'Ladekabel', 'Jacke']) fixture.componentInstance.quickAddPacking({ title, category: 'SONSTIGES' });
    let page = await settle(fixture);
    expect(text(page.querySelector('#pk-progress'))).toBe('0 von 3 gepackt');
    for (const name of ['Reisepass', 'Ladekabel']) {
      const item = Array.from(page.querySelectorAll('app-trip-packing .item')).find((i) => text(i).includes(name))!;
      (item.querySelector('input') as HTMLInputElement).click();
      page = await settle(fixture);
    }
    expect(text(page.querySelector('#pk-progress'))).toBe('2 von 3 gepackt');
    expect(page.querySelector('app-trip-packing [role=progressbar]')?.getAttribute('aria-valuenow')).toBe('67');
  });

  it('Packliste: unchecking reopens an item, and resetting asks first', async () => {
    const { fixture, root } = await open('/?trip=1&tab=packliste');
    const pass = Array.from(root.querySelectorAll('app-trip-packing .item')).find((i) => text(i).includes('Reisepass'))!;
    (pass.querySelector('input') as HTMLInputElement).click();
    let page = await settle(fixture);
    expect(text(page.querySelector('#pk-progress'))).toBe('11 von 24 gepackt');
    button(page, 'Alle Häkchen entfernen').click();
    page = await settle(fixture);
    expect(text(page.querySelector('app-trip-packing .confirm'))).toContain('Alle 11 Häkchen entfernen?');
    button(page, 'Zurücksetzen').click();
    page = await settle(fixture);
    expect(text(page.querySelector('#pk-progress'))).toBe('0 von 24 gepackt');
  });

  // ---------- Budget ----------

  it('Budget: without budget or expenses a real empty state instead of 0 € / 0 %', async () => {
    const { root } = await open('/?trip=3&tab=budget');
    expect(text(root.querySelector('app-trip-budget h2'))).toBe('Noch kein Reisebudget');
    expect(text(root.querySelector('app-trip-budget'))).not.toContain('0 %');
  });

  it('Budget: 700 € budget, 420 € spent, 280 € left; planned vs. spent per category', async () => {
    const { root } = await open('/?trip=1&tab=budget');
    expect(Array.from(root.querySelectorAll('app-trip-budget .kpis dd')).map(text)).toEqual(['700 €', '420 €', '280 €']);
    const stay = Array.from(root.querySelectorAll('app-trip-budget .cat')).find((c) => text(c).includes('Unterkunft'))!;
    expect(text(stay)).toContain('240 € von 300 €');
    expect(text(stay)).toContain('60 € übrig');
    expect(text(root.querySelector('app-trip-budget .note'))).toContain('nicht automatisch in Finanzen');
  });

  it('Budget: an expense must be above 0, may be dated before the trip, and updates the totals', async () => {
    const { fixture, root } = await open('/?trip=1&tab=budget');
    button(root, 'Ausgabe hinzufügen', 'app-trip-budget button').click();
    await settle(fixture);
    fixture.componentInstance.expenseForm.patchValue({ title: 'Ticket', amount: '0', date: isoDateOffset(-30) });
    await submitModal(fixture);
    expect(fixture.componentInstance.expenseAmountError()).toBe('Bitte gib einen Betrag größer als 0 ein, z. B. 45,50.');
    fixture.componentInstance.expenseForm.patchValue({ amount: '80,00' });
    await submitModal(fixture);
    const page = await settle(fixture);
    expect(fixture.componentInstance.expenseEditor()).toBe(false);
    expect(Array.from(page.querySelectorAll('app-trip-budget .kpis dd')).map(text)).toEqual(['700 €', '500 €', '200 €']);
    expect(text(page.querySelector('app-trip-budget .exp'))).toContain('vor der Reise');
  });

  it('Budget: setting a budget and a currency for a trip without one', async () => {
    const { fixture, root } = await open('/?trip=3&tab=budget');
    button(root, 'Gesamtbudget festlegen', 'app-trip-budget button').click();
    await settle(fixture);
    fixture.componentInstance.planTotal.set('1200');
    fixture.componentInstance.planCurrency.set('CHF');
    fixture.componentInstance.savePlan();
    const page = await settle(fixture);
    expect(Array.from(page.querySelectorAll('app-trip-budget .kpis dd')).map(text)[0]).toBe('1.200 CHF');
  });

  // ---------- Rechte ----------

  it('a viewer sees the trip but gets no editing controls', async () => {
    const { fixture } = await open('/?trip=1&tab=planung');
    fixture.componentInstance.trips.update((list) => list.map((t) => (t.id === 1 ? { ...t, my_role: 'VIEWER' as const } : t)));
    let page = await settle(fixture);
    expect(page.querySelector('app-trip-planning form.quick')).toBeNull();
    expect(page.querySelector('[aria-label="Reise bearbeiten"]')).toBeNull();
    expect((page.querySelector('app-trip-planning input[type=checkbox]') as HTMLInputElement).disabled).toBe(true);
    fixture.componentInstance.selectTab('packliste');
    page = await settle(fixture);
    expect(page.querySelector('#packing-quick')).toBeNull();
  });
});
