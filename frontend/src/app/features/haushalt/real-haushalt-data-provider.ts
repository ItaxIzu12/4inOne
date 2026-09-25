import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CompleteShoppingResult,
  DeductionOptionDto,
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
  TaskDto,
  TaskInput,
  TaskStatus,
} from './haushalt-api.service';
import { HaushaltDataProvider } from './haushalt-data-provider';

/** Dünner Adapter auf die echten Endpunkte, für /app registriert. */
@Injectable()
export class RealHaushaltDataProvider implements HaushaltDataProvider {
  private readonly api = inject(HaushaltApiService);

  getShopping(): Observable<ShoppingOverviewDto> {
    return this.api.getShopping();
  }
  addItem(name: string, quantity: string, section: SectionKey | null): Observable<ShoppingItemDto> {
    return this.api.addItem(name, quantity, section);
  }
  updateItem(id: Id, patch: ShoppingItemPatch): Observable<ShoppingItemDto> {
    return this.api.updateItem(id, patch);
  }
  deleteItem(id: Id): Observable<void> {
    return this.api.deleteItem(id);
  }
  completeShopping(amount: number | null): Observable<CompleteShoppingResult> {
    return this.api.completeShopping(amount);
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
  getUnlinkedDeductions(): Observable<DeductionOptionDto[]> {
    return this.api.getUnlinkedDeductions();
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
