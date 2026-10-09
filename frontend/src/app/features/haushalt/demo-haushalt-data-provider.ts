import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { DemoPrivateFinanceApi } from '../finanzen/demo-private-finance-api';
import { FinanceTransaction, PrivateFinanceApi } from '../finanzen/private-finance-api.service';
import {
  HaushaltOverviewDto,
  CompleteShoppingResult,
  FolderEntryDto,
  FolderEntryInput,
  Id,
  ItemSuggestionDto,
  MemberLoadDto,
  SectionKey,
  ShoppingItemDto,
  ShoppingItemPatch,
  ShoppingListDto,
  ShoppingListInput,
  ShoppingMemberDto,
  ShoppingOverviewDto,
  RoutineStatsDto,
  TaskDto,
  TaskInput,
  TaskWeekStatsDto,
  TaskStatus,
  UpcomingDeadlineDto,
} from './haushalt-api.service';
import { HaushaltDataProvider } from './haushalt-data-provider';
import { SECTIONS, addDaysIso, addMonthsIso, daysUntil, guessSectionDemo, todayIso } from './haushalt-logic';
import { UPCOMING_DAYS, cancellationDeadline, computeContractStatus, isRunning, monthlyEquivalent } from './vertraege-logic';

// Sicherheitskritisch wie demo-private-finance-api.ts: diese Datei
// importiert KEINEN HttpClient. Einzige Abhängigkeit sind die privaten
// Demo-Finanzen derselben Routengruppe — dorthin bucht der Einkauf in der
// Demo, genau wie im Backend in die PRIVATEN Finanzen der Person, die
// eingekauft hat (ADR-001). Der Konstruktor prüft, dass es wirklich die
// Demo-Implementierung ist; eine Fehlregistrierung in app.routes.ts fällt
// dadurch sofort auf, statt stillschweigend echte Daten zu schreiben.

const ANNA: MemberLoadDto = { user_id: 'demo-member-anna', name: 'Anna', points: 0, count: 0 };
const BEN: MemberLoadDto = { user_id: 'demo-member-ben', name: 'Ben', points: 0, count: 0 };
const MEMBERS = [ANNA, BEN];
const memberName = (id: Id | null) => MEMBERS.find((m) => m.user_id === id)?.name ?? null;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const DEMO_DEFAULT_PRICE = 3.5;
// „Lebensmittel“ in demo-private-finance-api.ts CATEGORIES.
const DEMO_GROCERIES_CATEGORY = 2;

const DEFAULT_LIST = 'demo-list-1';

function item(
  id: string,
  name: string,
  section: SectionKey,
  quantity = '',
  extra: Partial<ShoppingItemDto> = {},
): ShoppingItemDto {
  const checked = extra.is_checked ?? false;
  return {
    id,
    shopping_list: DEFAULT_LIST,
    name,
    quantity,
    notes: '',
    section,
    is_checked: checked,
    checked_at: checked ? hoursAgo(1) : null,
    checked_by_name: checked ? 'Anna' : null,
    added_by_name: 'Anna',
    created_at: hoursAgo(30),
    updated_at: hoursAgo(30),
    ...extra,
  };
}

/** Kurzform für die weiteren Demo-Listen. */
function listItems(list: string, rows: [string, SectionKey, string, boolean?][]): ShoppingItemDto[] {
  return rows.map(([name, section, quantity, checked], index) =>
    item(`${list}-item-${index + 1}`, name, section, quantity, { shopping_list: list, is_checked: !!checked }),
  );
}

function task(partial: Partial<TaskDto> & Pick<TaskDto, 'id' | 'title'>): TaskDto {
  return {
    assigned_to: ANNA.user_id,
    assigned_to_name: ANNA.name,
    description: '',
    status: 'open',
    due_date: null,
    due_time: null,
    recurrence: null,
    recurrence_days: null,
    recurrence_months: null,
    effort: 1,
    room: '',
    duration_minutes: null,
    priority: 'mittel',
    rotate: false,
    rotation_member_ids: [],
    is_paused: false,
    streak: null,
    is_done: false,
    is_overdue: false,
    last_done_at: null,
    last_done_by_name: null,
    ...partial,
  };
}

/** Gespeichert werden nur Eingaben; Status, Kündigungstag und Fristen berechnet folderEntry() beim Lesen. */
type StoredEntry = FolderEntryInput & { id: Id; created_at: string; updated_at: string };

const BLANK: Omit<FolderEntryInput, 'kind' | 'name'> = {
  provider: '',
  category: '',
  status: 'ACTIVE',
  notes: '',
  cost: null,
  billing_cycle: 'MONTHLY',
  start_date: null,
  end_date: null,
  notice_period_days: null,
  auto_renewal: false,
  contract_number: '',
  purchase_date: null,
  warranty_end_date: null,
  maintenance_interval_months: null,
  maintenance_due_date: null,
  last_maintenance: null,
  model: '',
  room: '',
};

function contract(id: string, name: string, provider: string, extra: Partial<FolderEntryInput>): StoredEntry {
  return { ...BLANK, id, kind: 'vertrag', name, provider, created_at: hoursAgo(900), updated_at: hoursAgo(48), ...extra };
}

