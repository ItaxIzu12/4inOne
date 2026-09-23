import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { RecurringDeductionDto } from '../finanzen/finanzen-api.service';
import { DemoFinanzenDataProvider } from '../finanzen/demo-finanzen-data-provider';
import { FINANZEN_DATA_PROVIDER } from '../finanzen/finanzen-data-provider';
import {
  CompleteShoppingResult,
  DeductionOptionDto,
  FolderEntryDto,
  FolderEntryInput,
  Id,
  ItemSuggestionDto,
  MemberLoadDto,
  SectionKey,
  ShoppingItemDto,
  ShoppingItemPatch,
  ShoppingOverviewDto,
  TaskDto,
  TaskInput,
} from './haushalt-api.service';
import { HaushaltDataProvider } from './haushalt-data-provider';
import { SECTIONS, addDaysIso, addMonthsIso, guessSectionDemo, todayIso } from './haushalt-logic';

// Sicherheitskritisch wie demo-finanzen-data-provider.ts: diese Datei
// importiert KEINEN HttpClient. Einzige Abhängigkeit ist der Demo-
// Finanzen-Provider derselben Routengruppe — über ihn bucht der
// Einkauf-zu-Ausgabe-Moment in der Demo live ins Demo-Budget
// (GESAMTKONZEPT.md §5.4: "muss ein Demo-Besucher … live sehen"). Der
// Konstruktor prüft, dass es wirklich der Demo-Provider ist; eine
// Fehlregistrierung in app.routes.ts fällt dadurch sofort auf, statt
// stillschweigend echte Daten zu schreiben.

const ANNA: MemberLoadDto = { user_id: 'demo-member-anna', name: 'Anna', points: 0, count: 0 };
const DEMO_DEFAULT_PRICE = 3.5;

function item(id: string, name: string, section: SectionKey, quantity = ''): ShoppingItemDto {
  return {
    id,
    name,
    quantity,
    section,
    is_checked: false,
    checked_at: null,
    checked_by_name: null,
    added_by_name: 'Anna',
    created_at: new Date().toISOString(),
  };
}

function task(partial: Partial<TaskDto> & Pick<TaskDto, 'id' | 'title'>): TaskDto {
  return {
    assigned_to: ANNA.user_id,
    assigned_to_name: ANNA.name,
    due_date: null,
    recurrence_days: null,
    effort: 1,
    rotate: false,
    rotation_member_ids: [],
    is_done: false,
    is_overdue: false,
    last_done_at: null,
    last_done_by_name: null,
    ...partial,
  };
}

@Injectable()
export class DemoHaushaltDataProvider implements HaushaltDataProvider {
  private readonly finanzen = inject(FINANZEN_DATA_PROVIDER);

  private nextId = 1;
  private items: ShoppingItemDto[] = [
    item('demo-item-1', 'Bananen', 'obst_gemuese'),
    item('demo-item-2', 'Vollkornbrot', 'backwaren'),
    item('demo-item-3', 'Milch', 'kuehlregal', '2 l'),
    item('demo-item-4', 'Joghurt', 'kuehlregal'),
    item('demo-item-5', 'Nudeln', 'vorrat'),
    item('demo-item-6', 'Spülmittel', 'haushalt'),
  ];
  private memory: ItemSuggestionDto[] = [
    { id: 'demo-mem-1', name: 'Eier', section: 'kuehlregal', use_count: 9 },
    { id: 'demo-mem-2', name: 'Butter', section: 'kuehlregal', use_count: 8 },
    { id: 'demo-mem-3', name: 'Äpfel', section: 'obst_gemuese', use_count: 7 },
    { id: 'demo-mem-4', name: 'Kaffee', section: 'vorrat', use_count: 5 },
    { id: 'demo-mem-5', name: 'Toilettenpapier', section: 'haushalt', use_count: 4 },
    { id: 'demo-mem-6', name: 'Tomaten', section: 'obst_gemuese', use_count: 3 },
  ];
  // Nur Artikelzahl und Buchungs-ID — der Betrag wird wie im Backend
  // (haushalt/services.py price_per_item) jedes Mal aus der Buchung in den
  // Demo-Finanzen gelesen, damit Korrekturen und Löschungen dort zählen.
  private trips: { transactionId: Id; count: number }[] = [];

