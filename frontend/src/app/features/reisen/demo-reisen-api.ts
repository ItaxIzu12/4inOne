import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { ContactOption, PackingItem, Trip, TripBudgetCategory, TripEvent, TripExpense, TripParticipant, TripTask } from './reisen-api.service';

// Feste Demo-Kontakte, nur für diese Instanz: die Demo hat keinen eigenen Login und keine zweite Person, die
// wirklich existiert, daher ist "meine Rolle" hier immer OWNER (siehe withSummary()) und der Kontaktpicker
// braucht keinen echten Contacts-Endpunkt.
const DEMO_CONTACTS: ContactOption[] = [
  { id: 201, name: 'Max' },
  { id: 202, name: 'Lena' },
];

// Wie demo-organisation-api.ts: keine HTTP-Aufrufe, ersetzt ReisenApi nur für die öffentliche Demo-Route
// (siehe app.routes.ts), gesamter Zustand lebt nur im Speicher dieser einen Instanz.
//
// Die Reise ist relativ zu HEUTE datiert, damit "in X Tagen" auf dem Dashboard und in der Übersicht an jedem
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

@Injectable()
export class DemoReisenApi {
  private nextId = 100;
  private tripList: TripBase[] = [
    {
      id: 1,
      title: 'Berlin Wochenende',
      destination: 'Berlin, Deutschland',
      start_date: dateOnly(12),
      end_date: dateOnly(14),
      notes: '',
      status: 'PLANNED',
      travel_type: 'CITY_TRIP',
      transport_type: 'TRAIN',
      baggage_type: 'HAND_LUGGAGE',
      budget_amount: '350.00',
      currency: 'EUR',
      created_at: at(-5, '09:00'),
      updated_at: at(-5, '09:00'),
    },
  ];
  private packingList: PackingItem[] = [
    { id: 1, trip: 1, title: 'Reisepass', is_packed: true, quantity: 1, category: 'DOKUMENTE', note: '' },
    { id: 2, trip: 1, title: 'Ladekabel', is_packed: false, quantity: 1, category: 'TECHNIK', note: '' },
    { id: 3, trip: 1, title: 'Warme Jacke', is_packed: false, quantity: 1, category: 'KLEIDUNG', note: '' },
  ];
  private taskList: TripTask[] = [
    { id: 1, trip: 1, title: 'Zugtickets buchen', due_date: dateOnly(3), status: 'OPEN', note: '' },
    { id: 2, trip: 1, title: 'Hotel bestätigen', due_date: dateOnly(-1), status: 'DONE', note: '' },
  ];
  private eventList: TripEvent[] = [
    { id: 1, trip: 1, title: 'Anreise', starts_at: at(12, '10:00'), ends_at: at(12, '13:00'), location: 'Hauptbahnhof' },
    { id: 2, trip: 1, title: 'Museumsbesuch', starts_at: at(13, '11:00'), ends_at: at(13, '13:00'), location: 'Museumsinsel' },
  ];
  private expenseList: TripExpense[] = [
    { id: 1, trip: 1, title: 'Hotel (Anzahlung)', amount: '90.00', date: dateOnly(-5) },
  ];
  private budgetCategoryList: TripBudgetCategory[] = [
    { id: 1, trip: 1, category: 'TRANSPORT', planned_amount: '80.00' },
    { id: 2, trip: 1, category: 'UNTERKUNFT', planned_amount: '150.00' },
    { id: 3, trip: 1, category: 'ESSEN', planned_amount: '80.00' },
    { id: 4, trip: 1, category: 'RESERVE', planned_amount: '40.00' },
  ];
  private participantList: TripParticipant[] = [
    { id: 1, trip: 1, user: 1, display_name: 'Anna', is_self: true, role: 'OWNER', added_at: at(-5, '09:00') },
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
  trips(): Observable<Trip[]> {
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
      id: this.nextId++,
      title: '',
      destination: '',
      notes: '',
      status: 'PLANNED',
      travel_type: '',
      transport_type: '',
      baggage_type: '',
      budget_amount: null,
      currency: 'EUR',
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
      this.packingList[index] = { ...this.packingList[index], ...data };
      return of(this.packingList[index]);
    }
    const created: PackingItem = { id: this.nextId++, trip: 0, title: '', is_packed: false, quantity: 1, category: 'SONSTIGES', note: '', ...data };
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
      return of(this.taskList[index]);
    }
    const created: TripTask = { id: this.nextId++, trip: 0, title: '', due_date: null, status: 'OPEN', note: '', ...data };
    this.taskList.push(created);
    return of(created);
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
    const created: TripExpense = { id: this.nextId++, trip: 0, title: '', amount: '0.00', date: dateOnly(0), ...data };
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