function device(
  id: string,
  name: string,
  provider: string,
  model: string,
  room: FolderEntryInput['room'],
  extra: Partial<FolderEntryInput>,
): StoredEntry {
  return { ...BLANK, id, kind: 'geraet', name, provider, model, room, created_at: hoursAgo(900), updated_at: hoursAgo(72), ...extra };
}

@Injectable()
export class DemoHaushaltDataProvider implements HaushaltDataProvider {
  private readonly finanzen = inject(PrivateFinanceApi);

  private nextId = 1;
  private lists: Omit<ShoppingListDto, 'item_count' | 'checked_count'>[] = [
    { id: DEFAULT_LIST, name: 'Wocheneinkauf', description: 'Unser regelmäßiger Wocheneinkauf für den Haushalt.', icon: 'wagen', archived: false, created_at: '2024-04-12T10:00:00Z', updated_at: hoursAgo(2), created_by_name: 'Anna' },
    { id: 'demo-list-2', name: 'Drogerie', description: 'Pflege und Bad.', icon: 'drogerie', archived: false, created_at: '2024-05-02T10:00:00Z', updated_at: hoursAgo(26), created_by_name: 'Anna' },
    { id: 'demo-list-3', name: 'Baumarkt', description: 'Für das Kinderzimmer.', icon: 'baumarkt', archived: false, created_at: '2024-06-20T10:00:00Z', updated_at: hoursAgo(72), created_by_name: 'Ben' },
    { id: 'demo-list-4', name: 'Getränke', description: '', icon: 'getraenke', archived: false, created_at: '2024-07-01T10:00:00Z', updated_at: hoursAgo(5), created_by_name: 'Ben' },
    { id: 'demo-list-5', name: 'Party / Gäste', description: 'Grillabend am Samstag.', icon: 'party', archived: false, created_at: '2024-08-15T10:00:00Z', updated_at: hoursAgo(48), created_by_name: 'Anna' },
  ];
  private items: ShoppingItemDto[] = [
    item('demo-item-1', 'Bananen', 'obst_gemuese', '1 kg'),
    item('demo-item-2', 'Vollkornbrot', 'backwaren', '1 Stück'),
    item('demo-item-3', 'Milch', 'kuehlregal', '2 l'),
    item('demo-item-4', 'Joghurt', 'kuehlregal', '4 Becher'),
    item('demo-item-5', 'Nudeln', 'vorrat', '500 g'),
    item('demo-item-6', 'Spülmittel', 'haushalt'),
    item('demo-item-7', 'Äpfel', 'obst_gemuese', '1 kg', { is_checked: true, added_by_name: 'Ben', created_at: hoursAgo(20) }),
    item('demo-item-8', 'Tomaten', 'obst_gemuese', '500 g', { is_checked: true, created_at: hoursAgo(2) }),
    item('demo-item-9', 'Paprika (rot)', 'obst_gemuese', '3 Stück', { added_by_name: 'Ben', created_at: hoursAgo(5) }),
    item('demo-item-10', 'Käse (Gouda)', 'kuehlregal', '250 g'),
    item('demo-item-11', 'Brötchen', 'backwaren', '6 Stück', { created_at: hoursAgo(24) }),
    ...listItems('demo-list-2', [
      ['Zahnpasta', 'drogerie', '2 Stück', true], ['Duschgel', 'drogerie', '1 Stück', true], ['Shampoo', 'drogerie', '1 Stück', true],
      ['Deo', 'drogerie', '1 Stück'], ['Wattepads', 'drogerie', '1 Packung'], ['Taschentücher', 'drogerie', '1 Packung'],
      ['Handseife', 'drogerie', '1 Stück'], ['Sonnencreme', 'drogerie', '1 Stück'], ['Pflaster', 'drogerie', '1 Packung'],
    ]),
    ...listItems('demo-list-3', [
      ['Schrauben 4×40', 'sonstiges', '1 Packung', true], ['Dübel 6 mm', 'sonstiges', '20 Stück'], ['Wandfarbe weiß', 'sonstiges', '10 l'],
      ['Abdeckfolie', 'sonstiges', '1 Rolle'], ['Malerkrepp', 'sonstiges', '2 Rollen'], ['Pinselset', 'sonstiges', '1 Stück'],
      ['Glühbirne E27', 'haushalt', '2 Stück'],
    ]),
    ...listItems('demo-list-4', [
      ['Mineralwasser', 'getraenke', '2 Kisten', true], ['Apfelschorle', 'getraenke', '1 Kiste', true], ['Orangensaft', 'getraenke', '2 l', true],
      ['Hafermilch', 'getraenke', '2 l', true], ['Eistee', 'getraenke', '1,5 l', true], ['Kaffee', 'vorrat', '500 g', true],
    ]),
    ...listItems('demo-list-5', [
      ['Grillwürstchen', 'fleisch_fisch', '12 Stück'], ['Grillkäse', 'kuehlregal', '4 Stück'], ['Baguette', 'backwaren', '2 Stück'],
      ['Kartoffelsalat', 'kuehlregal', '1 kg'], ['Chips', 'vorrat', '3 Tüten'], ['Salzstangen', 'vorrat', '2 Tüten'],
      ['Ketchup', 'vorrat', '1 Flasche'], ['Limonade', 'getraenke', '6 Flaschen'], ['Eiswürfel', 'tiefkuehl', '2 Beutel'],
      ['Servietten', 'haushalt', '1 Packung'], ['Pappteller', 'haushalt', '30 Stück'], ['Becher', 'haushalt', '30 Stück'],
    ]),
  ];
  private memory: ItemSuggestionDto[] = [
    { id: 'demo-mem-1', name: 'Eier', section: 'kuehlregal', use_count: 9 },
    { id: 'demo-mem-2', name: 'Butter', section: 'kuehlregal', use_count: 8 },
    { id: 'demo-mem-3', name: 'Äpfel', section: 'obst_gemuese', use_count: 7 },
    { id: 'demo-mem-4', name: 'Kaffee', section: 'vorrat', use_count: 5 },
    { id: 'demo-mem-5', name: 'Toilettenpapier', section: 'haushalt', use_count: 4 },
    { id: 'demo-mem-6', name: 'Tomaten', section: 'obst_gemuese', use_count: 3 },
  ];
  // Wie im Backend (haushalt/services.py price_per_item): die Schätzung nutzt
  // nur den Betrag des Einkaufs selbst, nie die private Buchung — sonst würden
  // private Korrekturen einer Person den ganzen Haushalt beeinflussen.
  private trips: { amount: number; count: number }[] = [];

