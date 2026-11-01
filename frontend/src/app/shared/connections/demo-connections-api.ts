import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { BERLIN } from '../../features/reisen/demo-reisen-api';
import { ConnectedObject, ConnectionDto, ConnectionObjectType, ConnectionOption, LinkSuggestionDto } from './connections-api.service';

/** Erlaubte Paare und Standardrelation — Spiegel von backend/connections/registry.py ALLOWED_PAIRS. */
const PAIRS: [ConnectionObjectType, ConnectionObjectType, string, string][] = [
  ['SAVINGS_GOAL', 'TASK', 'TASK_FOR', 'Aufgabe für'],
  ['TASK', 'CALENDAR_EVENT', 'SCHEDULED_AS', 'Eingeplant als'],
  ['HOUSEHOLD_TASK', 'CALENDAR_EVENT', 'SCHEDULED_AS', 'Eingeplant als'],
  ['TRIP', 'SAVINGS_GOAL', 'FUNDED_BY', 'Finanziert durch'],
  ['TRIP', 'HOUSEHOLD_TASK', 'AFFECTS', 'Betrifft'],
  ['TRIP', 'TASK', 'TASK_FOR', 'Aufgabe für'],
  ['TRIP', 'CALENDAR_EVENT', 'SCHEDULED_AS', 'Eingeplant als'],
];
const LABEL: Partial<Record<ConnectionObjectType, string>> = {
  TASK: 'Aufgabe', CALENDAR_EVENT: 'Termin', SAVINGS_GOAL: 'Sparziel', HOUSEHOLD_TASK: 'Haushaltsaufgabe', TRIP: 'Reise',
};
const DOMAIN = { TASK: 'organisation', CALENDAR_EVENT: 'organisation', SAVINGS_GOAL: 'finanzen', HOUSEHOLD_TASK: 'haushalt', TRIP: 'reisen' } as const;

function day(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}
const obj = (type: keyof typeof DOMAIN, id: number | string, title: string, subtitle: string): ConnectedObject =>
  ({ type, id: id as number, title, subtitle, domain: DOMAIN[type] });

/**
 * Verknüpfungen in der Demo (31.10.2026): ein fester, kleiner Bestand passend zu den Demo-Daten — die Berlin-Reise
 * mit ihrem Termin „Museumsinsel-Führung“ und der Haushaltsaufgabe „Pflanzen gießen“, das Sparziel
 * „Badmintonschuhe“ mit der Aufgabe „Badmintonschuhe vergleichen“, dazu ein Vorschlag
 * („Bahn-Tickets ausdrucken“). Alles nur in dieser Instanz im Browser; nichts wird gespeichert oder gesendet.
 * Haushaltsaufgaben haben in der Demo Text-IDs („demo-task-1“) — die Schlüssel sind deshalb immer Text.
 */
@Injectable()
export class DemoConnectionsApi {
  private nextId = 100;
  private readonly catalog: ConnectedObject[] = [
    obj('TRIP', 1, 'Berlin Wochenende', `ab ${day(BERLIN)}`),
    obj('CALENDAR_EVENT', 8, 'Museumsinsel-Führung', `${day(BERLIN + 1)}, 11:00 · Berlin`),
    obj('HOUSEHOLD_TASK', 'demo-task-1', 'Pflanzen gießen', 'täglich'),
    obj('TASK', 9, 'Bahn-Tickets ausdrucken', `fällig ${day(BERLIN - 2)}`),
    obj('TASK', 3, 'Geschenk kaufen', 'Familie'),
    obj('CALENDAR_EVENT', 4, 'Mittagessen mit Lena', 'morgen, 12:30'),
    obj('SAVINGS_GOAL', 3, 'Badmintonschuhe', '80 von 150 €'),
    obj('TASK', 8, 'Badmintonschuhe vergleichen', 'Freizeit'),
  ];
  private links: { id: number; a: ConnectedObject; b: ConnectedObject; relation: [string, string] }[] = [
    { id: 1, a: this.find('TRIP', 1)!, b: this.find('CALENDAR_EVENT', 8)!, relation: ['SCHEDULED_AS', 'Eingeplant als'] },
    { id: 2, a: this.find('TRIP', 1)!, b: this.find('HOUSEHOLD_TASK', 'demo-task-1')!, relation: ['AFFECTS', 'Betrifft'] },
    { id: 3, a: this.find('SAVINGS_GOAL', 3)!, b: this.find('TASK', 8)!, relation: ['TASK_FOR', 'Aufgabe für'] },
  ];
  private suggestionList: { key: string; a: ConnectedObject; b: ConnectedObject; reason: string }[] = [
    {
      key: 'link:TRIP:1:TASK:9',
      a: this.find('TRIP', 1)!,
      b: this.find('TASK', 9)!,
      reason: 'Die Aufgabe gehört zur Anreise und ist kurz vor deiner Reise fällig.',
    },
  ];

