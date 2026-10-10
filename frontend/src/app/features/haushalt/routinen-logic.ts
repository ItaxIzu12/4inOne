import { IconName } from '../../shared/icons/app-icon';
import { TaskDto } from './haushalt-api.service';
import { room } from './aufgaben-logic';
import { daysUntil } from './haushalt-logic';
import { distance, routineIcon } from './uebersicht-logic';

/**
 * Anzeigeregeln des Routinen-Reiters — reine Funktionen, einzeln testbar.
 * Eine Routine ist eine wiederkehrende Aufgabe (recurrence_days oder
 * recurrence_months); Serie und Pause kommen vom Backend (TaskSerializer).
 */

export function isRoutine(task: TaskDto): boolean {
  return !!(task.recurrence_days || task.recurrence_months);
}

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'other';

export function frequency(task: TaskDto): Frequency {
  if (task.recurrence_months) return 'monthly';
  if (task.recurrence_days === 1) return 'daily';
  if (task.recurrence_days === 7) return 'weekly';
  return 'other';
}

export interface RoutineGroup {
  key: Frequency;
  label: string;
  short: string;
  icon: IconName;
  tasks: TaskDto[];
}

const GROUPS: Omit<RoutineGroup, 'tasks'>[] = [
  { key: 'daily', label: 'Tägliche Routinen', short: 'Täglich', icon: 'sun' },
  { key: 'weekly', label: 'Wöchentliche Routinen', short: 'Wöchentlich', icon: 'calendar' },
  { key: 'monthly', label: 'Monatliche Routinen', short: 'Monatlich', icon: 'calendar-check' },
  { key: 'other', label: 'Weitere Routinen', short: 'Weitere', icon: 'repeat' },
];

/** Täglich, wöchentlich, monatlich, sonstige — leere Gruppen fallen weg, die Reihenfolge innerhalb bleibt. */
export function groupRoutines(tasks: TaskDto[]): RoutineGroup[] {
  return GROUPS.map((group) => ({ ...group, tasks: tasks.filter((t) => frequency(t) === group.key) })).filter(
    (group) => group.tasks.length > 0,
  );
}

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const WEEKDAY = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const DAY_MONTH = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: 'short' });
const FULL = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });

/** „Täglich“ / „Wöchentlich · immer Mo.“ / „Monatlich · am 1.“ / „Alle 3 Tage“. */
export function rhythm(task: TaskDto): { main: string; sub: string } {
  const f = frequency(task);
  const date = task.due_date ? parse(task.due_date) : null;
  if (f === 'daily') return { main: 'Täglich', sub: '' };
  if (f === 'weekly') return { main: 'Wöchentlich', sub: date ? `immer ${WEEKDAY.format(date).replace(/\.?$/, '.')}` : '' };
  if (f === 'monthly') {
    const months = task.recurrence_months ?? 1;
    return { main: months === 1 ? 'Monatlich' : `Alle ${months} Monate`, sub: date ? `am ${date.getDate()}.` : '' };
  }
  return { main: `Alle ${task.recurrence_days} Tage`, sub: '' };
}

export interface DueInfo {
  /** Hervorgehobenes Etikett (coral „Heute“, rot „Überfällig“) oder null für reinen Text. */
  badge: string | null;
  tone: 'today' | 'late' | 'plain' | 'paused';
  main: string;
  sub: string;
}

/** Nächste Fälligkeit wie im Entwurf: „Heute · bis 20:00“, „Morgen · 06. Okt. 2026“, „Mo., 07. Okt. · in 3 Tagen“. */
export function nextDue(task: TaskDto, today: Date = new Date()): DueInfo {
  if (task.is_paused) return { badge: null, tone: 'paused', main: 'Pausiert', sub: 'ruht gerade' };
  if (!task.due_date) return { badge: null, tone: 'plain', main: 'Ohne Datum', sub: '' };
  const days = daysUntil(task.due_date, today);
  const time = task.due_time ? `bis ${task.due_time.slice(0, 5)}` : '';
  if (days < 0) return { badge: 'Überfällig', tone: 'late', main: '', sub: -days === 1 ? 'seit gestern' : `seit ${-days} Tagen` };
  if (days === 0) return { badge: 'Heute', tone: 'today', main: '', sub: time || 'im Lauf des Tages' };
  const date = parse(task.due_date);
  if (days === 1) return { badge: null, tone: 'plain', main: 'Morgen', sub: time || FULL.format(date) };
  return { badge: null, tone: 'plain', main: DAY_MONTH.format(date), sub: distance(days) };
}

