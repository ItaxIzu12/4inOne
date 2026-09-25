import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppShell } from '../../layout/app-shell';
import { AppIcon } from '../../shared/icons/app-icon';
import { SaveFeedback } from '../../shared/save-feedback/save-feedback';
import { AufgabenTab } from './aufgaben-tab';
import { EinkaufTab } from './einkauf-tab';
import { OrdnerTab } from './ordner-tab';
import { HaushaltTabKey, UebersichtTab } from './uebersicht-tab';

type HaushaltTab = HaushaltTabKey;
// Reihenfolge wie im Entwurf: Übersicht, Aufgaben, Geräte, Einkaufsliste,
// Routinen. „ordner“ bleibt der interne Schlüssel (Geräte und Verträge).
const TABS: { key: HaushaltTab; label: string }[] = [
  { key: 'uebersicht', label: 'Übersicht' },
  { key: 'aufgaben', label: 'Aufgaben' },
  { key: 'ordner', label: 'Geräte' },
  { key: 'einkauf', label: 'Einkaufsliste' },
  { key: 'routinen', label: 'Routinen' },
];
const TAB_KEYS = TABS.map((tab) => tab.key);

/**
 * Haushalt-Modul: Übersicht („Heute“), Aufgaben, Routinen (wiederkehrende
 * Aufgaben), Einkaufsliste mit Einkaufsmodus und Einkauf-zu-Ausgabe sowie
 * Geräte und Verträge (GESAMTKONZEPT.md §5). Diese Komponente ist nur die
 * Seitenhülle; die Bereiche sind eigene Komponenten, die ihre Daten
 * über HAUSHALT_DATA_PROVIDER beziehen (Demo oder echte API, je nach Route).
 */
@Component({
  selector: 'app-haushalt',
  standalone: true,
  imports: [AppShell, AppIcon, SaveFeedback, EinkaufTab, AufgabenTab, OrdnerTab, UebersichtTab],
  templateUrl: './haushalt.html',
  styleUrl: './haushalt.scss',
})
export class Haushalt {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly tabs = TABS;
  protected readonly activeTab = signal<HaushaltTab>('uebersicht');
  protected readonly saveMessage = signal('');
  protected readonly newTaskRequest = signal(0);
  private requestSeq = 0;
  private saveTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const tab = this.route.snapshot.queryParamMap.get('tab') as HaushaltTab | null;
    if (tab && TAB_KEYS.includes(tab)) this.activeTab.set(tab);
    inject(DestroyRef).onDestroy(() => clearTimeout(this.saveTimer));
  }

  /** „Neue Aufgabe“ im Seitenkopf: zum Aufgaben-Tab und Formular öffnen. */
  protected newTask(): void {
    this.selectTab(this.activeTab() === 'routinen' ? 'routinen' : 'aufgaben');
    this.newTaskRequest.set(++this.requestSeq);
  }

  protected selectTab(tab: HaushaltTab): void {
    this.newTaskRequest.set(0);
    this.activeTab.set(tab);
    // Reiter in der URL, damit Zurück-Navigation und geteilte Links auf dem
    // richtigen Reiter landen.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'uebersicht' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected onTabKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const index = TAB_KEYS.indexOf(this.activeTab());
    const next = TAB_KEYS[(index + (event.key === 'ArrowRight' ? 1 : TAB_KEYS.length - 1)) % TAB_KEYS.length];
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
