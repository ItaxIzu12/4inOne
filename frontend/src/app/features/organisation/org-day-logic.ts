import { PersonalEvent, PersonalTask } from './organisation-api.service';
import { localDay } from './organisation-logic';

/**
 * Organisation › Heute — „Dein Tag, Stunde für Stunde“ (31.10.2026). Reine Rechnungen aus den echten Terminen und
 * Aufgaben: die Tageslinie (Termine in zeitlicher Folge, dazwischen die freie Zeit), was als Nächstes kommt und was
 * an Aufgaben heute ansteht. Nichts wird geschätzt; freie Zeit ist nur die Lücke zwischen eingetragenen Terminen
 * innerhalb des Tagesfensters.
 */

/** Tagesfenster, in dem freie Zeit gezählt wird (07:00–22:00). */
export const DAY_START_MIN = 7 * 60;
export const DAY_END_MIN = 22 * 60;
/** Lücken unter 30 Minuten zählen nicht. Angezeigt wird „ohne Termin“, nie „frei“ — die App kennt nur eingetragene
 * Termine, nicht Arbeit, Wege oder Kalender außerhalb von 4inOne (Abnahme 31.10.2026). */
export const MIN_GAP = 30;

export type LineItem =
  | { kind: 'event'; event: PersonalEvent; start: number; end: number; past: boolean; now: boolean }
  | { kind: 'free'; start: number; end: number; minutes: number; open: boolean };

const minutesOf = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
export const clock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** „45 Min.“ · „2 Std.“ · „2 Std. 15 Min.“ */
export function span(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} Min.`;
  return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
}

/**
 * Tageslinie für `day`: zeitlich sortierte Termine (ganztägige gesondert) und freie Lücken ab 30 Min. dazwischen.
 * Heute beginnt die freie Zeit frühestens jetzt (vergangene Zeit ist nicht mehr frei); der letzte Abschnitt „ab …
 * frei“ reicht bis 22:00. Mehrtägige Termine laufen ab Tagesbeginn bzw. bis Tagesende.
 */
export function dayLine(events: readonly PersonalEvent[], day: string, now: Date = new Date()): { items: LineItem[]; allDay: PersonalEvent[]; free: number } {
  const isToday = localDay(now) === day;
  const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : localDay(now) > day ? DAY_END_MIN : 0;
  const allDay: PersonalEvent[] = [];
  const timed: { event: PersonalEvent; start: number; end: number }[] = [];
  for (const e of events) {
    if (e.all_day) {
      allDay.push(e);
      continue;
    }
    const startsToday = localDay(new Date(e.starts_at)) === day;
    const start = startsToday ? minutesOf(e.starts_at) : 0;
    const endsToday = e.ends_at ? localDay(new Date(e.ends_at)) === day : true;
    const end = e.ends_at ? (endsToday ? minutesOf(e.ends_at) : 24 * 60) : start + 60;
    timed.push({ event: e, start, end: Math.max(end, start + 15) });
  }
  timed.sort((a, b) => a.start - b.start || a.end - b.end);

  const items: LineItem[] = [];
  let cursor = Math.max(DAY_START_MIN, nowMin);
  let free = 0;
  const addFree = (from: number, to: number, open = false) => {
    const a = Math.max(from, DAY_START_MIN, nowMin);
    const b = Math.min(to, DAY_END_MIN);
    if (b - a >= MIN_GAP) {
      items.push({ kind: 'free', start: a, end: b, minutes: b - a, open });
      free += b - a;
    }
  };
  for (const t of timed) {
    addFree(cursor, t.start);
    items.push({ kind: 'event', event: t.event, start: t.start, end: t.end, past: t.end <= nowMin, now: t.start <= nowMin && nowMin < t.end });
    cursor = Math.max(cursor, t.end);
  }
  addFree(cursor, DAY_END_MIN, true);
  return { items, allDay, free };
}

/** Was als Nächstes kommt: der laufende Termin („läuft bis 16:45“) oder der nächste („in 1 Std. 20 Min.“). */
export function nextUp(events: readonly PersonalEvent[], now: Date = new Date()): { event: PersonalEvent; text: string } | null {
  const t = now.getTime();
  const timed = events.filter((e) => !e.all_day).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  for (const e of timed) {
    const start = new Date(e.starts_at).getTime();
    const end = e.ends_at ? new Date(e.ends_at).getTime() : start + 60 * 60_000;
    if (start <= t && t < end) return { event: e, text: `läuft bis ${clock(minutesOf(e.ends_at ?? new Date(end).toISOString()))}` };
    if (start > t) {
      const wait = Math.max(1, Math.round((start - t) / 60_000));
      // Bis drei Stunden als Abstand („in 1 Std. 20 Min.“), danach als Uhrzeit („um 16:00“) — liest sich ruhiger
      return { event: e, text: wait <= 180 ? `in ${span(wait)}` : `um ${clock(minutesOf(e.starts_at))}` };
    }
  }
  return null;
}

/** Aufgaben für heute: offen und heute fällig oder überfällig — überfällige zuerst, dann nach Uhrzeit. */
export function tasksForToday(tasks: readonly PersonalTask[], now: Date = new Date()): { task: PersonalTask; late: boolean }[] {
  const today = localDay(now);
  return tasks
    .filter((t) => t.status !== 'DONE' && !!t.due_date && t.due_date <= today)
    .map((task) => ({ task, late: task.due_date! < today }))
    .sort((a, b) => Number(b.late) - Number(a.late) || (a.task.due_time ?? '99').localeCompare(b.task.due_time ?? '99'));
}