  private tasks: TaskDto[] = [
    task({ id: 'demo-task-1', title: 'Pflanzen gießen', description: 'Zimmerpflanzen und Balkon', recurrence: 'daily', recurrence_days: 1, due_date: addDaysIso(-1), is_overdue: true, room: 'wohnzimmer', duration_minutes: 10, priority: 'niedrig', streak: 0 }),
    task({ id: 'demo-task-2', title: 'Bad putzen', description: 'Waschbecken, Dusche, WC', recurrence: 'weekly', recurrence_days: 7, effort: 3, due_date: todayIso(), room: 'bad', duration_minutes: 20, streak: 4 }),
    task({ id: 'demo-task-3', title: 'Müll rausbringen', description: 'Restmüll und Papier', recurrence: 'weekly', recurrence_days: 7, due_date: addDaysIso(1), room: 'aussen', duration_minutes: 5, priority: 'hoch', streak: 8 }),
    // Heute statt weit in der Zukunft: sonst wäre die einzige einmalige Demo-Aufgabe erst in 9 Tagen abhakbar
    // (siehe aufgaben-tab.ts notYetDue()) und ein Besuch der Demo könnte sie nie ausprobieren.
    task({ id: 'demo-task-4', title: 'Winterreifen-Termin vereinbaren', effort: 2, due_date: todayIso(), duration_minutes: 15, priority: 'hoch' }),
    task({ id: 'demo-task-5', title: 'Kühlschrank reinigen', effort: 2, due_date: addDaysIso(3), room: 'kueche', duration_minutes: 20, priority: 'niedrig' }),
    task({ id: 'demo-task-6', title: 'Bettwäsche wechseln', description: 'Alle Betten', recurrence: 'weekly', recurrence_days: 7, due_date: addDaysIso(4), room: 'schlafzimmer', duration_minutes: 15, assigned_to: null, assigned_to_name: null, streak: 3 }),
    // Weitere Routinen — erst ab morgen fällig, damit „Heute“ ruhig bleibt.
    task({ id: 'demo-task-7', title: 'Küche sauber halten', description: 'Arbeitsflächen, Spüle, Herd', recurrence: 'daily', recurrence_days: 1, due_date: addDaysIso(1), due_time: '20:00:00', room: 'kueche', duration_minutes: 15, streak: 12, last_done_at: hoursAgo(3), last_done_by_name: 'Anna' }),
    task({ id: 'demo-task-8', title: 'Wäsche waschen', description: 'Bei Bedarf, mind. 1× täglich', recurrence: 'daily', recurrence_days: 1, due_date: addDaysIso(1), due_time: '22:00:00', room: 'waschkueche', duration_minutes: 10, assigned_to: BEN.user_id, assigned_to_name: BEN.name, streak: 5, last_done_at: hoursAgo(2), last_done_by_name: 'Ben' }),
    task({ id: 'demo-task-9', title: 'Staubsaugen', description: 'Alle Wohnräume', recurrence: 'weekly', recurrence_days: 7, effort: 2, due_date: addDaysIso(2), room: 'alle', duration_minutes: 30, assigned_to: BEN.user_id, assigned_to_name: BEN.name, streak: 6 }),
    task({ id: 'demo-task-10', title: 'Rauchmelder prüfen', description: 'Testknopf drücken', recurrence: 'monthly', recurrence_months: 1, due_date: addDaysIso(25), room: 'flur', duration_minutes: 5, assigned_to: BEN.user_id, assigned_to_name: BEN.name, streak: 3 }),
    task({ id: 'demo-task-11', title: 'Fenster putzen', description: 'Innen und außen', recurrence: 'monthly', recurrence_months: 1, due_date: addDaysIso(12), room: 'alle', duration_minutes: 60, effort: 3, is_paused: true, streak: 0 }),
    task({ id: 'demo-task-12', title: 'Rasen mähen', description: 'Garten vorne und hinten', recurrence: 'weekly', recurrence_days: 7, due_date: addDaysIso(5), room: 'aussen', duration_minutes: 45, effort: 2, assigned_to: BEN.user_id, assigned_to_name: BEN.name, is_paused: true, streak: 0 }),
  ];
  private load: MemberLoadDto[] = [{ ...ANNA, points: 5, count: 3 }, { ...BEN, points: 4, count: 3 }];

