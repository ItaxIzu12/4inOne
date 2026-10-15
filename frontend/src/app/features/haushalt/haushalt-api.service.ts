import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_BASE_URL } from '../../core/api.config';

// id ist number | string wie in finanzen-api.service.ts: die echte API
// liefert Zahlen, der Demo-Provider string-Präfixe ("demo-…"), damit eine
// Demo-ID nie mit einer echten kollidiert.
export type Id = number | string;

export type SectionKey =
  | 'obst_gemuese'
  | 'backwaren'
  | 'kuehlregal'
  | 'fleisch_fisch'
  | 'tiefkuehl'
  | 'vorrat'
  | 'getraenke'
  | 'drogerie'
  | 'haushalt'
  | 'kleidung'
  | 'sonstiges';

export interface SectionDto {
  key: SectionKey;
  label: string;
}

/** Symbol einer Einkaufsliste — backend haushalt/models.py ShoppingList.Icon. */
export type ShoppingListIcon = 'wagen' | 'drogerie' | 'baumarkt' | 'getraenke' | 'party';

export interface ShoppingListDto {
  id: Id;
  name: string;
  description: string;
  icon: ShoppingListIcon;
  /** Archivierte Listen sind ausgeblendet und nie Standardliste. */
  archived: boolean;
  item_count: number;
  checked_count: number;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
}

export interface ShoppingListInput {
  name: string;
  description: string;
  icon: ShoppingListIcon;
  archived?: boolean;
}

/** Wer die Liste sieht und bearbeitet: alle im Haushalt; is_owner = hat sie angelegt. */
export interface ShoppingMemberDto {
  user_id: Id;
  name: string;
  is_owner: boolean;
}

