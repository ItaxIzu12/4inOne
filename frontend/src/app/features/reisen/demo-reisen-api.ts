import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { PackingItem, Trip, TripEvent, TripExpense, TripTask } from './reisen-api.service';

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
  'packing_total' | 'packing_packed' | 'tasks_open' | 'tasks_total' | 'events_count' | 'budget_spent'
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
      budget_amount: '350.00',
      created_at: at(-5, '09:00'),
      updated_at: at(-5, '09:00'),
    },
  ];
  private packingList: PackingItem[] = [
    { id: 1, trip: 1, title: 'Reisepass', is_packed: true, quantity: 1 },
    { id: 2, trip: 1, title: 'Ladekabel', is_packed: false, quantity: 1 },
    { id: 3, trip: 1, title: 'Warme Jacke', is_packed: false, quantity: 1 },
  ];
  private taskList: TripTask[] = [
    { id: 1, trip: 1, title: 'Zugtickets buchen', due_date: dateOnly(3), status: 'OPEN' },
    { id: 2, trip: 1, title: 'Hotel bestätigen', due_date: dateOnly(-1), status: 'DONE' },
  ];
  private eventList: TripEvent[] = [
    { id: 1, trip: 1, title: 'Anreise', starts_at: at(12, '10:00'), ends_at: at(12, '13:00'), location: 'Hauptbahnhof' },
    { id: 2, trip: 1, title: 'Museumsbesuch', starts_at: at(13, '11:00'), ends_at: at(13, '13:00'), location: 'Museumsinsel' },
  ];
  private expenseList: TripExpense[] = [
    { id: 1, trip: 1, title: 'Hotel (Anzahlung)', amount: '90.00', date: dateOnly(-5) },
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
      this.tripList[index] = { ...this.tripList[index], ...data, updated_at: new Date().toISOString() };
      return of(this.withSummary(this.tripList[index]));
    }
    const created: TripBase = {
      id: this.nextId++,
      title: '',
      destination: '',
      start_date: null,
      end_date: null,
      notes: '',
      status: 'PLANNED',
      budget_amount: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    };
    this.tripList.push(created);
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
    return of(undefined);
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
    const created: PackingItem = { id: this.nextId++, trip: 0, title: '', is_packed: false, quantity: 1, ...data };
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
    const created: TripTask = { id: this.nextId++, trip: 0, title: '', due_date: null, status: 'OPEN', ...data };
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
}