  private folder: StoredEntry[] = [
    contract('demo-folder-1', 'Hausratversicherung', 'Beispiel-Versicherung', {
      category: 'Versicherung', cost: '65.00', billing_cycle: 'MONTHLY', start_date: addMonthsIso(todayIso(), -20),
      end_date: addMonthsIso(todayIso(), 5), notice_period_days: 90, auto_renewal: true, contract_number: 'HR-2024-118',
    }),
    contract('demo-folder-9', 'Strom', 'Stadtwerke Beispielstadt', {
      category: 'Energie', cost: '84.00', start_date: addMonthsIso(todayIso(), -10), end_date: addDaysIso(48),
      notice_period_days: 30, auto_renewal: true, contract_number: '4711-0815', notes: 'Zählerstand jährlich melden',
    }),
    contract('demo-folder-10', 'Internet & Telefon', 'Beispiel-Telekom', {
      category: 'Internet', cost: '39.99', end_date: addMonthsIso(todayIso(), 9), notice_period_days: 90, auto_renewal: true,
    }),
    contract('demo-folder-11', 'Handyvertrag Anna', 'Beispiel-Mobil', {
      category: 'Mobilfunk', cost: '17.99', end_date: addMonthsIso(todayIso(), 14), notice_period_days: 30,
    }),
    contract('demo-folder-12', 'Streaming', 'Beispiel-Stream', { category: 'Abo', cost: '13.99' }),
    contract('demo-folder-13', 'Haftpflichtversicherung', 'Beispiel-Versicherung', {
      category: 'Versicherung', cost: '78.00', billing_cycle: 'YEARLY', end_date: addMonthsIso(todayIso(), 7),
      notice_period_days: 90, auto_renewal: true,
    }),
    device('demo-folder-2', 'Heizung', 'Vaillant', 'ecoTEC plus', 'flur', {
      category: 'Heizung', notes: 'Wartungsfirma: Beispiel GmbH', purchase_date: addMonthsIso(todayIso(), -50),
      maintenance_interval_months: 12, maintenance_due_date: addDaysIso(21), last_maintenance: addDaysIso(21 - 365),
    }),
    device('demo-folder-3', 'Waschmaschine', 'Bosch', 'Serie 6 (WGG244Z0CH)', 'bad', {
      category: 'Haushaltsgerät', purchase_date: addMonthsIso(todayIso(), -14), warranty_end_date: addMonthsIso(todayIso(), 10),
      maintenance_interval_months: 12, maintenance_due_date: addMonthsIso(todayIso(), 5), last_maintenance: addMonthsIso(todayIso(), -7),
    }),
    device('demo-folder-4', 'Kühlschrank', 'Samsung', 'RB7300', 'kueche', {
      category: 'Küche', purchase_date: addMonthsIso(todayIso(), -8), warranty_end_date: addMonthsIso(todayIso(), 16),
      maintenance_interval_months: 12, maintenance_due_date: addMonthsIso(todayIso(), 6),
    }),
    device('demo-folder-5', 'Geschirrspüler', 'Siemens', 'iQ300', 'kueche', {
      category: 'Küche', status: 'REPAIR', notes: 'Pumpe defekt – Techniker kommt.', purchase_date: addMonthsIso(todayIso(), -30),
      maintenance_interval_months: 6, maintenance_due_date: addDaysIso(12), last_maintenance: addDaysIso(12 - 182),
    }),
    device('demo-folder-6', 'Staubsauger', 'Dyson', 'V15 Detect', 'flur', {
      category: 'Reinigung', purchase_date: addMonthsIso(todayIso(), -11), warranty_end_date: addMonthsIso(todayIso(), 13),
      maintenance_interval_months: 6, maintenance_due_date: addMonthsIso(todayIso(), 4), last_maintenance: addMonthsIso(todayIso(), -2),
    }),
    device('demo-folder-7', 'Backofen', 'AEG', 'Serie 6000', 'kueche', {
      category: 'Küche', purchase_date: addMonthsIso(todayIso(), -10), warranty_end_date: addMonthsIso(todayIso(), 14),
    }),
    device('demo-folder-8', 'Kaffeemaschine', "De'Longhi", 'Magnifica S', 'kueche', {
      category: 'Küche', purchase_date: addMonthsIso(todayIso(), -22), warranty_end_date: addDaysIso(55),
      maintenance_interval_months: 3, maintenance_due_date: addDaysIso(48), last_maintenance: addDaysIso(48 - 91),
    }),
    device('demo-folder-14', 'Alter Trockner', 'Miele', 'T1', 'waschkueche', {
      category: 'Haushaltsgerät', status: 'RETIRED', purchase_date: '2014-03-01', warranty_end_date: '2016-03-01',
    }),
  ];

