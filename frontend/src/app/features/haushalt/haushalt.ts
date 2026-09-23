import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ContextBar } from '../../shared/context-bar/context-bar';
import { SaveFeedback } from '../../shared/save-feedback/save-feedback';
import { SidebarNav } from '../../shared/sidebar-nav/sidebar-nav';
import { FinanzenStateService } from '../finanzen/finanzen-state.service';
import { AufgabenTab } from './aufgaben-tab';
import { EinkaufTab } from './einkauf-tab';
import { OrdnerTab } from './ordner-tab';

type HaushaltTab = 'einkauf' | 'aufgaben' | 'ordner';
const TABS: HaushaltTab[] = ['einkauf', 'aufgaben', 'ordner'];

/**
 * Haushalt-Modul: Einkaufsliste mit Einkaufsmodus und Einkauf-zu-Ausgabe,
 * wiederkehrende Aufgaben mit fairer Verteilung und der Haushaltsordner für
 * Verträge und Geräte (GESAMTKONZEPT.md §5). Diese Komponente ist nur die
 * Seitenhülle; die drei Bereiche sind eigene Komponenten, die ihre Daten
 * über HAUSHALT_DATA_PROVIDER beziehen (Demo oder echte API, je nach Route).
 */
@Component({
  selector: 'app-haushalt',
  standalone: true,
  imports: [SidebarNav, ContextBar, SaveFeedback, EinkaufTab, AufgabenTab, OrdnerTab],
  templateUrl: './haushalt.html',
  styleUrl: './haushalt.scss',
})
export class Haushalt {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly financeState = inject(FinanzenStateService);

  protected readonly activeTab = signal<HaushaltTab>('einkauf');
  protected readonly saveMessage = signal('');
  private saveTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const tab = this.route.snapshot.queryParamMap.get('tab') as HaushaltTab | null;
    if (tab && TABS.includes(tab)) this.activeTab.set(tab);
    // Haushaltsname/Mitglieder für Sidebar und Kontextzeile kommen aus der
    // Finanzen-Übersicht — beim direkten Aufruf dieser Seite ist sie noch
    // nicht geladen.
    if (this.financeState.uebersicht() === null) this.financeState.laden();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.saveTimer));
  }

  protected selectTab(tab: HaushaltTab): void {
    this.activeTab.set(tab);
    // Reiter in der URL, damit Zurück-Navigation und geteilte Links auf dem
    // richtigen Reiter landen.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'einkauf' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected onTabKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const index = TABS.indexOf(this.activeTab());
    const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    this.selectTab(next);
    queueMicrotask(() => document.getElementById(`hh-tab-${next}`)?.focus());
  }

  protected showSaved(message: string): void {
    clearTimeout(this.saveTimer);
    this.saveMessage.set(message);
    this.saveTimer = setTimeout(() => this.saveMessage.set(''), 5000);
  }

  protected dismissSaved(): void {
    clearTimeout(this.saveTimer);
    this.saveMessage.set('');
  }
}
