import { Injectable, Injector, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { PrivateFinanceApi } from '../../features/finanzen/data/private-finance-api.service';
import { HAUSHALT_DATA_PROVIDER } from '../../features/haushalt/haushalt-data-provider';
import { OrganisationApi } from '../../features/organisation/organisation-api.service';
import { ReisenApi } from '../../features/reisen/reisen-api.service';
import { RelevanceFacts, URGENT_EVERY_DAYS, commonWord, dueDuring, fits } from './connection-relevance';
import { ConnectedObject, ConnectionDto, ConnectionObjectType, ConnectionOption, LinkSuggestionDto } from './connections-api.service';

/** Erlaubte Paare (Quelle, Ziel, Standardrelation, Bezeichnung) — Spiegel von backend/connections/registry.py
 *  ALLOWED_PAIRS und models.RelationType (geprüft in backend/connections/tests/test_demo_mirror.py). */
export const DEMO_PAIRS: [ConnectionObjectType, ConnectionObjectType, string, string][] = [
  ['SAVINGS_GOAL', 'TASK', 'TASK_FOR', 'Aufgabe für'],
  ['TASK', 'CALENDAR_EVENT', 'SCHEDULED_AS', 'Eingeplant als'],
  ['HOUSEHOLD_TASK', 'CALENDAR_EVENT', 'SCHEDULED_AS', 'Eingeplant als'],
  ['TRIP', 'SAVINGS_GOAL', 'FUNDED_BY', 'Finanziert durch'],
  ['TRIP', 'HOUSEHOLD_TASK', 'AFFECTS', 'Betrifft'],
  ['TRIP', 'TASK', 'TASK_FOR', 'Aufgabe für'],
  ['TRIP', 'CALENDAR_EVENT', 'SCHEDULED_AS', 'Eingeplant als'],
  ['DEVICE', 'SAVINGS_GOAL', 'FUNDED_BY', 'Finanziert durch'],
  ['CONTRACT', 'TASK', 'TASK_FOR', 'Aufgabe für'],
  ['DEVICE', 'HOUSEHOLD_TASK', 'TASK_FOR', 'Aufgabe für'],
  ['DEVICE', 'TASK', 'TASK_FOR', 'Aufgabe für'],
  ['TRIP', 'CONTRACT', 'RELATED_TO', 'Gehört zusammen'],
];
const LABEL: Partial<Record<ConnectionObjectType, string>> = {
  TASK: 'Aufgabe', CALENDAR_EVENT: 'Termin', SAVINGS_GOAL: 'Sparziel', HOUSEHOLD_TASK: 'Haushaltsaufgabe', TRIP: 'Reise',
  DEVICE: 'Gerät', CONTRACT: 'Vertrag',
};
const DOMAIN: Partial<Record<ConnectionObjectType, ConnectedObject['domain']>> = {
  TASK: 'organisation', CALENDAR_EVENT: 'organisation', SAVINGS_GOAL: 'finanzen', HOUSEHOLD_TASK: 'haushalt', TRIP: 'reisen',
  DEVICE: 'haushalt', CONTRACT: 'haushalt',
};

type Ref = { type: ConnectionObjectType; id: string };
interface Entry {
  obj: ConnectedObject;
  facts: RelevanceFacts;
  /** Für die Vorschläge: offen (nicht erledigt/pausiert), Wiederholung, Reise steht bevor oder läuft */
  open?: boolean;
  every?: { days?: number | null; months?: number | null };
}
interface DemoLink {
  id: number;
  a: Ref;
  b: Ref;
  relation: [string, string];
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** „13.11.“ wie das Backend (registry._date). */
function dm(isoDay: string): string {
  return `${isoDay.slice(8, 10)}.${isoDay.slice(5, 7)}.`;
}
function euro(value: string | number): string {
  return `${Number(value).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
const ref = (type: ConnectionObjectType, id: number | string): Ref => ({ type, id: String(id) });
const same = (r: Ref, type: ConnectionObjectType, id: number | string) => r.type === type && r.id === String(id);

/**
 * Verknüpfungen in der Demo (neu 14.11.2026): Der Bestand kommt **live aus den Demo-Daten der Bereiche** (Reisen,
 * Termine, Aufgaben, Sparziele, Haushaltsaufgaben, Geräte, Verträge) – auch in der Demo neu Angelegtes lässt sich
 * verknüpfen, Gelöschtes verschwindet samt Verknüpfung (wie backend/connections/signals.py). Erlaubte Paare und die
 * „Passt dazu“-Regel (connection-relevance.ts) sind dieselben wie im Backend. Vorab verknüpft: Berlin-Reise mit dem
 * Termin „Museumsinsel-Führung“ und der Haushaltsaufgabe „Pflanzen gießen“, das Sparziel „Badmintonschuhe“ mit der
 * Aufgabe „Badmintonschuhe vergleichen“; ein Vorschlag „Bahn-Tickets ausdrucken“. Nur im Browser, nichts wird
 * gespeichert oder gesendet. Haushaltsaufgaben und Ordner haben Text-IDs („demo-task-1“) – Schlüssel sind immer Text.
 */
@Injectable()
export class DemoConnectionsApi {
  // lazy: die Demo-Dienste brauchen sich nicht gegenseitig im Konstruktor
  private readonly injector = inject(Injector);
  private nextId = 100;
  private links: DemoLink[] = [
    { id: 1, a: ref('TRIP', 1), b: ref('CALENDAR_EVENT', 8), relation: ['SCHEDULED_AS', 'Eingeplant als'] },
    { id: 2, a: ref('TRIP', 1), b: ref('HOUSEHOLD_TASK', 'demo-task-1'), relation: ['AFFECTS', 'Betrifft'] },
    { id: 3, a: ref('SAVINGS_GOAL', 3), b: ref('TASK', 8), relation: ['TASK_FOR', 'Aufgabe für'] },
  ];
  private dismissed = new Set<string>();
  private suggestionList: { key: string; a: Ref; b: Ref; reason: string }[] = [
    { key: 'link:TRIP:1:TASK:9', a: ref('TRIP', 1), b: ref('TASK', 9), reason: 'Die Aufgabe gehört zur Anreise und ist kurz vor deiner Reise fällig.' },
  ];

  // ---------- Bestand aus den anderen Demo-Bereichen (Demo-Observables liefern sofort) ----------
  private sync<T>(source: Observable<T>, fallback: T): T {
    let value = fallback;
    source.subscribe({ next: (v) => (value = v), error: () => undefined });
    return value;
  }
  private catalog(): Entry[] {
    const today = new Date();
    const entries: Entry[] = [];
    for (const t of this.sync(this.injector.get(ReisenApi).trips(), [])) {
      const when = `${dm(t.start_date)} – ${dm(t.end_date)}`;
      entries.push({
        obj: { type: 'TRIP', id: t.id, title: t.title, subtitle: t.destination ? `${t.destination}, ${when}` : when, domain: 'reisen' },
        facts: { type: 'TRIP', text: `${t.title} ${t.destination}`, day: null, start: t.start_date, end: t.end_date },
        open: t.end_date >= iso(today) && (t.status === 'PLANNED' || t.status === 'CONFIRMED'),
      });
    }
    const org = this.injector.get(OrganisationApi);
    const from = new Date(today);
    from.setDate(from.getDate() - 60);
    const to = new Date(today);
    to.setDate(to.getDate() + 400);
    const seen = new Set<number>();
    for (const e of this.sync(org.events({ start: iso(from), end: iso(to) }), [])) {
      if (e.id < 0 || seen.has(e.id) || e.can_edit === false) continue; // Wiederholungen einmal; Fremdes nicht verknüpfbar
      seen.add(e.id);
      const start = new Date(e.starts_at);
      const hhmm = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
      entries.push({
        obj: { type: 'CALENDAR_EVENT', id: e.id, title: e.title, subtitle: `${dm(iso(start))}, ${hhmm} Uhr`, domain: 'organisation' },
        facts: { type: 'CALENDAR_EVENT', text: e.title, day: iso(start) },
      });
    }
    for (const t of this.sync(org.tasks(), [])) {
      const subtitle =
        t.status === 'DONE' ? 'Erledigt' : !t.due_date ? 'Ohne Datum' : `Fällig ${dm(t.due_date)}${t.due_time ? `, ${t.due_time.slice(0, 5)} Uhr` : ''}`;
      entries.push({
        obj: { type: 'TASK', id: t.id, title: t.title, subtitle, domain: 'organisation' },
        facts: { type: 'TASK', text: t.title, day: t.due_date },
        open: t.status !== 'DONE',
      });
    }
    for (const g of this.sync(this.injector.get(PrivateFinanceApi).goals(iso(today).slice(0, 7)), [])) {
      entries.push({
        obj: { type: 'SAVINGS_GOAL', id: g.id, title: g.title, subtitle: `${euro(g.current_amount)} von ${euro(g.target_amount)}`, domain: 'finanzen' },
        facts: { type: 'SAVINGS_GOAL', text: g.title, day: g.target_date },
        open: g.status !== 'COMPLETED',
      });
    }
    const haushalt = this.injector.get(HAUSHALT_DATA_PROVIDER);
    for (const t of this.sync(haushalt.getTasks(), [])) {
      const subtitle = t.is_done ? 'Erledigt' : t.due_date ? `Fällig ${dm(t.due_date)}` : 'Ohne Datum';
      entries.push({
        obj: { type: 'HOUSEHOLD_TASK', id: t.id as number, title: t.title, subtitle, domain: 'haushalt' },
        facts: { type: 'HOUSEHOLD_TASK', text: t.title, day: t.due_date, recurring: !!(t.recurrence_days || t.recurrence_months) },
        open: !t.is_done && !(t as { is_paused?: boolean }).is_paused,
        every: { days: t.recurrence_days, months: t.recurrence_months },
      });
    }
    for (const f of this.sync(haushalt.getFolder(), [])) {
      const type: ConnectionObjectType = f.kind === 'geraet' ? 'DEVICE' : 'CONTRACT';
      const model = (f as { model?: string }).model;
      const subtitle = type === 'DEVICE' ? [f.provider, model].filter(Boolean).join(' · ') || 'Gerät' : f.provider || f.category || 'Vertrag';
      entries.push({
        obj: { type, id: f.id as number, title: f.name, subtitle, domain: 'haushalt' },
        facts: { type, text: `${f.name} ${f.provider ?? ''}`, day: null },
      });
    }
    return entries;
  }
  private entry(catalog: Entry[], r: Ref): Entry | undefined {
    return catalog.find((e) => e.obj.type === r.type && String(e.obj.id) === r.id);
  }
  private pair(a: ConnectionObjectType, b: ConnectionObjectType) {
    return DEMO_PAIRS.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  }
  /** Nur Verknüpfungen, deren beide Seiten es (noch) gibt – Gelöschtes nimmt seine Verknüpfungen mit. */
  private live(catalog: Entry[]): { link: DemoLink; a: ConnectedObject; b: ConnectedObject }[] {
    this.links = this.links.filter((l) => this.entry(catalog, l.a) && this.entry(catalog, l.b));
    return this.links.map((link) => ({ link, a: this.entry(catalog, link.a)!.obj, b: this.entry(catalog, link.b)!.obj }));
  }
  private dto(row: { link: DemoLink; a: ConnectedObject; b: ConnectedObject }, focus?: Ref): ConnectionDto {
    const item: ConnectionDto = {
      id: row.link.id,
      can_delete: true,
      relation_type: row.link.relation[0],
      relation_label: row.link.relation[1],
      origin: 'MANUAL',
      created_at: new Date().toISOString(),
      source: row.a,
      target: row.b,
    };
    if (focus) item.other = same(row.link.a, focus.type, focus.id) ? row.b : row.a;
    return item;
  }

  list(type: ConnectionObjectType, id: number): Observable<ConnectionDto[]> {
    const focus = ref(type, id);
    return of(
      this.live(this.catalog())
        .filter((r) => same(r.link.a, type, id) || same(r.link.b, type, id))
        .map((r) => this.dto(r, focus)),
    );
  }
  summary(type: ConnectionObjectType, ids: readonly (number | string)[]): Observable<Record<string, ConnectedObject[]>> {
    const wanted = new Set(ids.map(String));
    const map: Record<string, ConnectedObject[]> = {};
    for (const r of this.live(this.catalog())) {
      for (const [focus, other] of [[r.a, r.b], [r.b, r.a]] as const) {
        if (focus.type === type && wanted.has(String(focus.id))) (map[String(focus.id)] ??= []).push(other);
      }
    }
    return of(map);
  }
  options(type: ConnectionObjectType): Observable<ConnectionOption[]> {
    return of(
      DEMO_PAIRS.filter(([a, b]) => a === type || b === type).map(([a, b, relation]) => {
        const partner = a === type ? b : a;
        return { type: partner, label: LABEL[partner] ?? partner, domain: DOMAIN[partner]!, relation_type: relation };
      }),
    );
  }
  candidates(type: ConnectionObjectType, id: number, targetType: ConnectionObjectType, query = ''): Observable<ConnectedObject[]> {
    if (!this.pair(type, targetType)) return throwError(() => ({ status: 400 }));
    const catalog = this.catalog();
    const anchor = this.entry(catalog, ref(type, id));
    if (!anchor) return throwError(() => ({ status: 404 }));
    const q = query.trim().toLocaleLowerCase('de');
    const taken = new Set(
      this.live(catalog).flatMap((r) =>
        same(r.link.a, type, id) ? [`${r.link.b.type}:${r.link.b.id}`] : same(r.link.b, type, id) ? [`${r.link.a.type}:${r.link.a.id}`] : [],
      ),
    );
    return of(
      catalog
        .filter((e) => e.obj.type === targetType && !taken.has(`${e.obj.type}:${e.obj.id}`))
        .filter((e) => !q || e.obj.title.toLocaleLowerCase('de').includes(q))
        .map((e) => {
          // Namen der anderen Geräte – wie das Backend (services.candidates_for)
          const devices = catalog
            .filter((d) => d.obj.type === 'DEVICE' && d !== anchor && d !== e)
            .map((d) => d.obj.title);
          return { ...e.obj, fits: fits(anchor.facts, e.facts, devices) };
        })
        .sort((x, y) => Number(y.fits) - Number(x.fits)),
    );
  }
  create(type: ConnectionObjectType, id: number, otherType: ConnectionObjectType, otherId: number): Observable<ConnectionDto> {
    const catalog = this.catalog();
    const pair = this.pair(type, otherType);
    if (!pair || same(ref(type, id), otherType, otherId)) return throwError(() => ({ status: 400 }));
    if (!this.entry(catalog, ref(type, id)) || !this.entry(catalog, ref(otherType, otherId))) return throwError(() => ({ status: 404 }));
    // gespeichert in der Richtung des Paars – wie das Backend, damit A↔B und B↔A dieselbe Verknüpfung sind
    const [a, b] = pair[0] === type ? [ref(type, id), ref(otherType, otherId)] : [ref(otherType, otherId), ref(type, id)];
    if (this.links.some((l) => same(l.a, a.type, a.id) && same(l.b, b.type, b.id))) return throwError(() => ({ status: 409 }));
    const link: DemoLink = { id: this.nextId++, a, b, relation: [pair[2], pair[3]] };
    this.links.push(link);
    this.suggestionList = this.suggestionList.filter((s) => !(same(s.a, a.type, a.id) && same(s.b, b.type, b.id)));
    return of(this.dto({ link, a: this.entry(catalog, a)!.obj, b: this.entry(catalog, b)!.obj }, ref(type, id)));
  }
  remove(id: number): Observable<void> {
    this.links = this.links.filter((l) => l.id !== id);
    return of(undefined);
  }
  /** Wie backend link_suggestions.rule_goal_task und rule_trip_household_task (14.11.2026), dazu ein fester
   *  Beispielvorschlag (Reise ↔ Aufgabe „Bahn-Tickets ausdrucken“). Schon Verknüpftes und Abgelehntes fehlen. */
  private computedSuggestions(catalog: Entry[]): { key: string; a: Ref; b: Ref; reason: string; headline: string; score: number; relation: string }[] {
    const today = iso(new Date());
    const out: { key: string; a: Ref; b: Ref; reason: string; headline: string; score: number; relation: string }[] = [];
    const goals = catalog.filter((e) => e.obj.type === 'SAVINGS_GOAL' && e.open);
    const tasks = catalog.filter((e) => e.obj.type === 'TASK' && e.open);
    for (const g of goals) {
      for (const t of tasks) {
        const hit = commonWord(g.obj.title, t.obj.title, 4);
        if (!hit) continue;
        out.push({
          key: `link:SAVINGS_GOAL:${g.obj.id}:TASK:${t.obj.id}`, a: ref('SAVINGS_GOAL', g.obj.id), b: ref('TASK', t.obj.id),
          headline: `„${t.obj.title}“ könnte zu deinem Sparziel „${g.obj.title}“ gehören.`, reason: `Beide erwähnen „${hit.word}“.`,
          score: hit.exact ? 0.8 : 0.7, relation: 'Aufgabe für',
        });
      }
    }
    const trips = catalog.filter((e) => e.obj.type === 'TRIP' && e.open);
    const chores = catalog.filter((e) => e.obj.type === 'HOUSEHOLD_TASK' && e.open);
    for (const trip of trips) {
      const from = trip.facts.start! > today ? trip.facts.start! : today;
      for (const c of chores) {
        // nur, was nicht warten kann: alle 1–3 Tage oder einmalig in der Reisezeit (wie das Backend)
        const every = c.every ?? {};
        const urgent = (!!every.days && every.days <= URGENT_EVERY_DAYS) || (!every.days && !every.months);
        if (!urgent) continue;
        const day = dueDuring(c.facts.day, every, from, trip.facts.end!);
        if (!day) continue;
        out.push({
          key: `link:TRIP:${trip.obj.id}:HOUSEHOLD_TASK:${c.obj.id}`, a: ref('TRIP', trip.obj.id), b: ref('HOUSEHOLD_TASK', c.obj.id),
          headline: `„${c.obj.title}“ wird während deiner Reise „${trip.obj.title}“ fällig.`,
          reason: `Fällig am ${dm(day)}, während du unterwegs bist – kläre, wer sich darum kümmert.`,
          score: 0.7, relation: 'Betrifft',
        });
      }
    }
    return out;
  }
  suggestions(type: ConnectionObjectType, id: number): Observable<LinkSuggestionDto[]> {
    const catalog = this.catalog();
    const linked = new Set(this.live(catalog).map((r) => `${r.link.a.type}:${r.link.a.id}:${r.link.b.type}:${r.link.b.id}`));
    const all = [
      ...this.suggestionList.map((s) => ({ ...s, headline: '', score: 0.7, relation: 'Aufgabe für' })),
      ...this.computedSuggestions(catalog),
    ];
    return of(
      all
        .filter((s) => (same(s.a, type, id) || same(s.b, type, id)) && this.entry(catalog, s.a) && this.entry(catalog, s.b))
        .filter((s) => !this.dismissed.has(s.key) && !linked.has(`${s.a.type}:${s.a.id}:${s.b.type}:${s.b.id}`))
        .filter((s, i, list) => list.findIndex((x) => x.key === s.key) === i)
        .sort((x, y) => y.score - x.score)
        .slice(0, 3)
        .map((s) => {
          const a = this.entry(catalog, s.a)!.obj;
          const b = this.entry(catalog, s.b)!.obj;
          return {
            key: s.key,
            reason_code: 'MATCHING_TITLE',
            headline: s.headline || `„${b.title}“ gehört vielleicht zu „${a.title}“`,
            reason: s.reason,
            relation_label: s.relation,
            source: a,
            target: b,
            other: same(s.a, type, id) ? b : a,
          };
        }),
    );
  }
  acceptSuggestion(key: string): Observable<ConnectionDto> {
    const s = [...this.suggestionList, ...this.computedSuggestions(this.catalog())].find((x) => x.key === key);
    if (!s) return throwError(() => ({ status: 404 }));
    return this.create(s.a.type, s.a.id as unknown as number, s.b.type, s.b.id as unknown as number);
  }
  dismissSuggestion(key: string): Observable<void> {
    this.dismissed.add(key);
    return of(undefined);
  }
}