/** Zweite Zeile auf dem Handy: „Täglich • bis 20:00“, „Täglich • morgen“, „Immer Mo. • in 2 Tagen“. */
export function mobileMeta(task: TaskDto, today: Date = new Date()): string {
  const r = rhythm(task);
  const first = frequency(task) === 'weekly' && r.sub ? r.sub.charAt(0).toUpperCase() + r.sub.slice(1) : r.main;
  if (task.is_paused) return `${first} • pausiert`;
  if (!task.due_date) return first;
  const days = daysUntil(task.due_date, today);
  const time = task.due_time ? `bis ${task.due_time.slice(0, 5)}` : '';
  if (days < 0) return `${first} • überfällig`;
  if (days === 0) return `${first} • ${time || 'heute'}`;
  if (days === 1) return `${first} • morgen${time ? ' ' + time : ''}`;
  return `${first} • ${distance(days)}`;
}

/** „12 Tage“ / „1 Woche“ / „3 Monate“ / „4× in Folge“; leer, solange keine Serie läuft. */
export function streakLabel(task: TaskDto): string {
  const n = task.streak ?? 0;
  if (n <= 0) return '';
  switch (frequency(task)) {
    case 'daily':
      return n === 1 ? '1 Tag' : `${n} Tage`;
    case 'weekly':
      return n === 1 ? '1 Woche' : `${n} Wochen`;
    case 'monthly':
      return n === 1 ? '1 Monat' : `${n} Monate`;
    default:
      return `${n}× in Folge`;
  }
}

/** Icon einer Routine: nach Titel, sonst nach Raum, sonst das Wiederholen-Symbol. */
export function routineIconFor(task: TaskDto): IconName {
  const byTitle = routineIcon(task.title);
  if (byTitle !== 'household') return byTitle;
  return room(task.room)?.icon ?? 'repeat';
}

export type RoutineChip = 'alle' | 'daily' | 'weekly' | 'monthly' | 'pausiert' | 'heute' | 'geteilt';

export const ROUTINE_CHIPS: { key: RoutineChip; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'daily', label: 'Täglich' },
  { key: 'weekly', label: 'Wöchentlich' },
  { key: 'monthly', label: 'Monatlich' },
  { key: 'pausiert', label: 'Pausiert' },
];

/** Heute oder früher fällig und nicht pausiert. */
export function isDueToday(task: TaskDto, today: Date = new Date()): boolean {
  return !task.is_paused && !!task.due_date && daysUntil(task.due_date, today) <= 0;
}

/** Fest jemandem zugeteilt oder reihum — „geteilte Routinen“. */
export function isShared(task: TaskDto): boolean {
  return !task.is_paused && (task.assigned_to !== null || task.rotate);
}

export function filterRoutines(tasks: TaskDto[], chip: RoutineChip, today: Date = new Date()): TaskDto[] {
  switch (chip) {
    case 'alle':
      return tasks;
    case 'pausiert':
      return tasks.filter((t) => t.is_paused);
    case 'heute':
      return tasks.filter((t) => isDueToday(t, today));
    case 'geteilt':
      return tasks.filter(isShared);
    default:
      return tasks.filter((t) => frequency(t) === chip);
  }
}

export type RoutineSort = 'faellig' | 'name' | 'serie';

export const ROUTINE_SORT_OPTIONS: { value: RoutineSort; label: string }[] = [
  { value: 'faellig', label: 'Fälligkeit' },
  { value: 'name', label: 'Name' },
  { value: 'serie', label: 'Serie' },
];

/** Pausierte stehen bei „Fälligkeit“ am Ende ihrer Gruppe. */
export function sortRoutines(tasks: TaskDto[], sort: RoutineSort): TaskDto[] {
  const byDue = (a: TaskDto, b: TaskDto) =>
    Number(a.is_paused) - Number(b.is_paused) ||
    (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') ||
    (a.due_time ?? '99').localeCompare(b.due_time ?? '99');
  const sorted = [...tasks];
  if (sort === 'name') return sorted.sort((a, b) => a.title.localeCompare(b.title, 'de'));
  if (sort === 'serie') return sorted.sort((a, b) => (b.streak ?? 0) - (a.streak ?? 0) || byDue(a, b));
  return sorted.sort(byDue);
}