  constructor() {
    if (!(this.finanzen instanceof DemoPrivateFinanceApi)) {
      throw new Error('DemoHaushaltDataProvider darf nur zusammen mit DemoPrivateFinanceApi verwendet werden.');
    }
  }

  // ---------- Einkauf ----------

  private listDto(list: (typeof this.lists)[number]): ShoppingListDto {
    const items = this.items.filter((i) => i.shopping_list === list.id);
    return { ...list, item_count: items.length, checked_count: items.filter((i) => i.is_checked).length };
  }

  private touch(listId: Id): void {
    const list = this.lists.find((l) => l.id === listId);
    if (list) list.updated_at = new Date().toISOString();
  }

  getShoppingLists(archived = false): Observable<ShoppingListDto[]> {
    return of(this.lists.filter((l) => l.archived === archived).map((l) => this.listDto(l)));
  }

  /** Standardliste: die älteste nicht archivierte (wie backend services.active_shopping_list). */
  private defaultList(): (typeof this.lists)[number] {
    return this.lists.find((l) => !l.archived) ?? this.lists[0];
  }

  createShoppingList(input: ShoppingListInput): Observable<ShoppingListDto> {
    const now = new Date().toISOString();
    const created = { archived: false, ...input, name: input.name.trim(), id: `demo-list-new-${this.nextId++}`, created_at: now, updated_at: now, created_by_name: 'Anna' };
    this.lists.push(created);
    return of(this.listDto(created));
  }

  updateShoppingList(id: Id, input: Partial<ShoppingListInput>): Observable<ShoppingListDto> {
    const found = this.lists.find((l) => l.id === id);
    if (!found) return throwError(() => new Error('Demo-Liste nicht gefunden.'));
    if (input.archived && !found.archived && this.lists.filter((l) => !l.archived).length <= 1) {
      return throwError(() => new Error('Die letzte aktive Einkaufsliste kann nicht archiviert werden.'));
    }
    Object.assign(found, input, { updated_at: new Date().toISOString() });
    return of(this.listDto(found));
  }

  deleteShoppingList(id: Id): Observable<void> {
    if (this.lists.length <= 1) return throwError(() => new Error('Die letzte Einkaufsliste kann nicht gelöscht werden.'));
    this.lists = this.lists.filter((l) => l.id !== id);
    this.items = this.items.filter((i) => i.shopping_list !== id);
    return of(undefined);
  }

  getShopping(listId: Id | null = null): Observable<ShoppingOverviewDto> {
    const list = listId === null ? this.defaultList() : this.lists.find((l) => l.id === listId);
    if (!list) return throwError(() => new Error('Demo-Liste nicht gefunden.'));
    const items = this.items.filter((i) => i.shopping_list === list.id);
    const open = new Set(items.filter((i) => !i.is_checked).map((i) => i.name.toLowerCase()));
    const booked = this.trips.slice(-10);
    const totalAmount = booked.reduce((sum, trip) => sum + trip.amount, 0);
    const totalCount = booked.reduce((sum, trip) => sum + trip.count, 0);
    const owner = list.created_by_name ?? 'Anna';
    const members: ShoppingMemberDto[] = MEMBERS.map((m) => ({ user_id: m.user_id, name: m.name, is_owner: m.name === owner }));
    return of({
      list: this.listDto(list),
      members,
      items: items.map((i) => ({ ...i })),
      suggestions: [...this.memory]
        .sort((a, b) => b.use_count - a.use_count)
        .filter((m) => !open.has(m.name.toLowerCase()))
        .slice(0, 12),
      sections: SECTIONS,
      price_per_item: (totalCount ? totalAmount / totalCount : DEMO_DEFAULT_PRICE).toFixed(2),
      price_from_history: totalCount > 0,
      can_book_expense: true,
    });
  }

