import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CompleteShoppingResult,
  FolderEntryDto,
  FolderEntryInput,
  HaushaltApiService,
  HaushaltOverviewDto,
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
import { HaushaltDataProvider } from './haushalt-data-provider';

/** Dünner Adapter auf die echten Endpunkte, für /app registriert. */
@Injectable()
export class RealHaushaltDataProvider implements HaushaltDataProvider {
  private readonly api = inject(HaushaltApiService);

  getShopping(listId: Id | null = null): Observable<ShoppingOverviewDto> {
    return this.api.getShopping(listId);
  }
  getShoppingLists(): Observable<ShoppingListDto[]> {
    return this.api.getShoppingLists();
  }
  createShoppingList(input: ShoppingListInput): Observable<ShoppingListDto> {
    return this.api.createShoppingList(input);
  }
  updateShoppingList(id: Id, input: Partial<ShoppingListInput>): Observable<ShoppingListDto> {
    return this.api.updateShoppingList(id, input);
  }
  deleteShoppingList(id: Id): Observable<void> {
    return this.api.deleteShoppingList(id);
  }
  addItem(name: string, quantity: string, section: SectionKey | null, listId: Id | null = null): Observable<ShoppingItemDto> {
    return this.api.addItem(name, quantity, section, listId);
  }
  updateItem(id: Id, patch: ShoppingItemPatch): Observable<ShoppingItemDto> {
    return this.api.updateItem(id, patch);
  }
  deleteItem(id: Id): Observable<void> {
    return this.api.deleteItem(id);
  }
  completeShopping(amount: number | null, listId: Id | null = null): Observable<CompleteShoppingResult> {
    return this.api.completeShopping(amount, listId);
  }

  getOverview(): Observable<HaushaltOverviewDto> {
    return this.api.getOverview();
  }
  getTasks(status: TaskStatus = 'open'): Observable<TaskDto[]> {
    return this.api.getTasks(status);
  }
  getTaskLoad(): Observable<MemberLoadDto[]> {
    return this.api.getTaskLoad();
  }
  getTaskWeek(): Observable<TaskWeekStatsDto> {
    return this.api.getTaskWeek();
  }
  getRoutineStats(): Observable<RoutineStatsDto> {
    return this.api.getRoutineStats();
  }
  setTaskPaused(id: Id, paused: boolean): Observable<TaskDto> {
    return this.api.setTaskPaused(id, paused);
  }
  createTask(input: TaskInput): Observable<TaskDto> {
    return this.api.createTask(input);
  }
  updateTask(id: Id, input: TaskInput): Observable<TaskDto> {
    return this.api.updateTask(id, input);
  }
  deleteTask(id: Id): Observable<void> {
    return this.api.deleteTask(id);
  }
  completeTask(id: Id): Observable<TaskDto> {
    return this.api.completeTask(id);
  }
  reopenTask(id: Id): Observable<TaskDto> {
    return this.api.reopenTask(id);
  }

  getFolder(): Observable<FolderEntryDto[]> {
    return this.api.getFolder();
  }
  createFolderEntry(input: FolderEntryInput): Observable<FolderEntryDto> {
    return this.api.createFolderEntry(input);
  }
  updateFolderEntry(id: Id, input: FolderEntryInput): Observable<FolderEntryDto> {
    return this.api.updateFolderEntry(id, input);
  }
  deleteFolderEntry(id: Id): Observable<void> {
    return this.api.deleteFolderEntry(id);
  }
  completeMaintenance(id: Id): Observable<FolderEntryDto> {
    return this.api.completeMaintenance(id);
  }
}
