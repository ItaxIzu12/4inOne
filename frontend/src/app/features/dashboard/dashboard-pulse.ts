import { IconName } from '../../shared/icons/app-icon';
import { HaushaltOverviewDto } from '../haushalt/haushalt-api.service';
import { room } from '../haushalt/aufgaben-logic';
import { FinanceSummary } from '../finanzen/data/private-finance-api.service';
import { PersonalEvent, TodayItem } from '../organisation/organisation-api.service';
import { DAY_END_MIN, clock, dayLine, nextUp, span } from '../organisation/org-day-logic';
import { localDay as orgLocalDay } from '../organisation/organisation-logic';
import { Trip } from '../reisen/reisen-api.service';
import { daysUntil, packingShare, placeParts, tripPhase } from '../reisen/reisen-logic';

/**
 * Startseite (31.10.2026) — „Vier Antworten“ und „Dein Fortschritt“. Reine Rechnungen aus den echten Daten der vier
 * Bereiche: je Bereich EINE Antwort in seiner Handschrift (Finanzen: frei bis Monatsende · Haushalt: Aufgaben heute
 * nach Räumen · Organisation: als Nächstes und Zeit ohne Termin · Reisen: Tage bis zur Abreise), dazu ehrliche Ringe aus
 * gezählten Werten und eine „Idee für heute“, die Zeit ohne Termin mit einer offenen Aufgabe verbindet. Nichts geschätzt,
 * keine Punkte, keine Serien.
 */

export type Area = 'finanzen' | 'haushalt' | 'organisation' | 'reisen';
export interface AreaAnswer {
  area: Area;
  label: string;
  icon: IconName;
  /** Die eine große Antwort, z. B. „702 €“, „3 heute“, „16:00“, „12 Tage“. */
  big: string;
  /** Ein Satz dazu. */
  line: string;
  /** Reisen: Packliste in Prozent — immer mit Beschriftung `barLabel`, nie ein Balken ohne Bedeutung. */
  pct?: number | null;
  barLabel?: string;
  /** Kein Wert vorhanden — die Karte lädt zum ersten Schritt ein. */
  empty: boolean;
  path: string;
  query: Record<string, string | number>;
}

export interface MoneyView {
  set: boolean;
  over: boolean;
  amount: string;
  perDay: string | null;
  monthName: string;
  /** Letzter Tag des Monats: ein Tagessatz sagt dann nichts (er ist der ganze Rest). */
  lastDay?: boolean;
}

/** Finanzen: was HEUTE ausgegeben wurde — die Monatszahl steht schon groß auf der Finanzen-Karte daneben. Dazu,
 * wie viel pro Tag bis Monatsende drin ist (oder dass das Budget überschritten ist). */
export function financeAnswer(
  m: MoneyView | null,
  todaySpent: number | null,
  money: (v: number) => string,
  base: string,
): AreaAnswer | null {
  if (!m || todaySpent === null) return null;
  const common = { area: 'finanzen' as const, label: 'Finanzen', icon: 'finance' as IconName, path: base + '/finanzen' };
  const big = todaySpent > 0 ? money(todaySpent) : '0 €';
  const spent = todaySpent > 0 ? 'heute ausgegeben' : 'heute noch nichts ausgegeben';
  if (!m.set) return { ...common, big, line: `${spent} · ohne Monatsbudget`, empty: false, query: { tab: 'transactions' } };
  if (m.over) return { ...common, big, line: `${spent} · Budget im ${m.monthName} überschritten`, empty: false, query: { tab: 'transactions' } };
  return { ...common, big, line: m.perDay && !m.lastDay ? `${spent} · ${m.perDay} pro Tag drin` : `${spent} · ${m.amount} übrig im ${m.monthName}`, empty: false, query: { tab: 'transactions' } };
}

/** Summe der Ausgaben eines Tages aus den Transaktionen (nur Typ EXPENSE). */
export function spentOn(transactions: readonly { amount: string; type: 'INCOME' | 'EXPENSE'; date: string }[] | null, day: string): number | null {
  if (transactions === null) return null;
  return transactions.filter((t) => t.type === 'EXPENSE' && t.date === day).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
}

