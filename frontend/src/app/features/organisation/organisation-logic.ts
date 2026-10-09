import { IconName } from '../../shared/icons/app-icon';
import { calendarWeek } from '../../shared/dates/calendar-week';
import { EventCategory, PersonalEvent, PersonalNote, PersonalTask, Repeat } from './organisation-api.service';

/**
 * Anzeigeregeln der Organisation (Kalender, Aufgaben, Notizen) — reine
 * Funktionen, einzeln testbar. Tage sind „JJJJ-MM-TT“ in
 * lokaler Zeit; Termine tragen ISO-Zeitpunkte.
 */

export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const parseDay = (day: string) => new Date(`${day}T12:00`);
const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTH_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];

// ---------------------------------------------------------------------------
// Termin-Kategorien
// ---------------------------------------------------------------------------

export const EVENT_CATEGORIES: { value: EventCategory; label: string; icon: IconName }[] = [
  { value: 'gesundheit', label: 'Gesundheit', icon: 'heart' },
  { value: 'sport', label: 'Sport', icon: 'dumbbell' },
  { value: 'familie', label: 'Familie', icon: 'people' },
  { value: 'arbeit', label: 'Arbeit', icon: 'desk' },
  { value: 'freizeit', label: 'Freizeit', icon: 'sun' },
  { value: 'sonstiges', label: 'Sonstiges', icon: 'calendar' },
];

export function eventCategory(value: EventCategory | undefined) {
  return EVENT_CATEGORIES.find((c) => c.value === value) ?? EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1];
}

// ---------------------------------------------------------------------------
// Kalender
// ---------------------------------------------------------------------------

