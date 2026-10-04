import { IconName } from '../../shared/icons/app-icon';
import { EventCategory, FileCategory, PersonalEvent, PersonalFile, PersonalNote, PersonalTask } from './organisation-api.service';

/**
 * Anzeigeregeln der Organisation (Übersicht, Kalender, Aufgaben, Notizen,
 * Dateien) — reine Funktionen, einzeln testbar. Tage sind „JJJJ-MM-TT“ in
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

/** Die sieben Tage (Mo–So) der Woche, in der `day` liegt. */
export function weekOf(day: string): string[] {
  const d = parseDay(day);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => localDay(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
}

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** „16:00 – 16:45“ oder „16:00“. */
export function timeRange(e: PersonalEvent): string {
  return e.ends_at ? `${hhmm(e.starts_at)} – ${hhmm(e.ends_at)}` : hhmm(e.starts_at);
}

export function startTime(e: PersonalEvent): string {
  return hhmm(e.starts_at);
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

/** „In 4 Std.“, „Läuft“, „Morgen“, „In 3 Tagen“ — Abstand bis zum Beginn. */
export function relativeStart(e: PersonalEvent, now: Date = new Date()): string {
  const start = new Date(e.starts_at);
  const end = e.ends_at ? new Date(e.ends_at) : start;
  if (start <= now && end >= now) return 'Läuft gerade';
  if (start < now) return 'Vorbei';
  const days = Math.round((parseDay(localDay(start)).getTime() - parseDay(localDay(now)).getTime()) / 86_400_000);
  if (days === 0) {
    const hours = Math.round((start.getTime() - now.getTime()) / 3_600_000);
    return hours < 1 ? 'Gleich' : `In ${hours} Std.`;
  }
  if (days === 1) return 'Morgen';
  return `In ${days} Tagen`;
}

/** Die nächsten Termine ab jetzt (laufende eingeschlossen). */
export function upcomingEvents(events: PersonalEvent[], now: Date = new Date(), limit = 5): PersonalEvent[] {
  return events
    .filter((e) => new Date(e.ends_at ?? e.starts_at) >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, limit);
}

/** Nächste Termine NACH heute, nach Tag gruppiert (Übersicht „Nächste Termine“). */
export function nextDays(events: PersonalEvent[], now: Date = new Date(), limit = 4): { day: string; events: PersonalEvent[] }[] {
  const today = localDay(now);
  const later = events.filter((e) => localDay(new Date(e.starts_at)) > today).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, limit);
  const groups: { day: string; events: PersonalEvent[] }[] = [];
  for (const e of later) {
    const day = localDay(new Date(e.starts_at));
    const group = groups.find((g) => g.day === day);
    if (group) group.events.push(e);
    else groups.push({ day, events: [e] });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Aufgaben
// ---------------------------------------------------------------------------

export type TaskGroupKey = 'overdue' | 'today' | 'week' | 'later' | 'undated';

export interface TaskGroup {
  key: TaskGroupKey;
  label: string;
  icon: IconName;
  tasks: PersonalTask[];
}

const daysUntil = (day: string, now: Date) =>
  Math.round((parseDay(day).getTime() - parseDay(localDay(now)).getTime()) / 86_400_000);

/** Offene Aufgaben: Überfällig, Heute, Diese Woche (bis 7 Tage), Später, Ohne Datum — leere Gruppen fallen weg. */
export function groupTasks(tasks: PersonalTask[], now: Date = new Date()): TaskGroup[] {
  const groups: TaskGroup[] = [
    { key: 'overdue', label: 'Überfällig', icon: 'flag', tasks: [] },
    { key: 'today', label: 'Heute', icon: 'sun', tasks: [] },
    { key: 'week', label: 'Diese Woche', icon: 'calendar', tasks: [] },
    { key: 'later', label: 'Später', icon: 'calendar-check', tasks: [] },
    { key: 'undated', label: 'Ohne Datum', icon: 'list', tasks: [] },
  ];
  const sorted = [...tasks].sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || (a.due_time ?? '99').localeCompare(b.due_time ?? '99'));
  for (const t of sorted) {
    if (t.status === 'DONE') continue;
    if (!t.due_date) groups[4].tasks.push(t);
    else {
      const days = daysUntil(t.due_date, now);
      groups[days < 0 ? 0 : days === 0 ? 1 : days <= 7 ? 2 : 3].tasks.push(t);
    }
  }
  return groups.filter((g) => g.tasks.length);
}

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

export interface TaskProgress {
  done: number;
  total: number;
  pct: number;
  overdue: number;
  today: { done: number; total: number };
  week: { done: number; total: number };
}

/** Fortschritt aller Aufgaben mit Datum in der Nähe: erledigt / gesamt, dazu heute und diese Woche. */
export function taskProgress(tasks: PersonalTask[], now: Date = new Date()): TaskProgress {
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const within = (from: number, to: number) => tasks.filter((t) => t.due_date && daysUntil(t.due_date, now) >= from && daysUntil(t.due_date, now) <= to);
  const count = (list: PersonalTask[]) => ({ done: list.filter((t) => t.status === 'DONE').length, total: list.length });
  return {
    done,
    total: tasks.length,
    pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    overdue: tasks.filter((t) => t.status !== 'DONE' && t.due_date && daysUntil(t.due_date, now) < 0).length,
    today: count(within(0, 0)),
    week: count(within(0, 7)),
  };
}

const PROJECT_TONES = ['violet', 'indigo', 'green', 'orange', 'gray', 'rose', 'teal'];

/** Projekte der offenen Aufgaben mit Anzahl, größtes zuerst; Farbe stabil nach Name. */
export function projects(tasks: PersonalTask[]): { name: string; count: number; tone: string }[] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    const name = (t.project ?? '').trim();
    if (!name || t.status === 'DONE') continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, tone: projectTone(name) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de'));
}

export function projectTone(name: string): string {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return PROJECT_TONES[sum % PROJECT_TONES.length];
}

// ---------------------------------------------------------------------------
// Notizen
// ---------------------------------------------------------------------------

/** Die ersten Zeilen einer Notiz als Vorschau. */
export function noteLines(note: PersonalNote, max = 3): string[] {
  return (note.body ?? '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, max);
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

// ---------------------------------------------------------------------------
// Dateien
// ---------------------------------------------------------------------------

export const FILE_CATEGORIES: { value: FileCategory; label: string; icon: IconName; tone: string }[] = [
  { value: 'reise', label: 'Reisedokumente', icon: 'travel', tone: 'red' },
  { value: 'buchung', label: 'Buchungen', icon: 'calendar', tone: 'blue' },
  { value: 'persoenlich', label: 'Persönliches', icon: 'user', tone: 'green' },
  { value: 'checkliste', label: 'Checklisten', icon: 'check-circle', tone: 'amber' },
  { value: 'bild', label: 'Bilder', icon: 'image', tone: 'violet' },
  { value: 'sonstiges', label: 'Sonstiges', icon: 'folder', tone: 'gray' },
];

export function fileCategory(value: FileCategory) {
  return FILE_CATEGORIES.find((c) => c.value === value) ?? FILE_CATEGORIES[FILE_CATEGORIES.length - 1];
}

/** Dateiart für Symbol und Farbe: PDF rot, Tabelle grün, Dokument blau, Text gelb, Bild mit Vorschau. */
export function fileKind(file: Pick<PersonalFile, 'content_type' | 'name'>): { label: string; icon: IconName; tone: string; image: boolean } {
  const t = file.content_type;
  if (t === 'application/pdf') return { label: 'PDF-Dokument', icon: 'file-text', tone: 'red', image: false };
  if (t.startsWith('image/')) return { label: 'Bild', icon: 'image', tone: 'violet', image: true };
  if (t.includes('spreadsheet')) return { label: 'Tabelle', icon: 'bars', tone: 'green', image: false };
  if (t.includes('wordprocessing')) return { label: 'Dokument', icon: 'file-text', tone: 'blue', image: false };
  if (t === 'text/plain') return { label: 'Textdatei', icon: 'list', tone: 'amber', image: false };
  return { label: 'Datei', icon: 'folder', tone: 'gray', image: false };
}

/** „1,2 MB“, „284 KB“, „12 KB“. */
export function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 ** 3).toLocaleString('de-DE', { maximumFractionDigits: 1 })} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 ** 2).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** „vor 2 Stunden“, „gestern“, „vor 3 Tagen“, „vor 2 Wochen“. */
export function agoText(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? 'vor 1 Stunde' : `vor ${hours} Stunden`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'gestern';
  if (days < 14) return `vor ${days} Tagen`;
  return `vor ${Math.floor(days / 7)} Wochen`;
}
