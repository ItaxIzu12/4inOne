import { Component, DestroyRef, Signal, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { DEMO_MODE } from '../../core/demo-context';
import { AppIcon, IconName } from '../icons/app-icon';
import { ConnectedObject, ConnectionObjectType, ConnectionsApi } from './connections-api.service';

/** Höchstens so viele IDs je Abruf (wie SUMMARY_MAX_IDS im Backend). */
const MAX_IDS = 200;

const ICON: Record<ConnectionObjectType, IconName> = {
  TASK: 'check',
  CALENDAR_EVENT: 'calendar',
  SAVINGS_GOAL: 'finance',
  HOUSEHOLD_TASK: 'household',
  TRIP: 'travel',
  DEVICE: 'device',
  CONTRACT: 'file-text',
  BUDGET: 'finance',
};

/**
 * Verknüpfungen sichtbar machen (31.10.2026): lädt für eine Liste von Objekten einer Art in EINEM Abruf, womit sie
 * verknüpft sind (GET /connections/summary/), und liefert sie als Signal `{ id: [Gegenstücke] }`. Nur für echte
 * Konten und die Demo; Fehler bleiben still — die Hinweise sind ein Zusatz, nie Voraussetzung.
 *
 * Im Injektionskontext einer Komponente aufrufen (Feld-Initialisierer), damit in der Demo der Demo-Dienst greift.
 */
export function connectionHints(type: ConnectionObjectType, ids: () => readonly (number | string)[]): Signal<Record<string, ConnectedObject[]>> {
  const api = inject(ConnectionsApi);
  const auth = inject(AuthService);
  const demo = inject(DEMO_MODE);
  const destroyed = inject(DestroyRef);
  const result = signal<Record<string, ConnectedObject[]>>({});
  let lastKey = '';
  let token = 0;
  let current: { unsubscribe(): void } | null = null;
  destroyed.onDestroy(() => current?.unsubscribe());
  effect(() => {
    const list = [...new Set(ids().map(String))].sort().slice(0, MAX_IDS);
    const enabled = demo || auth.isAuthenticated();
    untracked(() => {
      const key = enabled ? list.join(',') : '';
      if (key === lastKey) return;
      lastKey = key;
      const mine = ++token;
      current?.unsubscribe();
      current = null;
      if (!key) {
        result.set({});
        return;
      }
      current = api.summary(type, list).subscribe({
        next: (map) => mine === token && result.set(map ?? {}),
        error: () => mine === token && result.set({}),
      });
    });
  });
  return result.asReadonly();
}

/**
 * Kleine Marken „✈ Berlin Wochenende“ an einem Eintrag: wohin er gehört. Nicht klickbar (sitzt oft in einem Knopf),
 * Farbe und Symbol des Bereichs; Text für Screenreader „verknüpft mit …“.
 */
@Component({
  selector: 'app-link-hints',
  standalone: true,
  imports: [AppIcon],
  template: `
    @for (o of shown(); track o.type + o.id) {
      <span class="hint" [class]="'hint dom-' + o.domain"><app-icon [name]="icon(o.type)" aria-hidden="true" /><span class="sr-only">verknüpft mit </span><span class="hint__t">{{ o.title }}</span></span>
    }
    @if (more()) {
      <span class="hint hint--more">+{{ more() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px 6px;
      min-width: 0;
      max-width: 100%;
      vertical-align: middle;
    }
    .hint {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      max-width: 100%;
      min-height: 24px;
      padding: 3px 9px;
      border-radius: 12px;
      background: var(--hint-soft);
      color: var(--hint-text);
      font-size: var(--fs-meta, 13px);
      font-weight: 600;
      line-height: 1.2;
    }
    /* Langer Titel bricht um statt abgeschnitten zu werden — man soll lesen können, wohin der Eintrag gehört */
    .hint__t {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .hint app-icon {
      flex: 0 0 13px;
      width: 13px;
      height: 13px;
    }
    .dom-reisen { --hint-soft: var(--travel-soft, #e4ebf3); --hint-text: var(--travel-accent, #36608b); }
    .dom-finanzen { --hint-soft: var(--finance-soft, #e4efe9); --hint-text: var(--finance-accent, #17694f); }
    .dom-haushalt { --hint-soft: var(--household-soft, #f6e8ec); --hint-text: var(--household-accent, #ab445f); }
    .dom-organisation { --hint-soft: var(--organization-soft, #f5ecdf); --hint-text: var(--organization-accent, #85561a); }
    .hint--more { --hint-soft: var(--surface-hover, #f1f3ef); --hint-text: var(--text-secondary, #52615b); }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `,
})
export class LinkHints {
  readonly items = input<readonly ConnectedObject[] | undefined>([]);
  /** Diese Art nicht zeigen (z. B. in der Reise selbst keine Reise-Marke). */
  readonly exclude = input<ConnectionObjectType | null>(null);
  readonly max = input(2);
  private readonly visible = computed(() => (this.items() ?? []).filter((o) => o.type !== this.exclude()));
  protected readonly shown = computed(() => this.visible().slice(0, this.max()));
  protected readonly more = computed(() => Math.max(0, this.visible().length - this.max()));
  protected icon(type: ConnectionObjectType): IconName {
    return ICON[type] ?? 'link';
  }
}
