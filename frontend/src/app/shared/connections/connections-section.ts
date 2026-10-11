import { ErrorNoticeDirective } from '../error-notice/error-notice';
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
  LinkSuggestionDto,
} from './connections-api.service';

type Step = 'type' | 'object' | 'confirm';

/** Wie jede Art in der Oberfläche heißt und aussieht. Technische Begriffe (Source, Target, ID) bleiben intern. */
const KIND: Record<ConnectionObjectType, { label: string; icon: IconName }> = {
  TASK: { label: 'Aufgabe', icon: 'check' },
  CALENDAR_EVENT: { label: 'Termin', icon: 'calendar' },
  SAVINGS_GOAL: { label: 'Sparziel', icon: 'finance' },
  HOUSEHOLD_TASK: { label: 'Haushaltsaufgabe', icon: 'household' },
  TRIP: { label: 'Reise', icon: 'travel' },
  DEVICE: { label: 'Gerät', icon: 'device' },
  CONTRACT: { label: 'Vertrag', icon: 'file-text' },
  BUDGET: { label: 'Budget', icon: 'finance' },
};

/** Wohin eine Verbindung führt: die Seite des Objekts, das es dort öffnet (Deep-Link per Query-Parameter). */
export function linkFor(object: ConnectedObject): { path: string[]; query: Record<string, string | number> } {
  switch (object.type) {
    case 'TASK':
      return { path: ['/organisation'], query: { kind: 'task', id: object.id } };
    case 'CALENDAR_EVENT':
      return { path: ['/organisation'], query: { kind: 'event', id: object.id } };
    case 'HOUSEHOLD_TASK':
      return { path: ['/haushalt'], query: { tab: 'aufgaben', task: object.id } };
    case 'SAVINGS_GOAL':
      return { path: ['/finanzen'], query: { goal: object.id } };
    case 'TRIP':
      return { path: ['/reisen'], query: { trip: object.id } };
    case 'DEVICE':
    case 'CONTRACT':
      return { path: ['/haushalt'], query: { tab: 'zuhause', entry: object.id } };
    default:
      return { path: ['/'], query: {} };
  }
}