  private tasks: TaskDto[] = [
    task({ id: 'demo-task-1', title: 'Pflanzen gießen', recurrence_days: 3, due_date: addDaysIso(-1), is_overdue: true }),
    task({ id: 'demo-task-2', title: 'Bad putzen', recurrence_days: 7, effort: 3, due_date: todayIso() }),
    task({ id: 'demo-task-3', title: 'Müll rausbringen', recurrence_days: 7, due_date: addDaysIso(1) }),
    task({ id: 'demo-task-4', title: 'Winterreifen-Termin vereinbaren', effort: 2, due_date: addDaysIso(9) }),
  ];
  private load: MemberLoadDto = { ...ANNA, points: 5, count: 3 };

  // Gespeichert werden nur die Eingaben; Kosten, Kündigungsdatum und Fristen
  // berechnet folderEntry() bei jedem Lesen — die Kosten aus den festen
  // Abzügen der Demo-Finanzen, genau wie im Backend.
  private folder: (FolderEntryInput & { id: Id })[] = [
    {
      id: 'demo-folder-1',
      kind: 'vertrag',
      name: 'Hausratversicherung',
      provider: 'Beispiel-Versicherung',
      notes: '',
      recurring_deduction_id: 'demo-deduction-versicherung',
      contract_end: addMonthsIso(todayIso(), 4),
      notice_period_months: 3,
      purchase_date: null,
      warranty_until: null,
      maintenance_interval_months: null,
      next_maintenance: null,
    },
    {
      id: 'demo-folder-2',
      kind: 'geraet',
      name: 'Heizung',
      provider: 'Gastherme',
      notes: 'Wartungsfirma: Beispiel GmbH',
      recurring_deduction_id: null,
      contract_end: null,
      notice_period_months: null,
      purchase_date: null,
      warranty_until: null,
      maintenance_interval_months: 12,
      next_maintenance: addDaysIso(21),
    },
    {
      id: 'demo-folder-3',
      kind: 'geraet',
      name: 'Waschmaschine',
      provider: '',
      notes: '',
      recurring_deduction_id: null,
      contract_end: null,
      notice_period_months: null,
      purchase_date: addMonthsIso(todayIso(), -14),
      warranty_until: addMonthsIso(todayIso(), 10),
      maintenance_interval_months: null,
      next_maintenance: null,
    },
  ];

  constructor() {
    if (!(this.finanzen instanceof DemoFinanzenDataProvider)) {
      throw new Error('DemoHaushaltDataProvider darf nur zusammen mit DemoFinanzenDataProvider verwendet werden.');
    }
  }

  // ---------- Einkauf ----------

  getShopping(): Observable<ShoppingOverviewDto> {
    const open = new Set(this.items.filter((i) => !i.is_checked).map((i) => i.name.toLowerCase()));
    return this.finanzen.searchTransactions('').pipe(
      map((page) => {
        const amounts = new Map(page.results.map((tx) => [tx.id, Number(tx.amount)]));
        // Gelöschte Buchungen fehlen in der Liste und zählen damit nicht mehr.
        const booked = this.trips.filter((trip) => amounts.has(trip.transactionId)).slice(-10);
        const totalAmount = booked.reduce((sum, trip) => sum + amounts.get(trip.transactionId)!, 0);
        const totalCount = booked.reduce((sum, trip) => sum + trip.count, 0);
        return {
          items: this.items.map((i) => ({ ...i })),
          suggestions: [...this.memory]
            .sort((a, b) => b.use_count - a.use_count)
            .filter((m) => !open.has(m.name.toLowerCase()))
            .slice(0, 12),
          sections: SECTIONS,
          price_per_item: (totalCount ? totalAmount / totalCount : DEMO_DEFAULT_PRICE).toFixed(2),
          price_from_history: totalCount > 0,
          can_book_expense: true,
        };
      }),
    );
  }

