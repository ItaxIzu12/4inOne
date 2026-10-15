import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CompleteShoppingResult,
  HaushaltOverviewDto,
  FolderEntryDto,
  FolderEntryInput,
  Id,
  MemberLoadDto,
  SectionKey,
  ShoppingItemDto,
  ShoppingItemPatch,
  ShoppingOverviewDto,
  ShoppingListDto,
  ShoppingListInput,
  RoutineStatsDto,
  TaskDto,
  TaskInput,
  TaskWeekStatsDto,
  TaskStatus,
} from './haushalt-api.service';

/**
 * Dasselbe Muster wie FinanzenDataProvider (finanzen-data-provider.ts): die
 * Haushalt-Komponenten kennen nur dieses Interface, welche Implementierung
 * greift, entscheidet die Route (app.routes.ts) — öffentliche Demo mit
 * In-Memory-Daten auf /haushalt, echte API auf /app/haushalt.
 */
export interface HaushaltDataProvider {
  // listId null = Standardliste des Haushalts (Übersicht, Dashboard).
  getShopping(listId?: Id | null): Observable<ShoppingOverviewDto>;
  getShoppingLists(archived?: boolean): Observable<ShoppingListDto[]>;
  createShoppingList(input: ShoppingListInput): Observable<ShoppingListDto>;
  updateShoppingList(id: Id, input: Partial<ShoppingListInput>): Observable<ShoppingListDto>;
  deleteShoppingList(id: Id): Observable<void>;
  addItem(name: string, quantity: string, section: SectionKey | null, listId?: Id | null, notes?: string): Observable<ShoppingItemDto>;
  updateItem(id: Id, patch: ShoppingItemPatch): Observable<ShoppingItemDto>;
  deleteItem(id: Id): Observable<void>;
  // amount null = Einkauf ohne Ausgabe abschließen.
  completeShopping(amount: number | null, listId?: Id | null): Observable<CompleteShoppingResult>;

  getOverview(): Observable<HaushaltOverviewDto>;
  getTasks(status?: TaskStatus): Observable<TaskDto[]>;
  getTaskLoad(): Observable<MemberLoadDto[]>;
  getTaskWeek(): Observable<TaskWeekStatsDto>;
  getRoutineStats(): Observable<RoutineStatsDto>;
  setTaskPaused(id: Id, paused: boolean): Observable<TaskDto>;
  createTask(input: TaskInput): Observable<TaskDto>;
  updateTask(id: Id, input: TaskInput): Observable<TaskDto>;
  deleteTask(id: Id): Observable<void>;
  completeTask(id: Id, dueDate?: string | null): Observable<TaskDto>;
  reopenTask(id: Id): Observable<TaskDto>;

  getFolder(): Observable<FolderEntryDto[]>;
  getFolderEntry(id: Id): Observable<FolderEntryDto>;
  updateFolderStatus(id: Id, status: FolderEntryDto['status']): Observable<FolderEntryDto>;
  createFolderEntry(input: FolderEntryInput): Observable<FolderEntryDto>;
  updateFolderEntry(id: Id, input: FolderEntryInput): Observable<FolderEntryDto>;
  deleteFolderEntry(id: Id): Observable<void>;
  completeMaintenance(id: Id): Observable<FolderEntryDto>;
}

export const HAUSHALT_DATA_PROVIDER = new InjectionToken<HaushaltDataProvider>('HaushaltDataProvider');
