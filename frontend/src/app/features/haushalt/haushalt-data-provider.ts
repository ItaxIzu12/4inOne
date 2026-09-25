import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CompleteShoppingResult,
  HaushaltOverviewDto,
  DeductionOptionDto,
  FolderEntryDto,
  FolderEntryInput,
  Id,
  MemberLoadDto,
  SectionKey,
  ShoppingItemDto,
  ShoppingItemPatch,
  ShoppingOverviewDto,
  TaskDto,
  TaskInput,
  TaskStatus,
} from './haushalt-api.service';

/**
 * Dasselbe Muster wie FinanzenDataProvider (finanzen-data-provider.ts): die
 * Haushalt-Komponenten kennen nur dieses Interface, welche Implementierung
 * greift, entscheidet die Route (app.routes.ts) — öffentliche Demo mit
 * In-Memory-Daten auf /haushalt, echte API auf /app/haushalt.
 */
export interface HaushaltDataProvider {
  getShopping(): Observable<ShoppingOverviewDto>;
  addItem(name: string, quantity: string, section: SectionKey | null): Observable<ShoppingItemDto>;
  updateItem(id: Id, patch: ShoppingItemPatch): Observable<ShoppingItemDto>;
  deleteItem(id: Id): Observable<void>;
  // amount null = Einkauf ohne Ausgabe abschließen.
  completeShopping(amount: number | null): Observable<CompleteShoppingResult>;

  getOverview(): Observable<HaushaltOverviewDto>;
  getTasks(status?: TaskStatus): Observable<TaskDto[]>;
  getTaskLoad(): Observable<MemberLoadDto[]>;
  createTask(input: TaskInput): Observable<TaskDto>;
  updateTask(id: Id, input: TaskInput): Observable<TaskDto>;
  deleteTask(id: Id): Observable<void>;
  completeTask(id: Id): Observable<TaskDto>;
  reopenTask(id: Id): Observable<TaskDto>;

  getFolder(): Observable<FolderEntryDto[]>;
  getUnlinkedDeductions(): Observable<DeductionOptionDto[]>;
  createFolderEntry(input: FolderEntryInput): Observable<FolderEntryDto>;
  updateFolderEntry(id: Id, input: FolderEntryInput): Observable<FolderEntryDto>;
  deleteFolderEntry(id: Id): Observable<void>;
  completeMaintenance(id: Id): Observable<FolderEntryDto>;
}

export const HAUSHALT_DATA_PROVIDER = new InjectionToken<HaushaltDataProvider>('HaushaltDataProvider');
