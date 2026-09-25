import { Component, computed, effect, ElementRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AppIcon, IconName } from '../icons/app-icon';
import {
  ConnectedObject,
  ConnectionDomain,
  ConnectionDto,
  ConnectionObjectType,
  ConnectionOption,
  ConnectionsApi,
} from './connections-api.service';

type Step = 'type' | 'object' | 'confirm';

/** Wie jede Art in der Oberfläche heißt und aussieht. Technische Begriffe (Source, Target, ID) bleiben intern. */
const KIND: Record<ConnectionObjectType, { label: string; icon: IconName }> = {
  TASK: { label: 'Aufgabe', icon: 'check' },
  CALENDAR_EVENT: { label: 'Termin', icon: 'calendar' },
  SAVINGS_GOAL: { label: 'Sparziel', icon: 'finance' },
  HOUSEHOLD_TASK: { label: 'Haushaltsaufgabe', icon: 'household' },
  TRIP: { label: 'Reise', icon: 'travel' },
  BUDGET: { label: 'Budget', icon: 'finance' },
};

/** Wohin eine Verbindung führt: die Seite des Objekts, das es dort öffnet (Deep-Link per Query-Parameter). */
function linkFor(object: ConnectedObject): { path: string[]; query: Record<string, string | number> } {
  switch (object.type) {
    case 'TASK':
      return { path: ['/app/organisation'], query: { kind: 'task', id: object.id } };
    case 'CALENDAR_EVENT':
      return { path: ['/app/organisation'], query: { kind: 'event', id: object.id } };
    case 'HOUSEHOLD_TASK':
      return { path: ['/app/haushalt'], query: { tab: 'aufgaben', task: object.id } };
    case 'SAVINGS_GOAL':
      return { path: ['/app/finanzen'], query: { goal: object.id } };
    default:
      return { path: ['/app'], query: {} };
  }
}

/** Ab so vielen Treffern lohnt sich das Suchfeld. */
const SEARCH_FROM = 8;

/**
 * „Verknüpft“ — zeigt, was mit diesem Objekt zusammengehört, und lässt neue
 * Verbindungen hinzufügen. Wiederverwendbar auf jeder Bearbeiten-Ansicht:
 *
 *   <app-connections objectType="SAVINGS_GOAL" [objectId]="goalId()" />
 *
 * Die Oberfläche zeigt nur, was das Backend liefert (es filtert nach
 * Berechtigung). Eine Verbindung ändert nie Daten der verbundenen Objekte.
 * Der Assistent (3 Schritte) klappt hier im Abschnitt auf, ohne zweites
 * Modal über dem Modal — so bleiben Fokusführung und Escape eindeutig.
 * Ohne Anmeldung (Demo) und ohne gespeichertes Objekt erscheint nichts.
 */
@Component({
  selector: 'app-connections',
  standalone: true,
  imports: [AppIcon, RouterLink],
  templateUrl: './connections-section.html',
  styleUrl: './connections-section.css',
})
export class ConnectionsSection {
  private readonly api = inject(ConnectionsApi);
  private readonly auth = inject(AuthService);

  readonly objectType = input.required<ConnectionObjectType>();
  readonly objectId = input<number | string | null>(null);

  protected readonly kind = KIND;
  private readonly numericId = computed(() => {
    const id = this.objectId();
    return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null;
  });
  protected readonly enabled = computed(() => this.auth.isAuthenticated() && this.numericId() !== null);

  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly items = signal<ConnectionDto[]>([]);
  /** Zeilen mit fertigem Link — Objekte, die sich pro Änderungszyklus nicht neu erzeugen (sonst NG0100). */
  protected readonly rows = computed(() =>
    this.items().flatMap((item) => (item.other ? [{ item, other: item.other, link: linkFor(item.other) }] : [])),
  );
  protected readonly message = signal('');
  protected readonly actionError = signal('');
  protected readonly removingId = signal<number | null>(null);

  // Assistent
  protected readonly step = signal<Step | null>(null);
  protected readonly options = signal<ConnectionOption[] | null>(null);
  protected readonly chosenType = signal<ConnectionOption | null>(null);
  protected readonly candidates = signal<ConnectedObject[] | null>(null);
  protected readonly candidatesError = signal(false);
  protected readonly query = signal('');
  protected readonly chosen = signal<ConnectedObject | null>(null);
  protected readonly saving = signal(false);
  protected readonly showSearch = computed(() => (this.candidates()?.length ?? 0) >= SEARCH_FROM || this.query() !== '');

  private readonly addButton = viewChild<ElementRef<HTMLButtonElement>>('addButton');
  private readonly stepHeading = viewChild<ElementRef<HTMLElement>>('stepHeading');
  private loadToken = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
  protected readonly titleId = `connections-h-${nextHeadingId++}`;

