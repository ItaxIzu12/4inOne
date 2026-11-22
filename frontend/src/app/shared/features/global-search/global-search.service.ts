import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { API_BASE_URL } from '../../../core/api.config';
import { DEMO_MODE } from '../../../core/demo-context';
import { PrivateFinanceApi } from '../../../features/finance/data/private-finance-api.service';
import { HAUSHALT_DATA_PROVIDER } from '../../../features/household/data/household-data-provider';
import { OrganisationApi } from '../../../features/organization/data/organization-api.service';
import { ReisenApi } from '../../../features/travel/data/travel-api.service';

/** O4 – ein Treffer der globalen Suche (backend/connections/search.py). */
export interface SearchItem {
  type: string;
  id: number | string;
  title: string;
  subtitle: string;
  domain: 'finanzen' | 'haushalt' | 'organisation' | 'reisen' | string;
  link: { path: string; query: Record<string, string> };
}
export interface SearchGroup {
  type: string;
  label: string;
  domain: string;
  items: SearchItem[];
}
export interface SearchResult {
  /** Nur in der Demo gesetzt; der Server gibt den Suchbegriff nicht zurück. */
  query?: string;
  groups: SearchGroup[];
}

export const SEARCH_MIN_LENGTH = 2;
const PER_KIND = 5;

/**
 * Angemeldet fragt die Suche den Server (er kennt die Rechte, docs/GLOBAL_SEARCH.md). In der Demo gibt es keinen
 * Server: dann werden die Beispieldaten derselben Demo-Schnittstellen durchsucht, die auch die Seiten zeigen.
 */
@Injectable()
export class GlobalSearchService {
  private readonly http = inject(HttpClient);
  private readonly demo = inject(DEMO_MODE);
  private readonly org = inject(OrganisationApi, { optional: true });
  private readonly finance = inject(PrivateFinanceApi, { optional: true });
  private readonly travel = inject(ReisenApi, { optional: true });
  private readonly household = inject(HAUSHALT_DATA_PROVIDER, { optional: true });

  search(query: string): Observable<SearchResult> {
    const q = query.trim();
    if (q.length < SEARCH_MIN_LENGTH) return of({ query: q, groups: [] });
    if (!this.demo) return this.http.get<SearchResult>(`${API_BASE_URL}/search/`, { params: { q } });
    return this.demoSearch(q);
  }

  private demoSearch(q: string): Observable<SearchResult> {
    const needle = q.toLocaleLowerCase('de');
    const hit = (...texts: (string | null | undefined)[]) => texts.some((t) => (t ?? '').toLocaleLowerCase('de').includes(needle));
    const safe = <T>(source: Observable<T[]> | undefined) => (source ?? of([] as T[])).pipe(catchError(() => of([] as T[])));
    const month = new Date().toISOString().slice(0, 7);
    return forkJoin({
      tasks: safe(this.org?.tasks()),
      notes: safe(this.org?.notes()),
      householdTasks: safe(this.household?.getTasks()),
      folder: safe(this.household?.getFolder()),
      trips: safe(this.travel?.trips()),
      goals: safe(this.finance?.goals(month)),
      transactions: safe(this.finance?.transactions()),
    }).pipe(
      map((d) => {
        const group = (type: string, label: string, domain: string, items: SearchItem[]): SearchGroup | null =>
          items.length ? { type, label, domain, items: items.slice(0, PER_KIND) } : null;
        const groups = [
          group('TASK', 'Aufgabe', 'organisation', d.tasks.filter((t) => hit(t.title)).map((t) => ({
            type: 'TASK', id: t.id, title: t.title, subtitle: t.due_date ? `Fällig ${dm(t.due_date)}` : 'Ohne Datum', domain: 'organisation',
            link: { path: '/organisation', query: { kind: 'task', id: String(t.id) } },
          }))),
          group('NOTE', 'Notiz', 'organisation', d.notes.filter((n) => hit(n.title, n.body)).map((n) => ({
            type: 'NOTE', id: n.id, title: n.title || (n.body ?? '').split('\n')[0].slice(0, 80) || 'Notiz ohne Titel', subtitle: n.pinned ? 'Angeheftet' : 'Notiz',
            domain: 'organisation', link: { path: '/organisation', query: { kind: 'note', id: String(n.id) } },
          }))),
          group('HOUSEHOLD_TASK', 'Haushaltsaufgabe', 'haushalt', d.householdTasks.filter((t) => hit(t.title)).map((t) => ({
            type: 'HOUSEHOLD_TASK', id: t.id, title: t.title, subtitle: t.due_date ? `Fällig ${dm(t.due_date)}` : 'Ohne Datum', domain: 'haushalt',
            link: { path: '/haushalt', query: { tab: 'aufgaben', task: String(t.id) } },
          }))),
          group('DEVICE', 'Gerät', 'haushalt', d.folder.filter((e) => e.kind === 'geraet' && hit(e.name)).map((e) => ({
            type: 'DEVICE', id: e.id, title: e.name, subtitle: e.provider || 'Gerät', domain: 'haushalt',
            link: { path: '/haushalt', query: { tab: 'zuhause', bereich: 'geraete', entry: String(e.id) } },
          }))),
          group('CONTRACT', 'Vertrag', 'haushalt', d.folder.filter((e) => e.kind === 'vertrag' && hit(e.name)).map((e) => ({
            type: 'CONTRACT', id: e.id, title: e.name, subtitle: e.provider || e.category || 'Vertrag', domain: 'haushalt',
            link: { path: '/haushalt', query: { tab: 'zuhause', bereich: 'vertraege', entry: String(e.id) } },
          }))),
          group('TRIP', 'Reise', 'reisen', d.trips.filter((t) => hit(t.title, t.destination)).map((t) => ({
            type: 'TRIP', id: t.id, title: t.title, subtitle: `${t.destination ? t.destination + ', ' : ''}${dm(t.start_date)} – ${dm(t.end_date)}`, domain: 'reisen',
            link: { path: '/reisen', query: { trip: String(t.id) } },
          }))),
          group('SAVINGS_GOAL', 'Sparziel', 'finanzen', d.goals.filter((g) => hit(g.title)).map((g) => ({
            type: 'SAVINGS_GOAL', id: g.id, title: g.title, subtitle: `${euro(g.current_amount)} von ${euro(g.target_amount)}`, domain: 'finanzen',
            link: { path: '/finanzen', query: { tab: 'goals', goal: String(g.id) } },
          }))),
          group('TRANSACTION', 'Buchung', 'finanzen', d.transactions.filter((t) => hit(t.note)).map((t) => ({
            type: 'TRANSACTION', id: t.id, title: t.note, subtitle: `${dm(t.date)} · ${t.type === 'INCOME' ? '+' : '−'}${euro(t.amount)}`, domain: 'finanzen',
            link: { path: '/finanzen', query: { tab: 'transactions', buchung: String(t.id) } },
          }))),
        ].filter((g): g is SearchGroup => g !== null);
        return { query: q, groups };
      }),
    );
  }
}

function dm(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}
function euro(value: string | number): string {
  return `${Number(value).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
