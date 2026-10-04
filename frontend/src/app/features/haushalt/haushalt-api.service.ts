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
  section: SectionKey;
  is_checked: boolean;
  checked_at: string | null;
  checked_by_name: string | null;
  added_by_name: string | null;
  created_at: string;
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
  section?: SectionKey;
  is_checked?: boolean;
}

export interface CompleteShoppingResult {
  item_count: number;
  amount: string | null;
  transaction_id: Id | null;
}

export type Effort = 1 | 2 | 3;

export type Recurrence = 'daily' | 'weekly' | 'monthly';
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
}

export interface TaskInput {
  title: string;
  description: string;
  assigned_to: Id | null;
  due_date: string | null;
  due_time: string | null;
  recurrence: Recurrence | null;
  effort: Effort;
  room: TaskRoom;
  duration_minutes: number | null;
  priority: TaskPriority;
  rotate: boolean;
  rotation_member_ids: Id[];
}

/** GET /haushalt/uebersicht/ — Zahlen für „Übersicht“ und die Dashboard-Karte. */
export interface OverviewDeviceDto {
  id: Id;
  name: string;
  provider: string;
  next_maintenance: string | null;
  warranty_until: string | null;
}

/** Vertrag in der Übersicht — die nächste Kündigungsfrist zuerst. */
export interface OverviewContractDto {
  id: Id;
  name: string;
  provider: string;
  monthly_cost: string | null;
  cancel_by: string | null;
  notice_period_months: number | null;
}

export interface HaushaltOverviewDto {
  open_tasks: number;
  overdue_tasks: number;
  /** Überfällig oder heute fällig. */
  today: TaskDto[];
  /** Später fällig oder ohne Datum. */
  upcoming: TaskDto[];
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

export interface FolderEntryDto {
  id: Id;
  kind: FolderKind;
  name: string;
  provider: string;
  notes: string;
  // Monatliche Kosten eines Vertrags — gehören dem Haushalt (ADR-001),
  // keine Verknüpfung mehr zu den eingefrorenen Haushaltsfinanzen.
  monthly_cost: string | null;
  contract_end: string | null;
  notice_period_months: number | null;
  cancel_by: string | null;
  purchase_date: string | null;
  warranty_until: string | null;
  maintenance_interval_months: number | null;
  next_maintenance: string | null;
  last_maintenance: string | null;
  /** Gerät: Modell und Raum (Hersteller steht in provider). */
  model: string;
  room: TaskRoom;
  deadlines: DeadlineDto[];
}

export interface FolderEntryInput {
  kind: FolderKind;
  name: string;
  provider: string;
  notes: string;
  monthly_cost: string | null;
  contract_end: string | null;
  notice_period_months: number | null;
  purchase_date: string | null;
  warranty_until: string | null;
  maintenance_interval_months: number | null;
  next_maintenance: string | null;
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

  getShoppingLists(): Observable<ShoppingListDto[]> {
    return this.http.get<ShoppingListDto[]>(`${this.base}/einkauf/listen/`);
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

  addItem(name: string, quantity: string, section: SectionKey | null, listId: Id | null = null): Observable<ShoppingItemDto> {
    const body: Record<string, string | Id> = { name, quantity };
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
      .pipe(map((response) => response.members));
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

  completeTask(id: Id): Observable<TaskDto> {
    return this.http.post<TaskDto>(`${this.base}/aufgaben/${id}/erledigt/`, {});
  }

  getFolder(): Observable<FolderEntryDto[]> {
    return this.http.get<FolderEntryDto[]>(`${this.base}/ordner/`);
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