export function householdAnswer(h: HaushaltOverviewDto | null, base: string): AreaAnswer | null {
  if (!h) return null;
  const today = h.today ?? [];
  const common = { area: 'haushalt' as const, label: 'Haushalt', icon: 'household' as IconName, path: base + '/haushalt' };
  if (!today.length) {
    return { ...common, big: 'Alles erledigt', line: h.open_tasks ? `${h.open_tasks} später fällig` : 'Heute steht nichts an', empty: !h.open_tasks, query: {} };
  }
  // In Worten statt Feldern: „1 überfällig (Wohnzimmer) · 2 heute fällig“
  const late = today.filter((t) => t.is_overdue);
  const due = today.length - late.length;
  const where = late.length === 1 ? room(late[0].room)?.label : null;
  const parts = [
    ...(late.length ? [`${late.length} überfällig${where ? ` (${where})` : ''}`] : []),
    ...(due ? [`${due} heute fällig`] : []),
  ];
  return {
    ...common,
    big: today.length === 1 ? '1 Aufgabe' : `${today.length} Aufgaben`,
    line: parts.join(' · '),
    empty: false,
    query: { tab: 'aufgaben' },
  };
}

/** Termine des Tages (mit Ende) → als Nächstes und freie Zeit; ohne Termine die Zahl der Aufgaben. */
export function organisationAnswer(events: readonly PersonalEvent[] | null, items: readonly TodayItem[] | null, now: Date, base: string): AreaAnswer | null {
  if (events === null && items === null) return null;
  const common = { area: 'organisation' as const, label: 'Organisation', icon: 'calendar' as IconName, path: base + '/organisation' };
  const day = orgLocalDay(now);
  const list = events ?? [];
  const next = nextUp(list, now);
  const line = dayLine(list, day, now);
  const evening = now.getHours() * 60 + now.getMinutes() >= DAY_END_MIN;
  const free = !evening && line.free ? `${span(line.free)} ohne Termin` : '';
  const tasks = (items ?? []).filter((i) => i.kind === 'task');
  if (next) {
    const start = new Date(next.event.starts_at);
    const running = next.text.startsWith('läuft');
    return {
      ...common,
      big: running ? 'Jetzt' : clock(start.getHours() * 60 + start.getMinutes()),
      line: [next.event.title, free].filter(Boolean).join(' · '),
      empty: false,
      query: {},
    };
  }
  if (tasks.length) {
    return { ...common, big: tasks.length === 1 ? '1 Aufgabe' : `${tasks.length} Aufgaben`, line: 'heute fällig · keine Termine mehr', empty: false, query: { tab: 'tasks' } };
  }
  return { ...common, big: 'Keine Termine', line: 'Heute ist nichts mehr eingetragen', empty: true, query: {} };
}

export function travelAnswer(trip: Trip | null, today: string, base: string): AreaAnswer {
  const common = { area: 'reisen' as const, label: 'Reisen', icon: 'travel' as IconName, path: base + '/reisen' };
  if (!trip) return { ...common, big: 'Wohin?', line: 'Plane die nächste Reise', pct: null, empty: true, query: { neu: 'reise' } };
  const to = placeParts(trip.destination).place || trip.title;
  const packing = packingShare(trip.packing_packed, trip.packing_total);
  const phase = tripPhase(trip, today);
  const days = daysUntil(trip.start_date, today);
  const big = phase === 'ongoing' ? 'Unterwegs' : days === 0 ? 'Heute' : days === 1 ? 'Morgen' : `${days} Tage`;
  const tasks = trip.tasks_open ? ` · ${trip.tasks_open === 1 ? '1 Aufgabe' : trip.tasks_open + ' Aufgaben'} offen` : '';
  const line = phase === 'ongoing' ? `in ${to}` : `bis ${to}${tasks}`;
  return {
    ...common,
    big,
    line,
    pct: phase === 'ongoing' ? null : packing?.pct ?? null,
    barLabel: packing ? `Packliste ${packing.packed} von ${packing.total}` : undefined,
    empty: false,
    query: { trip: trip.id },
  };
}

