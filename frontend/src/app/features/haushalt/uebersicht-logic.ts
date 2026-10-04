import { IconName } from '../../shared/icons/app-icon';
import { TaskDto } from './haushalt-api.service';
import { daysUntil, recurrenceLabel } from './haushalt-logic';

/**
 * Anzeigeregeln der Haushalt-Übersicht — reine Funktionen, damit sie einzeln
 * testbar sind. Alles leitet sich aus echten Feldern ab; nichts wird erfunden
 * (z. B. keine Minutenangaben, die das Datenmodell nicht kennt).
 */

const has = (text: string, ...words: string[]) => words.some((w) => text.toLocaleLowerCase('de').includes(w));

/** Icon einer Routine nach ihrem Titel. */
export function routineIcon(title: string): IconName {
  if (has(title, 'bett')) return 'bed';
  if (has(title, 'wäsche', 'waschen')) return 'washer';
  if (has(title, 'einkauf')) return 'cart';
  if (has(title, 'spül', 'geschirr')) return 'dishwasher';
  if (has(title, 'müll', 'abfall', 'tonne')) return 'trash';
  if (has(title, 'pflanze', 'gießen', 'blumen')) return 'plant';
  if (has(title, 'staubsaug', 'saugen')) return 'vacuum';
  if (has(title, 'küche', 'putzen', 'wischen', 'sauber')) return 'spray';
  if (has(title, 'kühlschrank')) return 'fridge';
  return 'household';
}

/** „in 3 Monaten“ / „in 2 Wochen“ / „in 5 Tagen“ / „morgen“ / „heute“. */
export function distance(days: number): string {
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  if (days < 14) return `in ${days} Tagen`;
  if (days < 60) return `in ${Math.round(days / 7)} Wochen`;
  const months = Math.round(days / 30);
  return months === 1 ? 'in einem Monat' : `in ${months} Monaten`;
}

/** „Täglich“ / „Wöchentlich (Mo)“ / „Monatlich“ / „Alle 3 Tage“. */
export function routineFrequency(task: TaskDto): string {
  const label = recurrenceLabel(task.recurrence_days, task.recurrence_months);
  const text = label.charAt(0).toUpperCase() + label.slice(1);
  if (task.recurrence_days === 7 && task.due_date) {
    const [y, m, d] = task.due_date.split('-').map(Number);
    const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(new Date(y, m - 1, d)).replace('.', '');
    return `${text} (${weekday})`;
  }
  return text;
}

/** Wurde die Routine heute schon erledigt? (last_done_at ist ein Zeitstempel.) */
export function doneToday(task: TaskDto, today: Date = new Date()): boolean {
  if (!task.last_done_at) return false;
  const done = new Date(task.last_done_at);
  return done.getFullYear() === today.getFullYear() && done.getMonth() === today.getMonth() && done.getDate() === today.getDate();
}

/** „Heute“ / „Morgen“ / „In 6 Tagen“ / „Überfällig“ für den nächsten Termin einer Routine. */
export function nextDue(task: TaskDto, today: Date = new Date()): string {
  if (!task.due_date) return 'Ohne Datum';
  const days = daysUntil(task.due_date, today);
  if (days < 0) return 'Überfällig';
  const text = distance(days);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const EFFORT_LABEL: Record<1 | 2 | 3, string> = { 1: 'Aufwand klein', 2: 'Aufwand mittel', 3: 'Aufwand groß' };
