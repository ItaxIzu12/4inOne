import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, concat, defer, last, map, of, switchMap } from 'rxjs';
import { DEMO_MODE } from '../../core/demo-context';
import { AppIcon } from '../icons/app-icon';
import { AUTO_LABEL, AutoPreview } from './auto-link-rules';
import { AutoKind, AutoLinkState, AutoLinksApi, AutoSourceType, AutoStatus } from './auto-links-api.service';

let uid = 0;

const KINDS_FOR: Record<AutoSourceType, AutoKind[]> = {
  CONTRACT: ['CONTRACT_FINANCE', 'CONTRACT_REMINDER'],
  DEVICE: ['DEVICE_MAINTENANCE'],
  TRIP: ['TRIP_CALENDAR'],
  SAVINGS_GOAL: ['SAVINGS_REMINDER'],
  HOUSEHOLD: ['HOUSEHOLD_TASKS'],
};
/** Wohin „Ansehen“ führt (Zielbereich der abgeleiteten Einträge). */
const TARGET: Record<AutoKind, { label: string; path: string; query: Record<string, string> }> = {
  CONTRACT_FINANCE: { label: 'In Finanzen ansehen', path: '/finanzen', query: {} },
  CONTRACT_REMINDER: { label: 'Im Kalender ansehen', path: '/organisation', query: { tab: 'calendar' } },
  DEVICE_MAINTENANCE: { label: 'Im Kalender ansehen', path: '/organisation', query: { tab: 'calendar' } },
  TRIP_CALENDAR: { label: 'Im Kalender ansehen', path: '/organisation', query: { tab: 'calendar' } },
  SAVINGS_REMINDER: { label: 'Im Kalender ansehen', path: '/organisation', query: { tab: 'calendar' } },
  HOUSEHOLD_TASKS: { label: 'Aufgaben ansehen', path: '/organisation', query: { tab: 'tasks' } },
};

interface Wish {
  on: boolean;
  paused: boolean;
}

/**
 * „Mit anderen Bereichen verbinden“ (Connection Engine V2, 01.11.2026) — in den bestehenden Dialogen von Vertrag,
 * Gerät, Reise und Sparziel. Zeigt vor dem Speichern, WAS genau WO erscheint (`previews` aus den Formularwerten,
 * sonst die Vorschau des Servers) oder was noch fehlt. Änderungen gelten erst beim Speichern (`commit`), „Abbrechen“
 * verwirft sie. Aufheben löscht nie etwas Echtes — nur die Anzeige im anderen Bereich.
 */
@Component({
  selector: 'app-auto-links',
  standalone: true,
  imports: [AppIcon, RouterLink],
  templateUrl: './auto-links.html',
  styleUrl: './auto-links.scss',
})
export class AutoLinks {
  private readonly api = inject(AutoLinksApi);
  private readonly demo = inject(DEMO_MODE);

  // Mit Standardwert statt required: der Baustein kann im Dialog schon stehen, bevor die Eingabe gesetzt ist (NG0950)
  readonly sourceType = input<AutoSourceType>('CONTRACT');
  /** null = noch nicht gespeichert (neuer Eintrag). */
  readonly sourceId = input<number | string | null>(null);
  /** Vorschau aus den aktuellen Formularwerten (vor dem Speichern genauer als die des Servers). */
  readonly previews = input<Partial<Record<AutoKind, AutoPreview>>>({});
  /** Was die Quelle heißt — für den Hinweis beim Aufheben („Der Vertrag bleibt.“). */
  readonly sourceLabel = input('Der Eintrag');

  protected readonly server = signal<AutoLinkState[]>([]);
  protected readonly wishes = signal<Partial<Record<AutoKind, Wish>>>({});
  protected readonly loadError = signal(false);
  protected readonly label = AUTO_LABEL;
  protected readonly headingId = `al-h-${++uid}`;

  protected readonly rows = computed(() => {
    const server = new Map(this.server().map((s) => [s.kind, s]));
    return KINDS_FOR[this.sourceType()].map((kind) => {
      const state = server.get(kind);
      const live = this.previews()[kind];
      const preview = live?.preview ?? state?.preview ?? '';
      const problem = live?.problem ?? state?.problem ?? '';
      const linked = !!state?.link_id;
      const wish = this.wishes()[kind] ?? { on: linked, paused: state?.status === 'PAUSED' };
      const target = TARGET[kind];
      return {
        kind,
        preview,
        problem,
        available: state?.available ?? !problem.startsWith('Den Betrag hat jemand anderes'),
        linked,
        wish,
        change: !linked && wish.on ? 'create' : linked && !wish.on ? 'unlink' : linked && wish.paused !== (state?.status === 'PAUSED') ? (wish.paused ? 'pause' : 'resume') : '',
        target: { label: target.label, path: this.demo ? '/demo' + target.path : target.path, query: target.query },
      };
    });
  });
  readonly dirty = computed(() => this.rows().some((r) => r.change));

  constructor() {
    effect(() => {
      const id = this.sourceId();
      const type = this.sourceType();
      untracked(() => this.load(type, id));
    });
  }

  private load(type: AutoSourceType, id: number | string | null): void {
    this.wishes.set({});
    this.loadError.set(false);
    if (id === null || id === undefined || id === '') {
      this.server.set([]);
      return;
    }
    this.api.states(type, id).subscribe({ next: (s) => this.server.set(s), error: () => this.loadError.set(true) });
  }

  /** Beim Öffnen des Dialogs: ungespeicherte Schalter verwerfen und neu laden. */
  reset(): void {
    this.load(this.sourceType(), this.sourceId());
  }

  protected toggle(kind: AutoKind, on: boolean): void {
    const row = this.rows().find((r) => r.kind === kind)!;
    this.wishes.update((w) => ({ ...w, [kind]: { on, paused: on ? row.wish.paused : false } }));
  }
  protected setPaused(kind: AutoKind, paused: boolean): void {
    this.wishes.update((w) => ({ ...w, [kind]: { on: true, paused } }));
  }

  /** Nach dem Speichern der Quelle: Änderungen nacheinander übernehmen (anlegen ist idempotent). */
  commit(sourceId: number | string): Observable<void> {
    const steps: Observable<unknown>[] = [];
    const server = new Map(this.server().map((s) => [s.kind, s]));
    for (const row of this.rows()) {
      const linkId = server.get(row.kind)?.link_id ?? null;
      if (row.change === 'create') {
        steps.push(defer(() => this.api.create(row.kind, sourceId)).pipe(
          switchMap((state) => (row.wish.paused && state.link_id ? this.api.setStatus(state.link_id, 'PAUSED' as AutoStatus) : of(state))),
        ));
      } else if (row.change === 'unlink' && linkId) {
        steps.push(defer(() => this.api.unlink(linkId)));
      } else if ((row.change === 'pause' || row.change === 'resume') && linkId) {
        steps.push(defer(() => this.api.setStatus(linkId, row.change === 'pause' ? 'PAUSED' : 'ACTIVE')));
      }
    }
    if (!steps.length) return of(undefined);
    return concat(...steps).pipe(last(), map(() => undefined));
  }
}