  addItem(name: string, quantity: string, section: SectionKey | null): Observable<ShoppingItemDto> {
    const trimmed = name.trim();
    const existing = this.items.find((i) => !i.is_checked && i.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (quantity) existing.quantity = quantity;
      return of({ ...existing });
    }
    const known = this.memory.find((m) => m.name.toLowerCase() === trimmed.toLowerCase());
    const resolved = section ?? known?.section ?? guessSectionDemo(trimmed);
    const created = item(`demo-item-new-${this.nextId++}`, trimmed, resolved, quantity);
    this.items.push(created);
    if (known) known.use_count += 1;
    else this.memory.push({ id: `demo-mem-new-${this.nextId++}`, name: trimmed, section: resolved, use_count: 1 });
    return of({ ...created });
  }

  updateItem(id: Id, patch: ShoppingItemPatch): Observable<ShoppingItemDto> {
    const found = this.items.find((i) => i.id === id);
    if (!found) return throwError(() => new Error('Demo-Eintrag nicht gefunden.'));
    Object.assign(found, patch);
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
    this.items = this.items.filter((i) => i.id !== id);
    return of(undefined);
  }

  completeShopping(amount: number | null): Observable<CompleteShoppingResult> {
    const checked = this.items.filter((i) => i.is_checked);
    if (checked.length === 0) return throwError(() => new Error('Es ist noch nichts abgehakt.'));
    this.items = this.items.filter((i) => !i.is_checked);
    const result = (transactionId: Id | null): CompleteShoppingResult => ({
      item_count: checked.length,
      amount: amount === null ? null : amount.toFixed(2),
      transaction_id: transactionId,
    });
    if (amount === null) return of(result(null));
    return this.finanzen
      .addTransaction({
        amount,
        description: `Einkauf (${checked.length} Artikel)`,
        categoryId: 'demo-haushalt',
        datum: todayIso(),
      })
      .pipe(
        map((transaction) => {
          this.trips.push({ transactionId: transaction.id, count: checked.length });
          return result(transaction.id);
        }),
      );
  }

  // ---------- Aufgaben ----------

  getTasks(): Observable<TaskDto[]> {
    const today = todayIso();
    return of(
      this.tasks
        .filter((t) => !t.is_done)
        .map((t) => ({ ...t, is_overdue: !!t.due_date && t.due_date < today }))
        .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')),
    );
  }

  getTaskLoad(): Observable<MemberLoadDto[]> {
    return of([{ ...this.load }]);
  }

  createTask(input: TaskInput): Observable<TaskDto> {
    const created = task({
      id: `demo-task-new-${this.nextId++}`,
      ...input,
      title: input.title.trim(),
      due_date: input.due_date ?? (input.recurrence_days ? todayIso() : null),
      assigned_to_name: input.assigned_to ? ANNA.name : null,
    });
    this.tasks.push(created);
    return of({ ...created });
  }

  updateTask(id: Id, input: TaskInput): Observable<TaskDto> {
    const found = this.tasks.find((t) => t.id === id);
    if (!found) return throwError(() => new Error('Demo-Aufgabe nicht gefunden.'));
    Object.assign(found, input, { assigned_to_name: input.assigned_to ? ANNA.name : null });
    return of({ ...found });
  }

  deleteTask(id: Id): Observable<void> {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    return of(undefined);
  }

  completeTask(id: Id): Observable<TaskDto> {
    const found = this.tasks.find((t) => t.id === id);
    if (!found) return throwError(() => new Error('Demo-Aufgabe nicht gefunden.'));
    this.load = { ...this.load, points: this.load.points + found.effort, count: this.load.count + 1 };
    found.last_done_at = new Date().toISOString();
    found.last_done_by_name = ANNA.name;
    if (found.recurrence_days) found.due_date = addDaysIso(found.recurrence_days);
    else found.is_done = true;
    found.is_overdue = false;
    return of({ ...found });
  }

  // ---------- Haushaltsordner ----------

  private deductions(): Observable<RecurringDeductionDto[]> {
    return this.finanzen.getAnalysen().pipe(map((analysen) => analysen.recurring_deductions));
  }