// ---------- Dein Fortschritt ----------
export interface Ring {
  area: Area;
  label: string;
  /** 0–100, gezählt — nie geschätzt. */
  pct: number;
  value: string;
  detail: string;
}

/** Drei Ringe aus gezählten Werten; ein Ring fehlt, wenn es seine Grundlage nicht gibt. */
export function progressRings(
  h: HaushaltOverviewDto | null,
  f: Pick<FinanceSummary, 'saved' | 'saved_planned'> | null,
  trip: Trip | null,
  money: (v: number) => string,
): Ring[] {
  const rings: Ring[] = [];
  if (h) {
    const done = h.summary?.done_this_week ?? 0;
    const open = (h.summary?.due_today ?? 0) + (h.summary?.overdue_tasks ?? 0);
    if (done + open > 0) {
      rings.push({
        area: 'haushalt',
        label: 'Haushalt diese Woche',
        pct: Math.round((done / (done + open)) * 100),
        value: `${done} erledigt`,
        detail: open ? `${open} noch offen` : 'nichts mehr offen',
      });
    }
  }
  if (f) {
    const planned = Number(f.saved) || 0;
    const booked = Math.max(0, planned - (Number(f.saved_planned) || 0));
    if (planned > 0) {
      rings.push({
        area: 'finanzen',
        label: 'Gespart diesen Monat',
        pct: Math.min(100, Math.round((booked / planned) * 100)),
        value: money(booked),
        detail: `von ${money(planned)} geplant`,
      });
    }
  }
  if (trip) {
    // Nur die Packliste — Aufgaben stehen getrennt (ein T-Shirt wiegt nicht wie eine Buchung)
    const packing = packingShare(trip.packing_packed, trip.packing_total);
    if (packing) {
      rings.push({
        area: 'reisen',
        label: `Gepackt für ${placeParts(trip.destination).place || trip.title}`,
        pct: packing.pct,
        value: `${packing.packed} von ${packing.total}`,
        detail: trip.tasks_open ? `dazu ${trip.tasks_open === 1 ? '1 Aufgabe' : trip.tasks_open + ' Aufgaben'} offen` : 'Packliste',
      });
    }
  }
  return rings;
}

// ---------- Idee für heute ----------
export interface Idea {
  text: string;
  /** Die Aufgabe, um die es geht (öffnet sie in der Organisation). */
  task: { id: number; title: string };
}

/**
 * Zeit ohne Termin + offene Aufgabe = ein konkreter Vorschlag: „Bis 16:00 ist nichts eingetragen – passt für „…“.“
 * Bewusst „nichts eingetragen“ statt „frei“: die App kennt nur ihre eigenen Termine.
 * Nur, wenn heute noch eine Lücke ab 30 Min. kommt und eine heute fällige oder überfällige Aufgabe offen ist
 * (überfällige zuerst). Sonst keine Idee — lieber nichts als eine erfundene.
 */
export function ideaForToday(events: readonly PersonalEvent[] | null, items: readonly TodayItem[] | null, now: Date): Idea | null {
  const tasks = (items ?? []).filter((i) => i.kind === 'task' && i.status !== 'DONE');
  if (!tasks.length) return null;
  const line = dayLine(events ?? [], orgLocalDay(now), now);
  const gap = line.items.find((i) => i.kind === 'free');
  if (!gap || gap.kind !== 'free') return null;
  const task = [...tasks].sort((a, b) => Number(b.overdue) - Number(a.overdue))[0];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const starting = gap.start <= nowMin + 5;
  const late = task.overdue ? ', das schon überfällig ist' : '';
  const span_ = gap.open
    ? starting ? 'Heute ist nichts mehr eingetragen' : `Ab ${clock(gap.start)} ist nichts mehr eingetragen`
    : starting ? `Bis ${clock(gap.end)} ist nichts eingetragen` : `Zwischen ${clock(gap.start)} und ${clock(gap.end)} ist nichts eingetragen`;
  return {
    text: `${span_} – passt für „${task.title}“${late}.`,
    task: { id: task.id, title: task.title },
  };
}

