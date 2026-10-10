import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { ContactOption, PackingItem, Trip, TripBudgetCategory, TripEvent, TripExpense, TripParticipant, TripTask } from './reisen-api.service';

// Feste Demo-Kontakte, nur für diese Instanz: die Demo hat keinen eigenen Login und keine zweite Person, die
// wirklich existiert, daher ist "meine Rolle" hier immer OWNER (siehe withSummary()) und der Kontaktpicker
// braucht keinen echten Contacts-Endpunkt.
const DEMO_CONTACTS: ContactOption[] = [
  { id: 201, name: 'Tom Schulz' },
  { id: 202, name: 'Lena' },
];

// Wie demo-organisation-api.ts: keine HTTP-Aufrufe, ersetzt ReisenApi nur für die öffentliche Demo-Route
// (siehe app.routes.ts), gesamter Zustand lebt nur im Speicher dieser einen Instanz.
//
// Die Reisen sind relativ zu HEUTE datiert, damit "in X Tagen" auf dem Dashboard und in der Übersicht an jedem
// Besuchstag plausibel bleibt.

function dateOnly(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function at(daysOffset: number, hhmm: string): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

type TripBase = Omit<
  Trip,
  'packing_total' | 'packing_packed' | 'tasks_open' | 'tasks_total' | 'events_count' | 'budget_spent' | 'participants' | 'my_role'
>;
const BLANK: Omit<TripBase, 'id' | 'title' | 'start_date' | 'end_date'> = {
  destination: '',
  departure: '',
  notes: '',
  status: 'PLANNED',
  travel_type: '',
  transport_type: '',
  baggage_type: '',
  climate: '',
  budget_amount: null,
  currency: 'EUR',
  accommodation: '',
  accommodation_area: '',
  transport_note: '',
  created_at: at(-5, '09:00'),
  updated_at: at(-5, '09:00'),
};
const BERLIN = 12;
type PackSeed = [string, PackingItem['category'], number | null];
// [Titel, Kategorie, abgehakt vor X Tagen | null = offen] — 12 von 24 erledigt, wie im Entwurf.
const BERLIN_PACKING: PackSeed[] = [
  ['Reisepass', 'DOKUMENTE', 2], ['Personalausweis', 'DOKUMENTE', 2], ['Bahn-Ticket', 'DOKUMENTE', null], ['Hotel-Buchungsbestätigung', 'DOKUMENTE', null],
  ['T-Shirts (3)', 'KLEIDUNG', 0], ['Jeans', 'KLEIDUNG', 0], ['Jacke', 'KLEIDUNG', 0], ['Unterwäsche', 'KLEIDUNG', null], ['Socken', 'KLEIDUNG', 0], ['Regenjacke', 'KLEIDUNG', null],
  ['Ladegerät', 'TECHNIK', null], ['Powerbank', 'TECHNIK', 1], ['Kopfhörer', 'TECHNIK', 1], ['Handy', 'TECHNIK', null], ['Kamera', 'TECHNIK', null],
  ['Zahnbürste', 'HYGIENE', 0], ['Duschgel', 'HYGIENE', 0], ['Medikamente', 'HYGIENE', null], ['Sonnencreme', 'HYGIENE', null],
  ['Trinkflasche', 'UNTERWEGS', 1], ['Snacks', 'UNTERWEGS', 1], ['Reiseapotheke', 'UNTERWEGS', null], ['Regenschirm', 'UNTERWEGS', null], ['Stadtplan / Offline-Karten', 'UNTERWEGS', null],
];

@Injectable()
export class DemoReisenApi {
  private nextId = 1000;
  private tripList: TripBase[] = [
    {
      ...BLANK,
      id: 1,
      title: 'Berlin Wochenende',
      destination: 'Berlin, Deutschland',
      departure: 'Düsseldorf',
      start_date: dateOnly(BERLIN),
      end_date: dateOnly(BERLIN + 2),
      status: 'CONFIRMED',
      travel_type: 'CITY_TRIP',
      transport_type: 'TRAIN',
      baggage_type: 'HAND_LUGGAGE',
      budget_amount: '700.00',
      accommodation: 'Hotel Central',
      accommodation_area: 'Berlin Mitte',
      transport_note: 'Hin- und Rückfahrt gebucht',
    },
    {
      ...BLANK,
      id: 2,
      title: 'Italien Sommerurlaub',
      destination: 'Gardasee, Italien',
      start_date: dateOnly(75),
      end_date: dateOnly(89),
      status: 'PLANNED',
      travel_type: 'BEACH',
      transport_type: 'FLIGHT',
      baggage_type: 'CHECKED_BAGGAGE',
      budget_amount: '2400.00',
      accommodation: 'Ferienwohnung Limone',
      accommodation_area: 'Limone sul Garda',
      created_at: at(-3, '10:00'),
      updated_at: at(-1, '10:00'),
    },
    {
      ...BLANK,
      id: 3,
      title: 'Skifahren Schweiz',
      destination: 'Davos, Schweiz',
      start_date: dateOnly(150),
      end_date: dateOnly(155),
      status: 'PLANNED',
      travel_type: 'WINTER',
      transport_type: 'CAR',
      climate: 'SNOW',
      currency: 'CHF',
      created_at: at(-1, '18:00'),
      updated_at: at(-1, '18:00'),
    },
    {
      ...BLANK,
      id: 4,
      title: 'Lissabon',
      destination: 'Lissabon, Portugal',
      departure: 'DUS',
      start_date: dateOnly(-60),
      end_date: dateOnly(-55),
      status: 'DONE',
      travel_type: 'CITY_TRIP',
      transport_type: 'FLIGHT',
      budget_amount: '900.00',
      created_at: at(-90, '18:00'),
      updated_at: at(-54, '18:00'),
    },
  ];
  private packingList: PackingItem[] = [
    ...BERLIN_PACKING.map(([title, category, ago], index) => ({
      id: index + 1,
      trip: 1,
      title,
      is_packed: ago !== null,
      quantity: 1,
      category,
      note: '',
      packed_at: ago !== null ? at(-ago, '19:00') : null,
    })),
    ...(['Reisepass', 'Badesachen', 'Sonnenbrille', 'Sonnencreme', 'Sandalen', 'Ladegerät', 'Strandtuch', 'Reiseadapter'] as const).map(
      (title, index) => ({
        id: 100 + index,
        trip: 2,
        title,
        is_packed: index < 2,
        quantity: 1,
        category: (['DOKUMENTE', 'KLEIDUNG', 'UNTERWEGS', 'HYGIENE', 'KLEIDUNG', 'TECHNIK', 'UNTERWEGS', 'TECHNIK'] as const)[index],
        note: '',
        packed_at: index < 2 ? at(-1, '20:00') : null,
      }),
    ),
  ];
  // Berlin: 4 offene Aufgaben (wie im Entwurf), eine erledigt; Erinnerungen sind Aufgaben mit Uhrzeit.
  private taskList: TripTask[] = [
    { id: 1, trip: 1, title: 'Online Check-in', due_date: dateOnly(BERLIN - 2), due_time: '18:00', status: 'OPEN', note: '', assignee: 1, assignee_name: 'Anna' },
    { id: 2, trip: 1, title: 'Reisepass prüfen', due_date: dateOnly(BERLIN - 1), due_time: null, status: 'OPEN', note: '', assignee: 1, assignee_name: 'Anna' },
    { id: 3, trip: 1, title: 'Restaurant reservieren', due_date: dateOnly(5), due_time: null, status: 'OPEN', note: '', assignee: 201, assignee_name: 'Tom Schulz' },
    { id: 4, trip: 1, title: 'Museumstickets kaufen', due_date: null, due_time: null, status: 'OPEN', note: '', assignee: null, assignee_name: '' },
    { id: 5, trip: 1, title: 'Hotel buchen', due_date: dateOnly(-8), due_time: null, status: 'DONE', note: '', assignee: 1, assignee_name: 'Anna' },
    { id: 6, trip: 2, title: 'Mietwagen vergleichen', due_date: dateOnly(30), due_time: null, status: 'OPEN', note: '', assignee: null, assignee_name: '' },
    { id: 7, trip: 4, title: 'Flug buchen', due_date: dateOnly(-100), due_time: null, status: 'DONE', note: '', assignee: null, assignee_name: '' },
  ];
  private eventList: TripEvent[] = [
    { id: 1, trip: 1, title: 'Museumsbesuch', starts_at: at(BERLIN + 1, '11:00'), ends_at: at(BERLIN + 1, '13:00'), location: 'Museumsinsel' },
  ];
  private expenseList: TripExpense[] = [
    { id: 1, trip: 1, title: 'Hotelanzahlung', amount: '200.00', date: dateOnly(-6), category: 'UNTERKUNFT' },
    { id: 2, trip: 1, title: 'Bahntickets', amount: '80.00', date: dateOnly(-7), category: 'TRANSPORT' },
    { id: 3, trip: 1, title: 'Restaurant „Lindenhof“ (Reservierung)', amount: '45.00', date: dateOnly(-4), category: 'ESSEN' },
    { id: 4, trip: 1, title: 'Museum – Eintritt', amount: '25.00', date: dateOnly(-3), category: 'AKTIVITAETEN' },
    { id: 5, trip: 1, title: 'Stadtführung', amount: '15.00', date: dateOnly(-3), category: 'AKTIVITAETEN' },
    { id: 6, trip: 1, title: 'Frühstück vorab bezahlt', amount: '15.00', date: dateOnly(-2), category: 'ESSEN' },
    { id: 7, trip: 1, title: 'Kurtaxe', amount: '40.00', date: dateOnly(-2), category: 'UNTERKUNFT' },
    { id: 8, trip: 2, title: 'Flüge (Anzahlung)', amount: '600.00', date: dateOnly(-10), category: 'TRANSPORT' },
    { id: 9, trip: 4, title: 'Flüge', amount: '340.00', date: dateOnly(-100), category: 'TRANSPORT' },
    { id: 10, trip: 4, title: 'Hotel', amount: '420.00', date: dateOnly(-55), category: 'UNTERKUNFT' },
  ];
  private budgetCategoryList: TripBudgetCategory[] = [
    { id: 1, trip: 1, category: 'UNTERKUNFT', planned_amount: '300.00' },
    { id: 2, trip: 1, category: 'TRANSPORT', planned_amount: '120.00' },
    { id: 3, trip: 1, category: 'ESSEN', planned_amount: '150.00' },
    { id: 4, trip: 1, category: 'AKTIVITAETEN', planned_amount: '100.00' },
    { id: 5, trip: 1, category: 'SONSTIGES', planned_amount: '30.00' },
  ];
  private participantList: TripParticipant[] = [
    { id: 1, trip: 1, user: 1, display_name: 'Anna', is_self: true, role: 'OWNER', added_at: at(-5, '09:00') },
    { id: 2, trip: 1, user: 201, display_name: 'Tom Schulz', is_self: false, role: 'EDITOR', added_at: at(-5, '09:05') },
    { id: 3, trip: 2, user: 1, display_name: 'Anna', is_self: true, role: 'OWNER', added_at: at(-3, '10:00') },
    { id: 4, trip: 2, user: 201, display_name: 'Tom Schulz', is_self: false, role: 'EDITOR', added_at: at(-3, '10:00') },
    { id: 5, trip: 2, user: 202, display_name: 'Lena', is_self: false, role: 'VIEWER', added_at: at(-3, '10:00') },
    { id: 6, trip: 2, user: 203, display_name: 'Jonas', is_self: false, role: 'VIEWER', added_at: at(-3, '10:00') },
    { id: 7, trip: 3, user: 1, display_name: 'Anna', is_self: true, role: 'OWNER', added_at: at(-1, '18:00') },
    { id: 8, trip: 3, user: 202, display_name: 'Lena', is_self: false, role: 'EDITOR', added_at: at(-1, '18:00') },
    { id: 9, trip: 4, user: 1, display_name: 'Anna', is_self: true, role: 'OWNER', added_at: at(-90, '18:00') },
  ];
  private withSummary(trip: TripBase): Trip {
    const packing = this.packingList.filter((p) => p.trip === trip.id);
    const tasks = this.taskList.filter((t) => t.trip === trip.id);
    const events = this.eventList.filter((e) => e.trip === trip.id);
    const expenses = this.expenseList.filter((e) => e.trip === trip.id);
    return {
      ...trip,
      packing_total: packing.length,
      packing_packed: packing.filter((p) => p.is_packed).length,
      tasks_open: tasks.filter((t) => t.status === 'OPEN').length,
      tasks_total: tasks.length,
      events_count: events.length,
      budget_spent: expenses.reduce((sum, e) => sum + Number(e.amount), 0).toFixed(2),
      participants: this.participantList.filter((p) => p.trip === trip.id),
      // Die Demo hat keine zweite echte Person: der Betrachter ist immer der Ersteller jeder Demo-Reise.
      my_role: 'OWNER',
    };
  }

  // Kopien statt Live-Referenzen, siehe demo-organisation-api.ts-Docstring: sonst erkennt Angular ein signal.set()
  // derselben (nur in-place veränderten) Array-Referenz fälschlich als unverändert.
  trips(_scope?: 'upcoming' | 'past' | 'cancelled'): Observable<Trip[]> {
    return of(this.tripList.map((t) => this.withSummary(t)));
  }
  saveTrip(data: Partial<Omit<Trip, 'id'>>, id?: number): Observable<Trip> {
    if (id) {
      const index = this.tripList.findIndex((t) => t.id === id);
      if (index === -1) return throwError(() => ({ status: 404 }));
      const updated = { ...this.tripList[index], ...data, updated_at: new Date().toISOString() };
      if (!updated.start_date || !updated.end_date) return throwError(() => ({ status: 400 }));
      this.tripList[index] = updated;
      return of(this.withSummary(this.tripList[index]));
    }
    // Wie das Backend (reisen/serializers.py): ohne beide Daten wird keine Reise gespeichert.
    if (!data.start_date || !data.end_date) return throwError(() => ({ status: 400 }));
    const created: TripBase = {
      ...BLANK,
      id: this.nextId++,
      title: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
      start_date: data.start_date,
      end_date: data.end_date,
    };
    this.tripList.push(created);
    // Wie TripViewSet.perform_create im Backend: eine neue Reise bekommt ihren Ersteller sofort als einzigen
    // Teilnehmer mit Rolle OWNER, ohne vorher eine Gruppe anzulegen.
    this.participantList.push({ id: this.nextId++, trip: created.id, user: 1, display_name: 'Anna', is_self: true, role: 'OWNER', added_at: created.created_at });
    return of(this.withSummary(created));
  }
  removeTrip(id: number): Observable<void> {
    const index = this.tripList.findIndex((t) => t.id === id);
    if (index === -1) return throwError(() => ({ status: 404 }));
    this.tripList.splice(index, 1);
    this.packingList = this.packingList.filter((p) => p.trip !== id);
    this.taskList = this.taskList.filter((t) => t.trip !== id);
    this.eventList = this.eventList.filter((e) => e.trip !== id);
    this.expenseList = this.expenseList.filter((e) => e.trip !== id);
    this.budgetCategoryList = this.budgetCategoryList.filter((b) => b.trip !== id);
    this.participantList = this.participantList.filter((p) => p.trip !== id);
    return of(undefined);
  }
  checkTripOverlaps(startDate: string, endDate: string, excludeId?: number): Observable<Trip[]> {
    if (!startDate || !endDate) return of([]);
    const overlapping = this.tripList.filter(
      (t) => t.id !== excludeId && t.start_date <= endDate && t.end_date >= startDate,
    );
    return of(overlapping.map((t) => this.withSummary(t)));
  }

  packingItems(tripId: number): Observable<PackingItem[]> {
    return of(this.packingList.filter((p) => p.trip === tripId).map((p) => ({ ...p })));
  }
  savePackingItem(data: Partial<Omit<PackingItem, 'id'>>, id?: number): Observable<PackingItem> {
    if (id) {
      const index = this.packingList.findIndex((p) => p.id === id);
      if (index === -1) return throwError(() => ({ status: 404 }));
      const before = this.packingList[index];
      const packed_at = data.is_packed === undefined || data.is_packed === before.is_packed ? before.packed_at : data.is_packed ? new Date().toISOString() : null;
      this.packingList[index] = { ...before, ...data, packed_at };
      return of({ ...this.packingList[index] });
    }
    const created: PackingItem = { id: this.nextId++, trip: 0, title: '', is_packed: false, quantity: 1, category: 'SONSTIGES', note: '', ...data, packed_at: data.is_packed ? new Date().toISOString() : null };
    this.packingList.push(created);
    return of(created);
  }
  removePackingItem(id: number): Observable<void> {
    const index = this.packingList.findIndex((p) => p.id === id);
    if (index === -1) return throwError(() => ({ status: 404 }));
    this.packingList.splice(index, 1);
    return of(undefined);
  }

  tasks(tripId: number): Observable<TripTask[]> {
    return of(this.taskList.filter((t) => t.trip === tripId).map((t) => ({ ...t })));
  }
  saveTask(data: Partial<Omit<TripTask, 'id'>>, id?: number): Observable<TripTask> {
    if (id) {
      const index = this.taskList.findIndex((t) => t.id === id);
      if (index === -1) return throwError(() => ({ status: 404 }));
      this.taskList[index] = { ...this.taskList[index], ...data };
      if (data.due_date === null) this.taskList[index].due_time = null;
      if ('assignee' in data) this.taskList[index].assignee_name = this.nameOf(this.taskList[index].trip, data.assignee ?? null);
      return of({ ...this.taskList[index] });
    }
    const created: TripTask = { id: this.nextId++, trip: 0, title: '', due_date: null, due_time: null, status: 'OPEN', note: '', assignee: null, ...data };
    created.assignee_name = this.nameOf(created.trip, created.assignee ?? null);
    this.taskList.push(created);
    return of(created);
  }
  /** Wie das Backend: zuständig kann nur sein, wer mitreist. */
  private nameOf(tripId: number, user: number | null): string {
    if (user === null) return '';
    return this.participantList.find((p) => p.trip === tripId && p.user === user)?.display_name ?? '';
  }
  removeTask(id: number): Observable<void> {
    const index = this.taskList.findIndex((t) => t.id === id);
    if (index === -1) return throwError(() => ({ status: 404 }));
    this.taskList.splice(index, 1);
    return of(undefined);
  }

  events(tripId: number): Observable<TripEvent[]> {
    return of(this.eventList.filter((e) => e.trip === tripId).map((e) => ({ ...e })));
  }
  saveEvent(data: Partial<Omit<TripEvent, 'id'>>, id?: number): Observable<TripEvent> {
    if (id) {
      const index = this.eventList.findIndex((e) => e.id === id);
      if (index === -1) return throwError(() => ({ status: 404 }));
      this.eventList[index] = { ...this.eventList[index], ...data };
      return of(this.eventList[index]);
    }
    const created: TripEvent = { id: this.nextId++, trip: 0, title: '', starts_at: new Date().toISOString(), ends_at: null, location: '', ...data };
    this.eventList.push(created);
    return of(created);
  }
  removeEvent(id: number): Observable<void> {
    const index = this.eventList.findIndex((e) => e.id === id);
    if (index === -1) return throwError(() => ({ status: 404 }));
    this.eventList.splice(index, 1);
    return of(undefined);
  }

  expenses(tripId: number): Observable<TripExpense[]> {
    return of(this.expenseList.filter((e) => e.trip === tripId).map((e) => ({ ...e })));
  }
  saveExpense(data: Partial<Omit<TripExpense, 'id'>>, id?: number): Observable<TripExpense> {
    if (id) {
      const index = this.expenseList.findIndex((e) => e.id === id);
      if (index === -1) return throwError(() => ({ status: 404 }));
      this.expenseList[index] = { ...this.expenseList[index], ...data };
      return of(this.expenseList[index]);
    }
    const created: TripExpense = { id: this.nextId++, trip: 0, title: '', amount: '0.00', date: dateOnly(0), category: 'SONSTIGES', ...data };
    this.expenseList.push(created);
    return of(created);
  }
  removeExpense(id: number): Observable<void> {
    const index = this.expenseList.findIndex((e) => e.id === id);
    if (index === -1) return throwError(() => ({ status: 404 }));
    this.expenseList.splice(index, 1);
    return of(undefined);
  }

  budgetCategories(tripId: number): Observable<TripBudgetCategory[]> {
    return of(this.budgetCategoryList.filter((b) => b.trip === tripId).map((b) => ({ ...b })));
  }
  saveBudgetCategory(data: Partial<Omit<TripBudgetCategory, 'id'>>, id?: number): Observable<TripBudgetCategory> {
    if (id) {
      const index = this.budgetCategoryList.findIndex((b) => b.id === id);
      if (index === -1) return throwError(() => ({ status: 404 }));
      this.budgetCategoryList[index] = { ...this.budgetCategoryList[index], ...data };
      return of(this.budgetCategoryList[index]);
    }
    // Wie das Backend (UniqueConstraint trip+category): höchstens eine geplante Zeile je Kategorie und Reise.
    if (this.budgetCategoryList.some((b) => b.trip === data.trip && b.category === data.category)) {
      return throwError(() => ({ status: 400 }));
    }
    const created: TripBudgetCategory = { id: this.nextId++, trip: 0, category: 'SONSTIGES', planned_amount: '0.00', ...data };
    this.budgetCategoryList.push(created);
    return of(created);
  }
  removeBudgetCategory(id: number): Observable<void> {
    const index = this.budgetCategoryList.findIndex((b) => b.id === id);
    if (index === -1) return throwError(() => ({ status: 404 }));
    this.budgetCategoryList.splice(index, 1);
    return of(undefined);
  }

  resetPacking(tripId: number): Observable<{ reset: number }> {
    let reset = 0;
    this.packingList = this.packingList.map((p) => {
      if (p.trip !== tripId || !p.is_packed) return p;
      reset++;
      return { ...p, is_packed: false, packed_at: null };
    });
    return of({ reset });
  }
  contacts(): Observable<ContactOption[]> {
    return of(DEMO_CONTACTS.map((c) => ({ ...c })));
  }
  participants(tripId: number): Observable<TripParticipant[]> {
    return of(this.participantList.filter((p) => p.trip === tripId).map((p) => ({ ...p })));
  }
  addParticipant(tripId: number, contactId: number, role: TripParticipant['role']): Observable<TripParticipant> {
    const contact = DEMO_CONTACTS.find((c) => c.id === contactId);
    if (!contact) return throwError(() => ({ status: 400 }));
    // Wie das Backend (UniqueConstraint trip+user): dieselbe Person kann nicht doppelt Teilnehmer werden.
    if (this.participantList.some((p) => p.trip === tripId && p.user === contact.id)) {
      return throwError(() => ({ status: 400 }));
    }
    const created: TripParticipant = {
      id: this.nextId++,
      trip: tripId,
      user: contact.id,
      display_name: contact.name,
      is_self: false,
      role,
      added_at: new Date().toISOString(),
    };
    this.participantList.push(created);
    return of(created);
  }
  updateParticipantRole(id: number, role: TripParticipant['role']): Observable<TripParticipant> {
    const index = this.participantList.findIndex((p) => p.id === id);
    if (index === -1) return throwError(() => ({ status: 404 }));
    this.participantList[index] = { ...this.participantList[index], role };
    return of(this.participantList[index]);
  }
  removeParticipant(id: number): Observable<void> {
    const index = this.participantList.findIndex((p) => p.id === id);
    if (index === -1) return throwError(() => ({ status: 404 }));
    this.participantList.splice(index, 1);
    return of(undefined);
  }
}