  constructor() {
    effect(() => {
      const enabled = this.enabled();
      const id = this.numericId();
      const type = this.objectType();
      untracked(() => {
        this.cancel(false);
        if (enabled && id !== null) this.load(type, id);
      });
    });
  }

  protected typeOf(object: ConnectedObject) {
    return this.kind[object.type] ?? { label: object.type, icon: 'link' as IconName };
  }

  protected domainClass(domain: ConnectionDomain): string {
    return `dom-${domain}`;
  }

  protected load(type = this.objectType(), id = this.numericId()): void {
    if (id === null) return;
    const token = ++this.loadToken;
    this.status.set('loading');
    this.api.list(type, id).subscribe({
      next: (rows) => {
        if (token !== this.loadToken) return;
        this.items.set(rows);
        this.status.set('ready');
      },
      error: () => {
        if (token !== this.loadToken) return;
        this.status.set('error');
      },
    });
  }

  // ---------- Verbindung lösen ----------

  protected remove(item: ConnectionDto): void {
    if (this.removingId() !== null) return;
    this.removingId.set(item.id);
    this.actionError.set('');
    this.api.remove(item.id).subscribe({
      next: () => {
        this.removingId.set(null);
        this.items.update((rows) => rows.filter((row) => row.id !== item.id));
        this.message.set(`Verknüpfung mit „${item.other?.title ?? ''}“ gelöst.`);
      },
      error: () => {
        this.removingId.set(null);
        this.actionError.set('Die Verknüpfung konnte nicht gelöst werden. Bitte versuche es noch einmal.');
      },
    });
  }

  // ---------- Assistent: Was → Womit → Bestätigen ----------

  protected start(): void {
    this.actionError.set('');
    this.message.set('');
    this.options.set(null);
    this.step.set('type');
    this.api.options(this.objectType()).subscribe({
      next: (options) => this.options.set(options),
      error: () => {
        this.options.set([]);
        this.actionError.set('Die Auswahl konnte nicht geladen werden. Bitte versuche es noch einmal.');
      },
    });
    this.focusHeadingSoon();
  }

  protected pickType(option: ConnectionOption): void {
    this.chosenType.set(option);
    this.query.set('');
    this.chosen.set(null);
    this.step.set('object');
    this.loadCandidates();
    this.focusHeadingSoon();
  }

  protected loadCandidates(): void {
    const id = this.numericId();
    const option = this.chosenType();
    if (id === null || !option) return;
    this.candidatesError.set(false);
    this.candidates.set(null);
    this.api.candidates(this.objectType(), id, option.type, this.query()).subscribe({
      next: (rows) => this.candidates.set(rows),
      error: () => {
        this.candidates.set([]);
        this.candidatesError.set(true);
      },
    });
  }

  protected onSearch(value: string): void {
    this.query.set(value.trim());
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadCandidates(), 250);
  }

  protected pickObject(object: ConnectedObject): void {
    this.chosen.set(object);
    this.step.set('confirm');
    this.focusHeadingSoon();
  }

  protected back(): void {
    const current = this.step();
    this.actionError.set('');
    if (current === 'confirm') this.step.set('object');
    else if (current === 'object') this.step.set('type');
    else this.cancel();
    this.focusHeadingSoon();
  }

  protected confirm(): void {
    const id = this.numericId();
    const other = this.chosen();
    if (id === null || !other || this.saving()) return;
    this.saving.set(true);
    this.actionError.set('');
    this.api.create(this.objectType(), id, other.type, other.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.cancel(true);
        this.message.set(`Mit „${other.title}“ verknüpft.`);
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.actionError.set(
          error?.status === 409
            ? 'Diese Verknüpfung besteht bereits.'
            : 'Die Verknüpfung konnte nicht angelegt werden. Bitte versuche es noch einmal.',
        );
      },
    });
  }

  /** Assistent schließen; der Fokus geht zurück auf „Verbindung hinzufügen“. */
  protected cancel(restoreFocus = true): void {
    clearTimeout(this.searchTimer);
    this.step.set(null);
    this.chosenType.set(null);
    this.chosen.set(null);
    this.candidates.set(null);
    this.query.set('');
    // Erst nach dem Rendern: „Verbindung hinzufügen“ existiert im Assistenten-Modus noch nicht.
    if (restoreFocus) setTimeout(() => this.addButton()?.nativeElement.focus());
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Escape schließt nur den Assistenten, nicht den umgebenden Dialog.
    if (event.key === 'Escape' && this.step() !== null) {
      event.stopPropagation();
      this.cancel();
    }
  }

  private focusHeadingSoon(): void {
    setTimeout(() => this.stepHeading()?.nativeElement.focus());
  }
}

let nextHeadingId = 0;