/** Liegt der Termin (auch mehrtägig) an diesem Tag? */
export function onDay(e: PersonalEvent, day: string): boolean {
  const start = new Date(`${day}T00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const begins = new Date(e.starts_at);
  return begins < end && (begins >= start || (!!e.ends_at && new Date(e.ends_at) > start));
}

export function eventsOn(events: PersonalEvent[], day: string): PersonalEvent[] {
  return events.filter((e) => onDay(e, day)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export interface CalendarDay {
  key: string;
  number: number;
  outside: boolean;
  today: boolean;
  events: PersonalEvent[];
}

/** Sechs Wochen ab dem Montag vor dem Monatsersten. */
export function monthGrid(month: Date, events: PersonalEvent[], today: Date = new Date()): CalendarDay[] {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const todayKey = localDay(today);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = localDay(d);
    return { key, number: d.getDate(), outside: d.getMonth() !== month.getMonth(), today: key === todayKey, events: eventsOn(events, key) };
  });
}

const STEP: Record<Repeat, { days?: number; months?: number }> = {
  daily: { days: 1 },
  weekly: { days: 7 },
  monthly: { months: 1 },
  yearly: { months: 12 },
};

/** Termine im Zeitraum, wiederkehrende einmal pro Vorkommen — dieselben Regeln wie backend
 * organisation/services.py events_between (für die Demo; die echte API liefert das fertig). */
export function expandEvents(events: PersonalEvent[], start: string, end: string): PersonalEvent[] {
  const lower = new Date(`${start}T00:00`);
  const upper = new Date(`${end}T00:00`);
  upper.setDate(upper.getDate() + 1);
  const touches = (from: Date, to: Date | null) => from < upper && (from >= lower || (!!to && to >= lower));
  const rows: PersonalEvent[] = [];
  for (const e of events) {
    const first = new Date(e.starts_at);
    const length = e.ends_at ? new Date(e.ends_at).getTime() - first.getTime() : null;
    if (!e.recurrence) {
      if (touches(first, e.ends_at ? new Date(e.ends_at) : null)) rows.push(e);
      continue;
    }
    const step = STEP[e.recurrence];
    for (let i = 0; i < 800; i++) {
      const at = new Date(first);
      if (step.days) at.setDate(first.getDate() + step.days * i);
      else {
        const day = first.getDate();
        at.setDate(1);
        at.setMonth(first.getMonth() + (step.months ?? 1) * i);
        at.setDate(Math.min(day, new Date(at.getFullYear(), at.getMonth() + 1, 0).getDate()));
      }
      if (at >= upper) break;
      const until = length !== null ? new Date(at.getTime() + length) : null;
      if (touches(at, until)) {
        rows.push({ ...e, starts_at: at.toISOString(), ends_at: until ? until.toISOString() : null, series_starts_at: e.starts_at });
      }
    }
  }
  return rows.sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id - b.id);
}

/** Erster und letzter Tag des sichtbaren Monatsrasters (sechs Wochen ab Montag). */
export function gridRange(month: Date): { start: string; end: string } {
  const grid = monthGrid(month, []);
  return { start: grid[0].key, end: grid[grid.length - 1].key };
}

/** Die sieben Tage (Mo–So) der Woche, in der `day` liegt. */
export function weekOf(day: string): string[] {
  const monday = parseDay(calendarWeek(day).start);
  return Array.from({ length: 7 }, (_, i) => localDay(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
}

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** „16:00 – 16:45“, „16:00“ oder „Ganztägig“. */
export function timeRange(e: PersonalEvent): string {
  if (e.all_day) return 'Ganztägig';
  return e.ends_at ? `${hhmm(e.starts_at)} – ${hhmm(e.ends_at)}` : hhmm(e.starts_at);
}

export function startTime(e: PersonalEvent): string {
  return e.all_day ? 'Ganztägig' : hhmm(e.starts_at);
}

export function endTime(e: PersonalEvent): string {
  return e.ends_at ? hhmm(e.ends_at) : '';
}

/** „Mittwoch, 12. März 2025“. */
export function longDay(day: string): string {
  return parseDay(day).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** „Do, 13.03.“ */
export function shortDay(day: string): string {
  const d = parseDay(day);
  return `${WEEKDAY_SHORT[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

/** „Mi, 14. Mai“. */
export function weekdayDay(day: string): string {
  const d = parseDay(day);
  return `${WEEKDAY_SHORT[d.getDay()]}, ${d.getDate()}. ${MONTH_SHORT[d.getMonth()]}`;
}

/** „Heute“ / „Morgen“ / „Do, 13.03.“ für Listen. */
export function dayWord(day: string, now: Date = new Date()): string {
  const today = localDay(now);
  const tomorrow = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  if (day === today) return 'Heute';
  if (day === tomorrow) return 'Morgen';
  return shortDay(day);
}

// ---------------------------------------------------------------------------
// Aufgaben
// ---------------------------------------------------------------------------

const daysUntil = (day: string, now: Date) =>
  Math.round((parseDay(day).getTime() - parseDay(localDay(now)).getTime()) / 86_400_000);

/** Ansichten im Reiter Aufgaben. */
export type TaskView = 'all' | 'today' | 'overdue' | 'recurring' | 'done';
export const TASK_VIEWS: { key: TaskView; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'today', label: 'Heute' },
  { key: 'overdue', label: 'Überfällig' },
  { key: 'recurring', label: 'Wiederkehrend' },
  { key: 'done', label: 'Erledigt' },
];

export const isRecurring = (t: PersonalTask) => !!(t.recurrence_days || t.recurrence_months);

/** Aufgaben einer Ansicht, nach Fälligkeit sortiert (ohne Datum zuletzt). „Alle“ = alle offenen. */
export function filterTasks(tasks: PersonalTask[], view: TaskView, now: Date = new Date()): PersonalTask[] {
  const today = localDay(now);
  const open = (t: PersonalTask) => t.status !== 'DONE';
  const pick: Record<TaskView, (t: PersonalTask) => boolean> = {
    all: open,
    today: (t) => open(t) && t.due_date === today,
    overdue: (t) => open(t) && !!t.due_date && t.due_date < today,
    recurring: (t) => open(t) && isRecurring(t),
    done: (t) => !open(t),
  };
  const list = tasks.filter(pick[view]);
  if (view === 'done') return list.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
  return list.sort(
    (a, b) =>
      (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') ||
      (a.due_time ?? '99').localeCompare(b.due_time ?? '99') ||
      a.id - b.id,
  );
}

export const REPEAT_LABEL: Record<string, string> = {
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  yearly: 'Jährlich',
  custom: 'Wiederkehrend',
};

/** „Heute, 16:00“, „Morgen“, „Fr., 25. Apr.“, „12. Apr.“ (überfällig), „Ohne Datum“. */
export function taskDue(task: PersonalTask, now: Date = new Date()): { text: string; late: boolean } {
  if (!task.due_date) return { text: 'Ohne Datum', late: false };
  const days = daysUntil(task.due_date, now);
  const d = parseDay(task.due_date);
  const time = task.due_time ? `, ${task.due_time.slice(0, 5)}` : '';
  const late = days < 0 && task.status !== 'DONE';
  if (days === 0) return { text: `Heute${time}`, late };
  if (days === 1) return { text: `Morgen${time}`, late };
  if (days > 1 && days <= 7) return { text: `${WEEKDAY_SHORT[d.getDay()]}., ${d.getDate()}. ${MONTH_SHORT[d.getMonth()]}`, late };
  return { text: `${d.getDate()}. ${MONTH_SHORT[d.getMonth()]}`, late };
}

// ---------------------------------------------------------------------------
// Notizen
// ---------------------------------------------------------------------------

/** Die ersten Zeilen einer Notiz als Vorschau. */
export function noteLines(note: PersonalNote, max = 3): string[] {
  return (note.body ?? '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, max);
}

/** Titel einer Notiz — ohne Titel die erste Zeile des Inhalts. */
export function noteTitle(note: Pick<PersonalNote, 'title' | 'body'>): string {
  return note.title.trim() || noteLines(note as PersonalNote, 1)[0] || 'Ohne Titel';
}

/** „Heute“, „Gestern“, „02.10.2026“ — zuletzt bearbeitet. */
export function noteEdited(iso: string, now: Date = new Date()): string {
  const day = localDay(new Date(iso));
  if (day === localDay(now)) return 'Heute';
  if (day === localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return 'Gestern';
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y}`;
}

/** „Heute, 09:14“, „Gestern, 16:42“, „Sa, 10. Mai“. */
export function editedAt(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const day = localDay(d);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (day === localDay(now)) return `Heute, ${time}`;
  if (day === localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return `Gestern, ${time}`;
  return weekdayDay(day);
}
