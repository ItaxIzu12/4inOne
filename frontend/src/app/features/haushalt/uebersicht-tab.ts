import { Component, computed, inject, output, signal } from '@angular/core';
import { AppIcon } from '../../shared/icons/app-icon';
import { HaushaltOverviewDto, Id, OverviewDeviceDto, TaskDto } from './haushalt-api.service';
import { HAUSHALT_DATA_PROVIDER } from './haushalt-data-provider';
import { relativeDay } from './haushalt-logic';

export type HaushaltTabKey = 'uebersicht' | 'aufgaben' | 'ordner' | 'einkauf' | 'routinen';

/**
 * „Heute“ im Haushalt: überfällige und heute fällige Aufgaben (wenige,
 * direkt abhakbar) plus drei Kennzahlen als Einstieg in die anderen
 * Bereiche. Alle Zahlen kommen aus einer Antwort (GET /haushalt/uebersicht/).
 */
@Component({
  selector: 'app-uebersicht-tab',
  standalone: true,
  imports: [AppIcon],
  templateUrl: './uebersicht-tab.html',
  styleUrls: ['./haushalt-common.scss', './uebersicht-tab.scss'],
})
export class UebersichtTab {
  private readonly provider = inject(HAUSHALT_DATA_PROVIDER);
  readonly saved = output<string>();
  readonly openTab = output<HaushaltTabKey>();

  protected readonly overview = signal<HaushaltOverviewDto | null>(null);
  protected readonly loadError = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly completing = signal<Id | null>(null);
  protected readonly relativeDay = relativeDay;

  /** „Aktuelle Aufgaben“: erst überfällig/heute, dann die nächsten — vier
   * Zeilen reichen als Überblick, der Rest steht im Aufgaben-Tab. */
  protected readonly current = computed(() => {
    const data = this.overview();
    return data ? [...data.today, ...data.upcoming].slice(0, 4) : [];
  });

  /** „Heute, 15:00 Uhr“ / „Morgen“ / „Überfällig“ / „Ohne Datum“. */
  protected subtitle(task: TaskDto): string {
    if (!task.due_date) return 'Ohne Datum';
    const day = task.is_overdue ? 'Überfällig' : relativeDay(task.due_date);
    const label = day.charAt(0).toUpperCase() + day.slice(1);
    return task.due_time ? `${label}, ${task.due_time.slice(0, 5)} Uhr` : label;
  }

  /** Nächster Termin des Geräts, sonst Garantieende — nur echte Daten. */
  protected deviceHint(device: OverviewDeviceDto): string {
    const format = (iso: string) => iso.split('-').reverse().join('.');
    if (device.next_maintenance) return `Wartung ${format(device.next_maintenance)}`;
    if (device.warranty_until) return `Garantie bis ${format(device.warranty_until)}`;
    return '';
  }

  constructor() {
    this.load();
  }

  protected load(): void {
    this.provider.getOverview().subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.loadError.set(false);
      },
      error: () => this.loadError.set(true),
    });
  }

  protected complete(task: TaskDto): void {
    if (this.completing() !== null) return;
    this.completing.set(task.id);
    this.actionError.set(null);
    this.provider.completeTask(task.id).subscribe({
      next: () => {
        this.completing.set(null);
        this.load();
        this.saved.emit(`„${task.title}“ erledigt.`);
      },
      error: () => {
        this.completing.set(null);
        this.actionError.set(`„${task.title}“ konnte nicht abgehakt werden. Bitte noch einmal versuchen.`);
      },
    });
  }
}
