import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MobileAction } from '../../shared/mobile-action/mobile-action';
import { ActivatedRoute, Router } from '@angular/router';
import { AppShell } from '../../layout/app-shell';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
import { SaveFeedback } from '../../shared/save-feedback/save-feedback';
import { AufgabenTab, AufgabenView, AUFGABEN_VIEWS } from './aufgaben-tab';
import { EinkaufTab } from './einkauf-tab';
import { OrdnerTab, ZuhauseSection } from './ordner-tab';
import { HaushaltCreate, HaushaltTabKey, UebersichtTab } from './uebersicht-tab';

type HaushaltTab = HaushaltTabKey;
// Haushalt V1 (docs/HAUSHALT_V1.md): genau diese vier Reiter.
const TABS: { key: HaushaltTab; label: string; icon: IconName }[] = [
  { key: 'heute', label: 'Heute', icon: 'calendar' },
  { key: 'aufgaben', label: 'Aufgaben', icon: 'clipboard' },
  { key: 'einkaufen', label: 'Einkaufen', icon: 'cart' },
  { key: 'zuhause', label: 'Zuhause', icon: 'home' },
];
const TAB_KEYS = TABS.map((tab) => tab.key);
const SECTIONS: ZuhauseSection[] = ['geraete', 'vertraege'];

/** Alte Links (?tab=uebersicht|einkauf|ordner|routinen) landen auf dem passenden neuen Reiter. */
const LEGACY_TABS: Record<string, { tab: HaushaltTab; section?: ZuhauseSection; view?: AufgabenView }> = {
  uebersicht: { tab: 'heute' },
  einkauf: { tab: 'einkaufen' },
  ordner: { tab: 'zuhause', section: 'vertraege' },
  routinen: { tab: 'aufgaben', view: 'wiederkehrend' },
};

/**
 * Haushalt-Modul: Heute · Aufgaben · Einkaufen · Zuhause (Geräte | Verträge).
 * Diese Komponente ist nur die Seitenhülle; die Bereiche sind eigene
 * Komponenten, die ihre Daten über HAUSHALT_DATA_PROVIDER beziehen (Demo oder
 * echte API, je nach Route). Wiederkehrende Aufgaben (früher „Routinen“) sind
 * eine Ansicht im Reiter Aufgaben — kein eigenes System.
 */
@Component({
  selector: 'app-haushalt',
  standalone: true,
  imports: [MobileAction, AppShell, AppIcon, SaveFeedback, EinkaufTab, AufgabenTab, OrdnerTab, UebersichtTab],
  templateUrl: './haushalt.html',
  styleUrl: './haushalt.scss',
})
export class Haushalt {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly tabs = TABS;
  protected readonly activeTab = signal<HaushaltTab>('heute');
  protected readonly zuhauseSection = signal<ZuhauseSection>('geraete');
  protected readonly aufgabenView = signal<AufgabenView>('alle');
  /** Hauptaktion im Seitenkopf passend zum Reiter; „Heute“ hat keine. */
  protected readonly headAction = computed(() => {
    switch (this.activeTab()) {
      case 'aufgaben':
        return 'Aufgabe hinzufügen';
      case 'einkaufen':
        return 'Liste erstellen';
      case 'zuhause':
        return this.zuhauseSection() === 'vertraege' ? 'Vertrag hinzufügen' : 'Gerät hinzufügen';
      default:
        return '';
    }
  });
  protected readonly saveMessage = signal('');
  protected readonly newTaskRequest = signal(0);
  private requestSeq = 0;
  private saveTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const raw = params.get('tab');
    const legacy = raw ? LEGACY_TABS[raw] : undefined;
    if (legacy) {
      this.activeTab.set(legacy.tab);
      if (legacy.section) this.zuhauseSection.set(legacy.section);
      if (legacy.view) this.aufgabenView.set(legacy.view);
      this.syncUrl();
    } else if (raw && TAB_KEYS.includes(raw as HaushaltTab)) {
      this.activeTab.set(raw as HaushaltTab);
    }
    const section = params.get('bereich') as ZuhauseSection | null;
    if (section && SECTIONS.includes(section)) this.zuhauseSection.set(section);
    const view = params.get('ansicht') as AufgabenView | null;
    if (view && AUFGABEN_VIEWS.includes(view)) this.aufgabenView.set(view);
    inject(DestroyRef).onDestroy(() => clearTimeout(this.saveTimer));
  }

  protected headActionClick(): void {
    this.newTaskRequest.set(++this.requestSeq);
  }

  protected selectTab(tab: HaushaltTab): void {
    this.newTaskRequest.set(0);
    this.activeTab.set(tab);
    this.syncUrl();
  }

  /** Aus „Heute“: Geräte oder Verträge öffnen. */
  protected openZuhause(section: ZuhauseSection): void {
    this.zuhauseSection.set(section);
    this.selectTab('zuhause');
  }

  /** Leerer Zustand in „Heute“: direkt das passende Formular öffnen. */
  protected createFromToday(what: HaushaltCreate): void {
    if (what === 'einkauf') return this.selectTab('einkaufen');
    if (what === 'aufgabe') {
      this.aufgabenView.set('alle');
      this.selectTab('aufgaben');
    } else {
      this.openZuhause(what === 'vertrag' ? 'vertraege' : 'geraete');
    }
    this.newTaskRequest.set(++this.requestSeq);
  }

  protected setSection(section: ZuhauseSection): void {
    this.zuhauseSection.set(section);
    this.syncUrl();
  }

  protected setView(view: AufgabenView): void {
    this.aufgabenView.set(view);
    this.syncUrl();
  }

  /** Reiter, Bereich und Ansicht in der URL, damit Zurück-Navigation und geteilte Links passen. */
  private syncUrl(): void {
    const tab = this.activeTab();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: tab === 'heute' ? null : tab,
        bereich: tab === 'zuhause' ? this.zuhauseSection() : null,
        ansicht: tab === 'aufgaben' && this.aufgabenView() !== 'alle' ? this.aufgabenView() : null,
      },
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