export interface ShoppingItemDto {
  id: Id;
  shopping_list: Id;
  name: string;
  quantity: string;
  notes: string;
  section: SectionKey;
  is_checked: boolean;
  checked_at: string | null;
  checked_by_name: string | null;
  added_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemSuggestionDto {
  id: Id;
  name: string;
  section: SectionKey;
  use_count: number;
}

export interface ShoppingOverviewDto {
  list: ShoppingListDto;
  members: ShoppingMemberDto[];
  items: ShoppingItemDto[];
  suggestions: ItemSuggestionDto[];
  sections: SectionDto[];
  // Durchschnittspreis pro Artikel aus den letzten Einkäufen (haushalt/
  // services.py price_per_item) — Grundlage des Schätz-Vorschlags.
  price_per_item: string;
  price_from_history: boolean;
  // false für Kind-Konten: sie können einkaufen, aber keine Ausgabe buchen.
  can_book_expense: boolean;
}

export interface ShoppingItemPatch {
  name?: string;
  quantity?: string;
  notes?: string;
  section?: SectionKey;
  is_checked?: boolean;
}

export interface CompleteShoppingResult {
  item_count: number;
  amount: string | null;
  transaction_id: Id | null;
}

export type Effort = 1 | 2 | 3;

export type Recurrence = 'daily' | 'weekly' | 'monthly' | 'yearly';
/** Wo eine Aufgabe anfällt — backend haushalt/models.py Task.Room; '' = ohne Raum. */
export type TaskRoom =
  | ''
  | 'kueche'
  | 'bad'
  | 'wohnzimmer'
  | 'schlafzimmer'
  | 'kinderzimmer'
  | 'waschkueche'
  | 'flur'
  | 'arbeitszimmer'
  | 'aussen'
  | 'alle';
export type TaskPriority = 'niedrig' | 'mittel' | 'hoch';

/** GET /haushalt/aufgaben/woche/ — „Aufgaben im Überblick“. */
export interface TaskWeekStatsDto {
  done_this_week: number;
  done_last_week: number;
  open_total: number;
  assigned_to_me: number;
}
export type TaskStatus = 'open' | 'done';

/** GET /haushalt/aufgaben/routinen/ — Erledigungsrate der aktiven Routinen (4 Wochen). */
export interface RoutineStatsDto {
  completion_rate: number | null;
  done: number;
  expected: number;
}

export interface TaskDto {
  id: Id;
  title: string;
  description: string;
  status: TaskStatus;
  assigned_to: Id | null;
  assigned_to_name: string | null;
  due_date: string | null;
  due_time: string | null;
  recurrence: Recurrence | null;
  recurrence_days: number | null;
  recurrence_months: number | null;
  effort: Effort;
  room: TaskRoom;
  duration_minutes: number | null;
  priority: TaskPriority;
  rotate: boolean;
  rotation_member_ids: Id[];
  /** Pausierte Routinen erscheinen nicht unter „Heute“ und lassen sich nicht abhaken. */
  is_paused: boolean;
  /** Serie im Rhythmus der Routine (Tage/Wochen/Monate in Folge); null bei einmaligen Aufgaben. */
  streak: number | null;
  is_done: boolean;
  is_overdue: boolean;
  last_done_at: string | null;
  last_done_by_name: string | null;
  updated_at?: string;
}

export interface TaskInput {
  title: string;
  description: string;
  assigned_to: Id | null;
  due_date: string | null;
  due_time: string | null;
  /** Einfache Wiederholung; für „alle X Tage/Wochen“ stattdessen recurrence_days (ohne recurrence). */
  recurrence?: Recurrence | null;
  recurrence_days?: number;
  effort: Effort;
  room: TaskRoom;
  duration_minutes: number | null;
  priority: TaskPriority;
  rotate: boolean;
  rotation_member_ids: Id[];
}

/** GET /haushalt/uebersicht/ — Gerät in der Übersicht (ohne außer Betrieb gesetzte). */
export interface OverviewDeviceDto {
  id: Id;
  name: string;
  provider: string;
  status: DeviceStatus;
  maintenance_due_date: string | null;
  warranty_end_date: string | null;
}

/** Vertrag in der Übersicht — die nächste Kündigungsfrist zuerst; nie mit Vertragsnummer. */
export interface OverviewContractDto {
  id: Id;
  name: string;
  provider: string;
  cost: string | null;
  billing_cycle: BillingCycle;
  cancellation_deadline: string | null;
  effective_status: ContractStatus;
}

/** „Demnächst“: Wartung, Garantieende, Kündigungsfrist in den nächsten 30 Tagen (backend services.UPCOMING_DAYS). */
export interface UpcomingDeadlineDto {
  entry_id: Id;
  kind: FolderKind;
  art: DeadlineDto['art'];
  title: string;
  name: string;
  date: string;
  days: number;
}

/** Zählwerte für „Heute“ und die Dashboard-Karte — nur der eigene Haushalt. */
export interface HaushaltSummaryDto {
  open_tasks: number;
  due_today: number;
  overdue_tasks: number;
  recurring_tasks: number;
  done_this_week: number;
  open_shopping_items: number;
  active_lists: number;
  devices: number;
  devices_in_repair: number;
  contracts: number;
  contracts_expiring: number;
  upcoming: number;
}

export interface HaushaltOverviewDto {
  summary: HaushaltSummaryDto;
  open_tasks: number;
  overdue_tasks: number;
  /** Überfällig oder heute fällig (höchstens 5). */
  today: TaskDto[];
  /** Später fällig oder ohne Datum. */
  upcoming: TaskDto[];
  deadlines: UpcomingDeadlineDto[];
  /** Offener Einkauf: Anzahl, einige Artikel, Standardliste. */
  shopping: { open_items: number; preview: string[]; list_id: Id | null };
  open_shopping_items: number;
  devices: number;
  device_list: OverviewDeviceDto[];
  /** Kind-Konten: 0 / leer (Vertragskosten sind Finanzdaten). */
  contracts: number;
  contracts_monthly: string;
  contract_list: OverviewContractDto[];
}

export interface MemberLoadDto {
  user_id: Id;
  name: string;
  points: number;
  count: number;
}

export type FolderKind = 'vertrag' | 'geraet';

export interface DeadlineDto {
  art: 'kuendigung' | 'garantie' | 'wartung';
  datum: string;
  titel: string;
}

export type DeviceStatus = 'ACTIVE' | 'REPAIR' | 'RETIRED';
/** EXPIRING wird berechnet (effective_status), nie gespeichert. */
export type ContractStatus = 'ACTIVE' | 'EXPIRING' | 'CANCELLED' | 'ENDED';
export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ONE_TIME';

export interface FolderEntryDto {
  id: Id;
  /** Beträge sind privat: false = von jemand anderem erfasst, `cost`/`monthly_equivalent` kommen dann als null. */
  cost_visible?: boolean;
  kind: FolderKind;
  name: string;
  /** Vertrag: Anbieter; Gerät: Hersteller. */
  provider: string;
  category: string;
  /** Gespeicherter Status (Vertrag: ACTIVE/CANCELLED/ENDED, Gerät: ACTIVE/REPAIR/RETIRED). */
  status: Exclude<ContractStatus, 'EXPIRING'> | DeviceStatus;
  effective_status: ContractStatus | DeviceStatus;
  notes: string;
  // Kosten eines Vertrags — gehören dem Haushalt, werden nicht in Finanzen übertragen.
  cost: string | null;
  billing_cycle: BillingCycle;
  monthly_equivalent: string | null;
  start_date: string | null;
  end_date: string | null;
  notice_period_days: number | null;
  cancellation_deadline: string | null;
  auto_renewal: boolean;
  /** Sensibel: nur in der Detailantwort (getFolderEntry), nie in Listen. */
  contract_number?: string;
  purchase_date: string | null;
  warranty_end_date: string | null;
  maintenance_interval_months: number | null;
  maintenance_due_date: string | null;
  last_maintenance: string | null;
  model: string;
  room: TaskRoom;
  deadlines: DeadlineDto[];
  created_at?: string;
  updated_at?: string;
}

export interface FolderEntryInput {
  kind: FolderKind;
  name: string;
  provider: string;
  category: string;
  status: FolderEntryDto['status'];
  notes: string;
  /** Weglassen = unverändert (z. B. Betrag eines fremden Vertrags, den man nicht sehen darf). */
  cost?: string | null;
  billing_cycle: BillingCycle;
  start_date: string | null;
  end_date: string | null;
  notice_period_days: number | null;
  auto_renewal: boolean;
  contract_number: string;
  purchase_date: string | null;
  warranty_end_date: string | null;
  maintenance_interval_months: number | null;
  maintenance_due_date: string | null;
  last_maintenance: string | null;
  model: string;
  room: TaskRoom;
}

/** Die echten /api/v1/haushalt/-Endpunkte (backend/haushalt/urls.py). */
@Injectable({ providedIn: 'root' })
export class HaushaltApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/haushalt`;

  /** Ohne listId die Standardliste des Haushalts. */
  getShopping(listId: Id | null = null): Observable<ShoppingOverviewDto> {
    const params: Record<string, string> = listId === null ? {} : { liste: String(listId) };
    return this.http.get<ShoppingOverviewDto>(`${this.base}/einkauf/`, { params });
  }

  /** archived = true: nur die archivierten Listen. */
  getShoppingLists(archived = false): Observable<ShoppingListDto[]> {
    const params: Record<string, string> = archived ? { archiviert: '1' } : {};
    return this.http.get<ShoppingListDto[]>(`${this.base}/einkauf/listen/`, { params });
  }

  createShoppingList(input: ShoppingListInput): Observable<ShoppingListDto> {
    return this.http.post<ShoppingListDto>(`${this.base}/einkauf/listen/`, input);
  }

  updateShoppingList(id: Id, input: Partial<ShoppingListInput>): Observable<ShoppingListDto> {
    return this.http.patch<ShoppingListDto>(`${this.base}/einkauf/listen/${id}/`, input);
  }

  deleteShoppingList(id: Id): Observable<void> {
    return this.http.delete<void>(`${this.base}/einkauf/listen/${id}/`);
  }

  addItem(
    name: string,
    quantity: string,
    section: SectionKey | null,
    listId: Id | null = null,
    notes = '',
  ): Observable<ShoppingItemDto> {
    const body: Record<string, string | Id> = { name, quantity };
    if (notes) body['notes'] = notes;
    if (section) body['section'] = section;
    if (listId !== null) body['shopping_list'] = listId;
    return this.http.post<ShoppingItemDto>(`${this.base}/einkauf/eintraege/`, body);
  }

  updateItem(id: Id, patch: ShoppingItemPatch): Observable<ShoppingItemDto> {
    return this.http.patch<ShoppingItemDto>(`${this.base}/einkauf/eintraege/${id}/`, patch);
  }

  deleteItem(id: Id): Observable<void> {
    return this.http.delete<void>(`${this.base}/einkauf/eintraege/${id}/`);
  }

  completeShopping(amount: number | null, listId: Id | null = null): Observable<CompleteShoppingResult> {
    const body: Record<string, string | Id | null> = { amount: amount === null ? null : amount.toFixed(2) };
    if (listId !== null) body['shopping_list'] = listId;
    return this.http.post<CompleteShoppingResult>(`${this.base}/einkauf/eintraege/abschliessen/`, body);
  }

  getTasks(status: TaskStatus | 'all' = 'open'): Observable<TaskDto[]> {
    return this.http.get<TaskDto[]>(`${this.base}/aufgaben/`, { params: { status } });
  }

  getOverview(): Observable<HaushaltOverviewDto> {
    return this.http.get<HaushaltOverviewDto>(`${this.base}/uebersicht/`);
  }

  reopenTask(id: Id): Observable<TaskDto> {
    return this.http.post<TaskDto>(`${this.base}/aufgaben/${id}/wieder-oeffnen/`, {});
  }

  getTaskWeek(): Observable<TaskWeekStatsDto> {
    return this.http.get<TaskWeekStatsDto>(`${this.base}/aufgaben/woche/`);
  }

  getRoutineStats(): Observable<RoutineStatsDto> {
    return this.http.get<RoutineStatsDto>(`${this.base}/aufgaben/routinen/`);
  }

  setTaskPaused(id: Id, paused: boolean): Observable<TaskDto> {
    return this.http.patch<TaskDto>(`${this.base}/aufgaben/${id}/`, { is_paused: paused });
  }

  getTaskLoad(): Observable<MemberLoadDto[]> {
    return this.http
      .get<{ members: MemberLoadDto[] }>(`${this.base}/aufgaben/verteilung/`)
      .pipe(map((response) => response.members ?? []));
  }

  createTask(input: TaskInput): Observable<TaskDto> {
    return this.http.post<TaskDto>(`${this.base}/aufgaben/`, input);
  }

  updateTask(id: Id, input: TaskInput): Observable<TaskDto> {
    return this.http.patch<TaskDto>(`${this.base}/aufgaben/${id}/`, input);
  }

  deleteTask(id: Id): Observable<void> {
    return this.http.delete<void>(`${this.base}/aufgaben/${id}/`);
  }

  /** `dueDate`: der Termin, der gerade abgehakt wird — eine doppelt ankommende Anfrage (Doppelklick, Wiederholung)
   * zählt dann nicht ein zweites Mal und lässt die Serie keinen Termin überspringen. */
  completeTask(id: Id, dueDate?: string | null): Observable<TaskDto> {
    return this.http.post<TaskDto>(`${this.base}/aufgaben/${id}/erledigt/`, dueDate ? { due_date: dueDate } : {});
  }

  getFolder(): Observable<FolderEntryDto[]> {
    return this.http.get<FolderEntryDto[]>(`${this.base}/ordner/`);
  }

  /** Detail mit Vertragsnummer. */
  getFolderEntry(id: Id): Observable<FolderEntryDto> {
    return this.http.get<FolderEntryDto>(`${this.base}/ordner/${id}/`);
  }

  updateFolderStatus(id: Id, status: FolderEntryDto['status']): Observable<FolderEntryDto> {
    return this.http.patch<FolderEntryDto>(`${this.base}/ordner/${id}/`, { status });
  }

  createFolderEntry(input: FolderEntryInput): Observable<FolderEntryDto> {
    return this.http.post<FolderEntryDto>(`${this.base}/ordner/`, input);
  }

  updateFolderEntry(id: Id, input: FolderEntryInput): Observable<FolderEntryDto> {
    return this.http.patch<FolderEntryDto>(`${this.base}/ordner/${id}/`, input);
  }

  deleteFolderEntry(id: Id): Observable<void> {
    return this.http.delete<void>(`${this.base}/ordner/${id}/`);
  }

  completeMaintenance(id: Id): Observable<FolderEntryDto> {
    return this.http.post<FolderEntryDto>(`${this.base}/ordner/${id}/wartung-erledigt/`, {});
  }
}
