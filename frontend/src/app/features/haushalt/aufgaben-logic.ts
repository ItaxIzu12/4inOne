import { IconName } from '../../shared/icons/app-icon';
import { calendarWeek } from '../../shared/dates/calendar-week';
import { TaskDto, TaskPriority, TaskRoom } from './haushalt-api.service';
import { daysUntil, isoDate } from './haushalt-logic';

/**
 * Anzeigeregeln des Aufgaben-Reiters — reine Funktionen, damit sie einzeln
 * testbar sind. Räume und Prioritäten spiegeln backend haushalt/models.py.
 */

export const ROOMS: { value: Exclude<TaskRoom, ''>; label: string; icon: IconName }[] = [
  { value: 'kueche', label: 'Küche', icon: 'utensils' },
  { value: 'bad', label: 'Badezimmer', icon: 'bath' },
  { value: 'wohnzimmer', label: 'Wohnzimmer', icon: 'sofa' },
  { value: 'schlafzimmer', label: 'Schlafzimmer', icon: 'bed' },
  { value: 'kinderzimmer', label: 'Kinderzimmer', icon: 'blocks' },
  { value: 'waschkueche', label: 'Waschküche', icon: 'washer' },
  { value: 'flur', label: 'Flur', icon: 'door' },
  { value: 'arbeitszimmer', label: 'Arbeitszimmer', icon: 'desk' },
  { value: 'aussen', label: 'Außenbereich', icon: 'tree' },
  { value: 'alle', label: 'Alle Räume', icon: 'household' },
];

export function room(value: TaskRoom): { label: string; icon: IconName } | null {
  return ROOMS.find((r) => r.value === value) ?? null;
}

export const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'hoch', label: 'Hoch' },
  { value: 'mittel', label: 'Normal' },
  { value: 'niedrig', label: 'Niedrig' },
];
export const PRIORITY_LABEL: Record<TaskPriority, string> = { hoch: 'Hoch', mittel: 'Normal', niedrig: 'Niedrig' };

const SHORT = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' });
const WITH_DAY = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** „Gestern“ / „Heute“ / „Morgen“ / „Do, 14. März“ (diese Woche, Monat kurz) / „12. März“. */
export function dueLabel(task: TaskDto, today: Date = new Date()): { text: string; tone: 'late' | 'today' | 'plain' } {
  if (!task.due_date) return { text: 'Ohne Datum', tone: 'plain' };
  const days = daysUntil(task.due_date, today);
  const date = parse(task.due_date);
  if (days === -1) return { text: 'Gestern', tone: 'late' };
  if (days < 0) return { text: SHORT.format(date), tone: 'late' };
  if (days === 0) return { text: 'Heute', tone: 'today' };
  if (days === 1) return { text: 'Morgen', tone: 'plain' };
  // „Mi, 7. Okt.“ — kurz genug für die Handy-Zeile
  if (days <= 7) return { text: WITH_DAY.format(date).replace('.,', ','), tone: 'plain' };
  return { text: SHORT.format(date), tone: 'plain' };
}

/** „5 Min.“ / „1 Std.“ / „1 Std. 30 Min.“ */
export function durationLabel(minutes: number | null): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} Std. ${rest} Min.` : `${hours} Std.`;
}

/** „Jonas Schneider“ → „JS“, „Anna“ → „AN“. */
export function initials(name: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}

/** Farbe eines Personenkreises: abwechselnd blau oder coral, stabil pro Name. */
export function avatarTone(name: string | null): 'blue' | 'rose' {
  if (!name) return 'blue';
  let sum = 0;
  for (const char of name) sum += char.charCodeAt(0);
  return sum % 2 === 0 ? 'blue' : 'rose';
}

export interface TaskFilters {
  status: '' | 'overdue' | 'today' | 'week' | 'done';
  room: '' | TaskRoom | 'none';
  person: '' | 'none' | string;
  priority: '' | TaskPriority;
}
export const NO_FILTERS: TaskFilters = { status: '', room: '', person: '', priority: '' };

/** Raum, Person und Priorität filtern; „Status“ wählt die Fälligkeitsgruppe (Erledigt lädt der Reiter selbst). */
export function filterTasks(tasks: TaskDto[], filters: TaskFilters, today: Date = new Date()): TaskDto[] {
  return tasks.filter((t) => {
    if (filters.room === 'none' ? t.room !== '' : filters.room && t.room !== filters.room) return false;
    if (filters.person === 'none' ? t.assigned_to !== null : filters.person && String(t.assigned_to) !== filters.person)
      return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.status && filters.status !== 'done') {
      const days = t.due_date ? daysUntil(t.due_date, today) : null;
      if (filters.status === 'overdue' && !(days !== null && days < 0)) return false;
      if (filters.status === 'today' && days !== 0) return false;
      if (filters.status === 'week' && !(days !== null && days >= 0 && t.due_date! <= calendarWeek(isoDate(today)).end)) return false;
    }
    return true;
  });
}
