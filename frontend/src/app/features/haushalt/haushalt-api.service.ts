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
  | 'sonstiges';

export interface SectionDto {
  key: SectionKey;
  label: string;
}

export interface ShoppingItemDto {
  id: Id;
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

export interface TaskDto {
  id: Id;
  title: string;
  assigned_to: Id | null;
  assigned_to_name: string | null;
  due_date: string | null;
  recurrence_days: number | null;
  effort: Effort;
  rotate: boolean;
  rotation_member_ids: Id[];
  is_done: boolean;
  is_overdue: boolean;
  last_done_at: string | null;
  last_done_by_name: string | null;
}

export interface TaskInput {
  title: string;
  assigned_to: Id | null;
  due_date: string | null;
  recurrence_days: number | null;
  effort: Effort;
  rotate: boolean;
  rotation_member_ids: Id[];
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
  recurring_deduction_id: Id | null;
  // null, wenn kein fester Abzug verknüpft ist ODER er in Finanzen pausiert
  // ist — ein pausierter Abzug kostet gerade nichts.
  monthly_cost: string | null;
  // null = nicht verknüpft; false = verknüpft, aber pausiert.
  deduction_active: boolean | null;
  contract_end: string | null;
  notice_period_months: number | null;
  cancel_by: string | null;
  purchase_date: string | null;
  warranty_until: string | null;
  maintenance_interval_months: number | null;
  next_maintenance: string | null;
  deadlines: DeadlineDto[];
}

export interface FolderEntryInput {
  kind: FolderKind;
  name: string;
  provider: string;
  notes: string;
  recurring_deduction_id: Id | null;
  contract_end: string | null;
  notice_period_months: number | null;
  purchase_date: string | null;
  warranty_until: string | null;
  maintenance_interval_months: number | null;
  next_maintenance: string | null;
}

export interface DeductionOptionDto {
  id: Id;
  name: string;
  amount: string;
  active: boolean;
}

/** Die echten /api/v1/haushalt/-Endpunkte (backend/haushalt/urls.py). */
@Injectable({ providedIn: 'root' })
export class HaushaltApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/haushalt`;

  getShopping(): Observable<ShoppingOverviewDto> {
    return this.http.get<ShoppingOverviewDto>(`${this.base}/einkauf/`);
  }

  addItem(name: string, quantity: string, section: SectionKey | null): Observable<ShoppingItemDto> {
    const body: Record<string, string> = { name, quantity };
    if (section) body['section'] = section;
    return this.http.post<ShoppingItemDto>(`${this.base}/einkauf/eintraege/`, body);
  }

  updateItem(id: Id, patch: ShoppingItemPatch): Observable<ShoppingItemDto> {
    return this.http.patch<ShoppingItemDto>(`${this.base}/einkauf/eintraege/${id}/`, patch);
  }

  deleteItem(id: Id): Observable<void> {
    return this.http.delete<void>(`${this.base}/einkauf/eintraege/${id}/`);
  }

  completeShopping(amount: number | null): Observable<CompleteShoppingResult> {
    return this.http.post<CompleteShoppingResult>(`${this.base}/einkauf/eintraege/abschliessen/`, {
      amount: amount === null ? null : amount.toFixed(2),
    });
  }

  getTasks(): Observable<TaskDto[]> {
    return this.http.get<TaskDto[]>(`${this.base}/aufgaben/`);
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

  getUnlinkedDeductions(): Observable<DeductionOptionDto[]> {
    return this.http.get<DeductionOptionDto[]>(`${this.base}/ordner/abzuege/`);
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