  private find(type: ConnectionObjectType, id: number | string): ConnectedObject | undefined {
    return this.catalog.find((o) => o.type === type && String(o.id) === String(id));
  }
  private same(o: ConnectedObject, type: ConnectionObjectType, id: number | string): boolean {
    return o.type === type && String(o.id) === String(id);
  }
  private pair(a: ConnectionObjectType, b: ConnectionObjectType) {
    return PAIRS.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  }
  private dto(link: (typeof this.links)[number], focus?: [ConnectionObjectType, number | string]): ConnectionDto {
    const item: ConnectionDto = {
      id: link.id,
      can_delete: true,
      relation_type: link.relation[0],
      relation_label: link.relation[1],
      origin: 'MANUAL',
      created_at: new Date().toISOString(),
      source: link.a,
      target: link.b,
    };
    if (focus) item.other = this.same(link.a, ...focus) ? link.b : link.a;
    return item;
  }

  list(type: ConnectionObjectType, id: number): Observable<ConnectionDto[]> {
    return of(this.links.filter((l) => this.same(l.a, type, id) || this.same(l.b, type, id)).map((l) => this.dto(l, [type, id])));
  }
  summary(type: ConnectionObjectType, ids: readonly (number | string)[]): Observable<Record<string, ConnectedObject[]>> {
    const wanted = new Set(ids.map(String));
    const map: Record<string, ConnectedObject[]> = {};
    for (const l of this.links) {
      for (const [focus, other] of [[l.a, l.b], [l.b, l.a]] as const) {
        if (focus.type === type && wanted.has(String(focus.id))) (map[String(focus.id)] ??= []).push(other);
      }
    }
    return of(map);
  }
  options(type: ConnectionObjectType): Observable<ConnectionOption[]> {
    return of(
      PAIRS.filter(([a, b]) => a === type || b === type).map(([a, b, relation]) => {
        const partner = a === type ? b : a;
        return { type: partner, label: LABEL[partner] ?? partner, domain: DOMAIN[partner as keyof typeof DOMAIN], relation_type: relation };
      }),
    );
  }
  candidates(type: ConnectionObjectType, id: number, targetType: ConnectionObjectType, query = ''): Observable<ConnectedObject[]> {
    const q = query.trim().toLocaleLowerCase('de');
    const taken = this.links.flatMap((l) => (this.same(l.a, type, id) ? [l.b] : this.same(l.b, type, id) ? [l.a] : []));
    return of(this.catalog.filter((o) => o.type === targetType && !taken.includes(o) && (!q || o.title.toLocaleLowerCase('de').includes(q))));
  }
  create(type: ConnectionObjectType, id: number, otherType: ConnectionObjectType, otherId: number): Observable<ConnectionDto> {
    const a = this.find(type, id);
    const b = this.find(otherType, otherId);
    const pair = this.pair(type, otherType);
    if (!a || !b || !pair) return throwError(() => ({ status: 404 }));
    if (this.links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) return throwError(() => ({ status: 409 }));
    const link = { id: this.nextId++, a, b, relation: [pair[2], pair[3]] as [string, string] };
    this.links.push(link);
    this.suggestionList = this.suggestionList.filter((s) => !((s.a === a && s.b === b) || (s.a === b && s.b === a)));
    return of(this.dto(link, [type, id]));
  }
  remove(id: number): Observable<void> {
    this.links = this.links.filter((l) => l.id !== id);
    return of(undefined);
  }
  suggestions(type: ConnectionObjectType, id: number): Observable<LinkSuggestionDto[]> {
    return of(
      this.suggestionList
        .filter((s) => this.same(s.a, type, id) || this.same(s.b, type, id))
        .map((s) => ({
          key: s.key,
          reason_code: 'TRAVEL_PREPARATION',
          headline: `„${s.b.title}“ gehört vielleicht zu „${s.a.title}“`,
          reason: s.reason,
          relation_label: 'Aufgabe für',
          source: s.a,
          target: s.b,
          other: this.same(s.a, type, id) ? s.b : s.a,
        })),
    );
  }
  acceptSuggestion(key: string): Observable<ConnectionDto> {
    const s = this.suggestionList.find((x) => x.key === key);
    if (!s) return throwError(() => ({ status: 404 }));
    return this.create(s.a.type, s.a.id, s.b.type, s.b.id);
  }
  dismissSuggestion(key: string): Observable<void> {
    this.suggestionList = this.suggestionList.filter((s) => s.key !== key);
    return of(undefined);
  }
}