  getFolder(): Observable<FolderEntryDto[]> {
    return this.deductions().pipe(
      map((deductions) =>
        this.folder
          .map((entry) => this.folderEntry(entry, deductions))
          .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'de')),
      ),
    );
  }

  getUnlinkedDeductions(): Observable<DeductionOptionDto[]> {
    const linked = new Set(this.folder.map((e) => e.recurring_deduction_id).filter((id) => id !== null));
    return this.deductions().pipe(
      map((deductions) =>
        deductions
          .filter((d) => !linked.has(d.id))
          .map((d) => ({ id: d.id, name: d.name, amount: d.amount, active: d.active })),
      ),
    );
  }

  createFolderEntry(input: FolderEntryInput): Observable<FolderEntryDto> {
    const stored = { ...input, id: `demo-folder-new-${this.nextId++}` };
    this.folder.push(stored);
    return this.deductions().pipe(map((deductions) => this.folderEntry(stored, deductions)));
  }

  updateFolderEntry(id: Id, input: FolderEntryInput): Observable<FolderEntryDto> {
    const index = this.folder.findIndex((e) => e.id === id);
    if (index === -1) return throwError(() => new Error('Demo-Eintrag nicht gefunden.'));
    this.folder[index] = { ...input, id };
    return this.deductions().pipe(map((deductions) => this.folderEntry(this.folder[index], deductions)));
  }

  deleteFolderEntry(id: Id): Observable<void> {
    this.folder = this.folder.filter((e) => e.id !== id);
    return of(undefined);
  }

  completeMaintenance(id: Id): Observable<FolderEntryDto> {
    const found = this.folder.find((e) => e.id === id);
    if (!found) return throwError(() => new Error('Demo-Eintrag nicht gefunden.'));
    found.next_maintenance = found.maintenance_interval_months
      ? addMonthsIso(todayIso(), found.maintenance_interval_months)
      : null;
    return this.deductions().pipe(map((deductions) => this.folderEntry(found, deductions)));
  }

  /** Baut einen Eintrag inklusive der abgeleiteten Felder (Kosten,
   * Kündigungsdatum, Fristen) — dieselben Regeln wie backend
   * haushalt/services.py folder_deadlines() und FolderEntrySerializer:
   * Kosten nur von einem AKTIVEN festen Abzug. */
  private folderEntry(input: FolderEntryInput & { id: Id }, deductions: RecurringDeductionDto[]): FolderEntryDto {
    const isContract = input.kind === 'vertrag';
    const deduction = isContract ? (deductions.find((d) => d.id === input.recurring_deduction_id) ?? null) : null;
    const cancelBy =
      isContract && input.contract_end ? addMonthsIso(input.contract_end, -(input.notice_period_months ?? 0)) : null;
    const nextMaintenance =
      !isContract && input.maintenance_interval_months && !input.next_maintenance
        ? addMonthsIso(input.purchase_date ?? todayIso(), input.maintenance_interval_months)
        : input.next_maintenance;
    const deadlines: FolderEntryDto['deadlines'] = [];
    if (cancelBy) {
      const label = input.notice_period_months ? 'Kündigen bis' : 'Vertrag endet';
      deadlines.push({ art: 'kuendigung', datum: cancelBy, titel: `${label}: ${input.name}` });
    }
    if (!isContract && input.warranty_until) {
      deadlines.push({ art: 'garantie', datum: input.warranty_until, titel: `Garantie endet: ${input.name}` });
    }
    if (!isContract && nextMaintenance) {
      deadlines.push({ art: 'wartung', datum: nextMaintenance, titel: `Wartung: ${input.name}` });
    }
    return {
      ...input,
      name: input.name.trim(),
      // Wurde der feste Abzug in Finanzen gelöscht, fällt auch die
      // Verknüpfung weg (Backend: SET_NULL).
      recurring_deduction_id: deduction ? deduction.id : null,
      monthly_cost: deduction?.active ? deduction.amount : null,
      deduction_active: deduction ? deduction.active : null,
      next_maintenance: isContract ? null : nextMaintenance,
      cancel_by: cancelBy,
      deadlines,
    };
  }
}