/** Verständliche Meldung je Fehlerart — nie die technische Antwort des Servers. */
export function connectionErrorMessage(error: unknown, fallback: string): string {
  const status = (error as { status?: number } | null)?.status;
  switch (status) {
    case 0:
      return 'Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung und versuche es noch einmal.';
    case 403:
      return 'Dafür fehlt dir die Berechtigung. Diesen Eintrag kannst du nur ansehen.';
    case 404:
      return 'Dieser Eintrag ist nicht mehr verfügbar.';
    case 409:
      return 'Diese Verknüpfung besteht bereits.';
    case 429:
      return 'Zu viele Änderungen in kurzer Zeit. Bitte warte einen Moment.';
    default:
      return fallback;
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
  imports: [ErrorNoticeDirective, AppIcon, RouterLink],
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
  /** Vorschläge „Das könnte zusammengehören“ — höchstens drei, vom Server ausgewählt und begründet. */
  protected readonly suggestions = signal<LinkSuggestionDto[]>([]);
  protected readonly suggestionBusy = signal<string | null>(null);
  protected readonly suggestionRows = computed(() =>
    this.suggestions().flatMap((s) => (s.other ? [{ suggestion: s, other: s.other }] : [])),
  );
  protected readonly message = signal('');
  protected readonly actionError = signal('');
  protected readonly removingId = signal<number | null>(null);

  // Assistent
  protected readonly step = signal<Step | null>(null);
  protected readonly options = signal<ConnectionOption[] | null>(null);
  protected readonly chosenType = signal<ConnectionOption | null>(null);
  protected readonly candidates = signal<ConnectedObject[] | null>(null);
  /** Leer = kein Fehler; sonst die verständliche Meldung. */
  protected readonly candidatesError = signal('');
  protected readonly query = signal('');
  protected readonly chosen = signal<ConnectedObject | null>(null);
  protected readonly saving = signal(false);
  protected readonly showSearch = computed(() => (this.candidates()?.length ?? 0) >= SEARCH_FROM || this.query() !== '');

  private readonly addButton = viewChild<ElementRef<HTMLButtonElement>>('addButton');
  private readonly stepHeading = viewChild<ElementRef<HTMLElement>>('stepHeading');
  private loadToken = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
  protected readonly titleId = `connections-h-${nextHeadingId++}`;
  protected readonly suggestionsTitleId = `${this.titleId}-s`;

  constructor() {
    effect(() => {
      const enabled = this.enabled();
      const id = this.numericId();
      const type = this.objectType();
      untracked(() => {
        this.cancel(false);
        this.suggestions.set([]);
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
        this.loadSuggestions(type, id, token);
      },
      error: () => {
        if (token !== this.loadToken) return;
        this.status.set('error');
      },
    });
  }

  /** Vorschläge sind ein Zusatz: schlägt der Abruf fehl, bleibt der Abschnitt einfach ohne sie. */
  private loadSuggestions(type: ConnectionObjectType, id: number, token: number): void {
    this.api.suggestions(type, id).subscribe({
      next: (rows) => {
        if (token === this.loadToken) this.suggestions.set(rows);
      },
      error: () => {
        if (token === this.loadToken) this.suggestions.set([]);
      },
    });
  }

  // ---------- Vorschläge: Verknüpfen oder Nicht relevant ----------

  protected acceptSuggestion(suggestion: LinkSuggestionDto): void {
    if (this.suggestionBusy() !== null) return;
    this.suggestionBusy.set(suggestion.key);
    this.actionError.set('');
    this.api.acceptSuggestion(suggestion.key).subscribe({
      next: () => {
        this.suggestionBusy.set(null);
        this.dropSuggestion(suggestion.key);
        this.message.set(`Mit „${suggestion.other?.title ?? ''}“ verknüpft.`);
        this.load(); // die neue Verbindung erscheint unter „Verknüpft mit“
      },
      error: (error) => this.suggestionFailed(suggestion, error, 'Die Verknüpfung konnte nicht angelegt werden.'),
    });
  }

  protected dismissSuggestion(suggestion: LinkSuggestionDto): void {
    if (this.suggestionBusy() !== null) return;
    this.suggestionBusy.set(suggestion.key);
    this.actionError.set('');
    this.api.dismissSuggestion(suggestion.key).subscribe({
      next: () => {
        this.suggestionBusy.set(null);
        this.dropSuggestion(suggestion.key);
        this.message.set('Vorschlag ausgeblendet. Er wird nicht wieder angezeigt.');
      },
      error: (error) => this.suggestionFailed(suggestion, error, 'Der Vorschlag konnte nicht ausgeblendet werden.'),
    });
  }

  private suggestionFailed(suggestion: LinkSuggestionDto, error: { status?: number } | null, fallback: string): void {
    this.suggestionBusy.set(null);
    if (error?.status === 404) {
      // Gilt nicht mehr (inzwischen verknüpft, gelöscht oder keine Rechte mehr): leise entfernen.
      this.dropSuggestion(suggestion.key);
      this.actionError.set('Dieser Vorschlag gilt nicht mehr.');
      return;
    }
    this.actionError.set(connectionErrorMessage(error, `${fallback} Bitte versuche es noch einmal.`));
  }

  private dropSuggestion(key: string): void {
    this.suggestions.update((rows) => rows.filter((row) => row.key !== key));
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
        this.message.set(`Verbindung zu „${item.other?.title ?? ''}“ entfernt. Beide Einträge bleiben erhalten.`);
      },
      error: (error) => {
        this.removingId.set(null);
        this.actionError.set(
          connectionErrorMessage(error, 'Die Verbindung konnte nicht entfernt werden. Bitte versuche es noch einmal.'),
        );
        // Schon weg oder nicht mehr sichtbar: aus der Liste nehmen, die Meldung bleibt stehen.
        if (error?.status === 404) this.items.update((rows) => rows.filter((row) => row.id !== item.id));
      },
    });
  }

  // ---------- Assistent: Was → Womit → Bestätigen ----------

  protected start(): void {
    this.actionError.set('');
    this.message.set('');
    this.options.set(null);
    this.step.set('type');
    this.api.options(this.objectType(), this.numericId() ?? undefined).subscribe({
      next: (options) => this.options.set(options),
      error: (error) => {
        this.options.set([]);
        this.actionError.set(
          connectionErrorMessage(error, 'Die Auswahl konnte nicht geladen werden. Bitte versuche es noch einmal.'),
        );
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
    this.candidatesError.set('');
    this.candidates.set(null);
    this.api.candidates(this.objectType(), id, option.type, this.query()).subscribe({
      next: (rows) => this.candidates.set(rows),
      error: (error) => {
        this.candidates.set([]);
        this.candidatesError.set(connectionErrorMessage(error, 'Die Liste konnte nicht geladen werden.'));
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
          connectionErrorMessage(error, 'Die Verknüpfung konnte nicht angelegt werden. Bitte versuche es noch einmal.'),
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