  addItem(name: string, quantity: string, section: SectionKey | null, listId: Id | null = null, notes = ''): Observable<ShoppingItemDto> {
    const trimmed = name.trim();
    const list = listId ?? this.defaultList().id;
    this.touch(list);
    const existing = this.items.find(
      (i) => i.shopping_list === list && !i.is_checked && i.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      if (quantity) existing.quantity = quantity;
      return of({ ...existing });
    }
    const known = this.memory.find((m) => m.name.toLowerCase() === trimmed.toLowerCase());
    const resolved = section ?? known?.section ?? guessSectionDemo(trimmed);
    const created = item(`demo-item-new-${this.nextId++}`, trimmed, resolved, quantity, {
      shopping_list: list,
      notes: notes.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    this.items.push(created);
    if (known) known.use_count += 1;
    else this.memory.push({ id: `demo-mem-new-${this.nextId++}`, name: trimmed, section: resolved, use_count: 1 });
    return of({ ...created });
  }

  updateItem(id: Id, patch: ShoppingItemPatch): Observable<ShoppingItemDto> {
    const found = this.items.find((i) => i.id === id);
    if (!found) return throwError(() => new Error('Demo-Eintrag nicht gefunden.'));
    Object.assign(found, patch, { updated_at: new Date().toISOString() });
    this.touch(found.shopping_list);
    if (patch.is_checked !== undefined) {
      found.checked_at = patch.is_checked ? new Date().toISOString() : null;
      found.checked_by_name = patch.is_checked ? 'Anna' : null;
    }
    if (patch.section) {
      const known = this.memory.find((m) => m.name.toLowerCase() === found.name.toLowerCase());
      if (known) known.section = patch.section;
    }
    return of({ ...found });
  }

  deleteItem(id: Id): Observable<void> {
    const found = this.items.find((i) => i.id === id);
    if (found) this.touch(found.shopping_list);
    this.items = this.items.filter((i) => i.id !== id);
    return of(undefined);
  }

  completeShopping(amount: number | null, listId: Id | null = null): Observable<CompleteShoppingResult> {
    const list = listId ?? this.defaultList().id;
    const checked = this.items.filter((i) => i.shopping_list === list && i.is_checked);
    if (checked.length === 0) return throwError(() => new Error('Es ist noch nichts abgehakt.'));
    this.items = this.items.filter((i) => !checked.includes(i));
    this.touch(list);
    const result = (transactionId: Id | null): CompleteShoppingResult => ({
      item_count: checked.length,
      amount: amount === null ? null : amount.toFixed(2),
      transaction_id: transactionId,
    });
    if (amount === null) return of(result(null));
    this.trips.push({ amount, count: checked.length });
    // Kategorie „Lebensmittel“ der privaten Demo-Finanzen — wie
    // finanzen/services.py book_shopping_expense im Backend.
    return this.finanzen
      .save('transactions', {
        amount: amount.toFixed(2),
        type: 'EXPENSE',
        category: DEMO_GROCERIES_CATEGORY,
        date: todayIso(),
        note: `Einkauf (${checked.length} Artikel)`,
        currency: 'EUR',
      })
      .pipe(map((transaction) => result((transaction as FinanceTransaction).id)));
  }

  // ---------- Aufgaben ----------

  getOverview(): Observable<HaushaltOverviewDto> {
    const today = todayIso();
    const open = this.tasks.filter((t) => !t.is_done && !t.is_paused);
    const byDate = (a: TaskDto, b: TaskDto) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999');
    const entries = this.folder.map((e) => this.folderEntry(e));
    const devices = entries.filter((e) => e.kind === 'geraet' && e.status !== 'RETIRED');
    const contracts = entries.filter((e) => e.kind === 'vertrag' && isRunning(e));
    const activeLists = this.lists.filter((l) => !l.archived);
    const openItems = this.items
      .filter((i) => !i.is_checked && activeLists.some((l) => l.id === i.shopping_list))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const deadlines = this.upcomingDeadlines(entries);
    const sortedContracts = [...contracts].sort(
      (a, b) =>
        (a.cancellation_deadline ?? '9999').localeCompare(b.cancellation_deadline ?? '9999') || a.name.localeCompare(b.name, 'de'),
    );
    return of({
      summary: {
        open_tasks: open.length,
        due_today: open.filter((t) => t.due_date === today).length,
        overdue_tasks: open.filter((t) => !!t.due_date && t.due_date < today).length,
        recurring_tasks: this.tasks.filter((t) => !!(t.recurrence_days || t.recurrence_months)).length,
        done_this_week: this.doneThisWeek,
        open_shopping_items: openItems.length,
        active_lists: activeLists.length,
        devices: devices.length,
        devices_in_repair: devices.filter((d) => d.status === 'REPAIR').length,
        contracts: contracts.length,
        contracts_expiring: contracts.filter((c) => c.effective_status === 'EXPIRING').length,
        upcoming: deadlines.length,
      },
      open_tasks: open.length,
      overdue_tasks: open.filter((t) => !!t.due_date && t.due_date < today).length,
      today: open
        .filter((t) => !!t.due_date && t.due_date <= today)
        .sort(byDate)
        .slice(0, 5)
        .map((t) => ({ ...t, is_overdue: t.due_date! < today })),
      upcoming: open
        .filter((t) => !t.due_date || t.due_date > today)
        .sort(byDate)
        .slice(0, 5)
        .map((t) => ({ ...t })),
      deadlines: deadlines.slice(0, 8),
      shopping: { open_items: openItems.length, preview: openItems.slice(0, 4).map((i) => i.name), list_id: this.defaultList().id },
      open_shopping_items: openItems.length,
      devices: devices.length,
      device_list: devices.slice(0, 5).map((e) => ({
        id: e.id,
        name: e.name,
        provider: e.provider,
        status: e.status as 'ACTIVE' | 'REPAIR',
        maintenance_due_date: e.maintenance_due_date,
        warranty_end_date: e.warranty_end_date,
      })),
      contracts: contracts.length,
      contracts_monthly: contracts.reduce((sum, e) => sum + Number(e.monthly_equivalent ?? 0), 0).toFixed(2),
      contract_list: sortedContracts.slice(0, 5).map((e) => ({
        id: e.id,
        name: e.name,
        provider: e.provider,
        cost: e.cost,
        billing_cycle: e.billing_cycle,
        cancellation_deadline: e.cancellation_deadline,
        effective_status: e.effective_status as 'ACTIVE' | 'EXPIRING',
      })),
    });
  }

  /** „Demnächst“ wie backend services.upcoming_deadlines: heute bis in 30 Tagen. */
  private upcomingDeadlines(entries: FolderEntryDto[]): UpcomingDeadlineDto[] {
    const rows: UpcomingDeadlineDto[] = [];
    for (const entry of entries) {
      for (const deadline of entry.deadlines) {
        const days = daysUntil(deadline.datum);
        if (days >= 0 && days <= UPCOMING_DAYS) {
          rows.push({ entry_id: entry.id, kind: entry.kind, art: deadline.art, title: deadline.titel, name: entry.name, date: deadline.datum, days });
        }
      }
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'de'));
  }

  getTasks(status: TaskStatus = 'open'): Observable<TaskDto[]> {
    const today = todayIso();
    return of(
      this.tasks
        .filter((t) => (status === 'done' ? t.is_done : !t.is_done))
        .map((t) => ({ ...t, is_overdue: !!t.due_date && t.due_date < today }))
        .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')),
    );
  }

  getTaskLoad(): Observable<MemberLoadDto[]> {
    return of(this.load.map((m) => ({ ...m })));
  }

  getRoutineStats(): Observable<RoutineStatsDto> {
    // Beispielwerte im Stil von backend haushalt/services.py routine_stats.
    return of({ completion_rate: 92, done: 46, expected: 50 });
  }

  setTaskPaused(id: Id, paused: boolean): Observable<TaskDto> {
    const found = this.tasks.find((t) => t.id === id);
    if (!found) return throwError(() => new Error('Demo-Aufgabe nicht gefunden.'));
    if (!found.recurrence_days && !found.recurrence_months) {
      return throwError(() => new Error('Pausieren geht nur bei wiederkehrenden Aufgaben.'));
    }
    found.is_paused = paused;
    // Wie im Backend: wer nach einer Pause fortsetzt, startet ab heute.
    if (!paused && found.due_date && found.due_date < todayIso()) found.due_date = todayIso();
    return of({ ...found, is_overdue: !!found.due_date && found.due_date < todayIso() });
  }

  // Beispielwerte wie im Backend (haushalt/services.py week_stats): Erledigungen dieser und der Vorwoche.
  private doneThisWeek = 5;

  getTaskWeek(): Observable<TaskWeekStatsDto> {
    const open = this.tasks.filter((t) => !t.is_done && !t.is_paused);
    return of({
      done_this_week: this.doneThisWeek,
      done_last_week: 3,
      open_total: open.length,
      assigned_to_me: open.filter((t) => t.assigned_to === ANNA.user_id).length,
    });
  }

  /** Wie backend TaskSerializer.validate: einfache Auswahl oder „alle X Tage“. */
  private recurrenceFields(input: TaskInput): Pick<TaskDto, 'recurrence' | 'recurrence_days' | 'recurrence_months'> {
    if (input.recurrence === undefined && input.recurrence_days) {
      const days = input.recurrence_days;
      return { recurrence: days === 1 ? 'daily' : days === 7 ? 'weekly' : null, recurrence_days: days, recurrence_months: null };
    }
    const recurrence = input.recurrence ?? null;
    return {
      recurrence,
      recurrence_days: recurrence === 'daily' ? 1 : recurrence === 'weekly' ? 7 : null,
      recurrence_months: recurrence === 'monthly' ? 1 : recurrence === 'yearly' ? 12 : null,
    };
  }

  createTask(input: TaskInput): Observable<TaskDto> {
    const created = task({
      id: `demo-task-new-${this.nextId++}`,
      ...input,
      ...this.recurrenceFields(input),
      title: input.title.trim(),
      due_date: input.due_date ?? (input.recurrence || input.recurrence_days ? todayIso() : null),
      assigned_to_name: memberName(input.assigned_to),
      streak: input.recurrence || input.recurrence_days ? 0 : null,
    });
    this.tasks.push(created);
    return of({ ...created });
  }

  updateTask(id: Id, input: TaskInput): Observable<TaskDto> {
    const found = this.tasks.find((t) => t.id === id);
    if (!found) return throwError(() => new Error('Demo-Aufgabe nicht gefunden.'));
    const fields = this.recurrenceFields(input);
    Object.assign(found, input, fields, {
      assigned_to_name: memberName(input.assigned_to),
      streak: fields.recurrence_days || fields.recurrence_months ? (found.streak ?? 0) : null,
    });
    return of({ ...found });
  }

  deleteTask(id: Id): Observable<void> {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    return of(undefined);
  }

  completeTask(id: Id): Observable<TaskDto> {
    const found = this.tasks.find((t) => t.id === id);
    if (!found) return throwError(() => new Error('Demo-Aufgabe nicht gefunden.'));
    if (found.is_paused) return throwError(() => new Error('Diese Routine ist pausiert.'));
    this.load = this.load.map((m) =>
      m.user_id === ANNA.user_id ? { ...m, points: m.points + found.effort, count: m.count + 1 } : m,
    );
    this.doneThisWeek += 1;
    // Demo: die Serie wächst, wenn der laufende Zeitraum noch nicht erledigt war.
    if (found.streak !== null && !(found.last_done_at && found.last_done_at.slice(0, 10) === todayIso())) found.streak += 1;
    found.last_done_at = new Date().toISOString();
    found.last_done_by_name = ANNA.name;
    if (found.recurrence_days || found.recurrence_months) found.due_date = nextDueDate(found);
    else {
      found.is_done = true;
      found.status = 'done';
    }
    found.is_overdue = false;
    return of({ ...found });
  }

  reopenTask(id: Id): Observable<TaskDto> {
    const found = this.tasks.find((t) => t.id === id);
    if (!found) return throwError(() => new Error('Demo-Aufgabe nicht gefunden.'));
    found.is_done = false;
    found.status = 'open';
    found.last_done_at = null;
    found.last_done_by_name = null;
    return of({ ...found });
  }

  // ---------- Haushaltsordner ----------

  getFolder(): Observable<FolderEntryDto[]> {
    return of(
      this.folder
        .map((entry) => this.folderEntry(entry, false))
        .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'de')),
    );
  }

  getFolderEntry(id: Id): Observable<FolderEntryDto> {
    const found = this.folder.find((e) => e.id === id);
    return found ? of(this.folderEntry(found)) : throwError(() => new Error('Demo-Eintrag nicht gefunden.'));
  }

  updateFolderStatus(id: Id, status: FolderEntryDto['status']): Observable<FolderEntryDto> {
    const found = this.folder.find((e) => e.id === id);
    if (!found) return throwError(() => new Error('Demo-Eintrag nicht gefunden.'));
    found.status = status;
    found.updated_at = new Date().toISOString();
    return of(this.folderEntry(found));
  }

  createFolderEntry(input: FolderEntryInput): Observable<FolderEntryDto> {
    const now = new Date().toISOString();
    const stored: StoredEntry = { ...input, id: `demo-folder-new-${this.nextId++}`, created_at: now, updated_at: now };
    this.folder.push(stored);
    return of(this.folderEntry(stored));
  }

  updateFolderEntry(id: Id, input: FolderEntryInput): Observable<FolderEntryDto> {
    const index = this.folder.findIndex((e) => e.id === id);
    if (index === -1) return throwError(() => new Error('Demo-Eintrag nicht gefunden.'));
    this.folder[index] = { ...this.folder[index], ...input, id, updated_at: new Date().toISOString() };
    return of(this.folderEntry(this.folder[index]));
  }

  deleteFolderEntry(id: Id): Observable<void> {
    this.folder = this.folder.filter((e) => e.id !== id);
    return of(undefined);
  }

  completeMaintenance(id: Id): Observable<FolderEntryDto> {
    const found = this.folder.find((e) => e.id === id);
    if (!found) return throwError(() => new Error('Demo-Eintrag nicht gefunden.'));
    found.maintenance_due_date = found.maintenance_interval_months
      ? addMonthsIso(todayIso(), found.maintenance_interval_months)
      : null;
    found.last_maintenance = todayIso();
    return of(this.folderEntry(found));
  }

  /** Eintrag mit abgeleiteten Feldern (Status, Kündigungstag, Monatsanteil, Fristen) — dieselben Regeln wie
   * backend haushalt/services.py und FolderEntrySerializer. Die Vertragsnummer nur in der Detailansicht. */
  private folderEntry(input: StoredEntry, detail = true): FolderEntryDto {
    const isContract = input.kind === 'vertrag';
    const deadline = isContract ? cancellationDeadline(input.end_date, input.notice_period_days) : null;
    const effective = isContract ? computeContractStatus(input) : input.status;
    const maintenance =
      !isContract && input.maintenance_interval_months && !input.maintenance_due_date
        ? addMonthsIso(input.purchase_date ?? todayIso(), input.maintenance_interval_months)
        : input.maintenance_due_date;
    const deadlines: FolderEntryDto['deadlines'] = [];
    if (isContract && deadline && effective !== 'CANCELLED' && effective !== 'ENDED') {
      const label = input.notice_period_days ? 'Kündigen bis' : 'Vertrag endet';
      deadlines.push({ art: 'kuendigung', datum: deadline, titel: `${label}: ${input.name}` });
    }
    if (!isContract && input.status !== 'RETIRED') {
      if (input.warranty_end_date) deadlines.push({ art: 'garantie', datum: input.warranty_end_date, titel: `Garantie endet: ${input.name}` });
      if (maintenance) deadlines.push({ art: 'wartung', datum: maintenance, titel: `Wartung: ${input.name}` });
    }
    const entry: FolderEntryDto = {
      ...input,
      name: input.name.trim(),
      effective_status: effective,
      monthly_equivalent: isContract ? (monthlyEquivalent(input.cost, input.billing_cycle)?.toFixed(2) ?? null) : null,
      cancellation_deadline: deadline,
      model: isContract ? '' : input.model,
      room: isContract ? '' : input.room,
      cost: isContract ? input.cost : null,
      maintenance_due_date: isContract ? null : maintenance,
      deadlines,
    };
    if (!isContract || !detail) delete entry.contract_number;
    return entry;
  }
}

/** Nächster Termin vom bisherigen Fälligkeitsdatum aus (wie backend services.next_due_date): Di 06.10 → Di 13.10. */
function nextDueDate(task: TaskDto): string {
  const today = todayIso();
  const base = task.due_date ?? today;
  for (let step = 1; ; step++) {
    const day = task.recurrence_days
      ? shiftDays(base, task.recurrence_days * step)
      : addMonthsIso(base, (task.recurrence_months ?? 1) * step);
    if (day > today) return day;
  }
}

function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
