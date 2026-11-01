import { IconName } from '../../shared/icons/app-icon';
import { DeadlineDto, FolderEntryDto, MemberLoadDto, TaskDto, TaskRoom } from './haushalt-api.service';
import { ROOMS, durationLabel } from './aufgaben-logic';
import { daysUntil, isoDate } from './haushalt-logic';

/**
 * „Dein Zuhause, Raum für Raum“ (Haushalt › Heute und Aufgaben): reine Rechnungen aus den echten Aufgaben —
 * nichts geschätzt. Räume kommen aus Task.room; ohne Raum oder „Alle Räume“ zählt eine Aufgabe zu keinem Raum.
 */

/** Wie dringend ein Raum gerade ist — 3 überfällig · 2 heute fällig · 1 bald (≤ 3 Tage) · 0 nichts Dringendes. */
export type RoomLevel = 0 | 1 | 2 | 3;

export interface RoomState {
  room: Exclude<TaskRoom, '' | 'alle'>;
  label: string;
  icon: IconName;
  /** Offene Aufgaben in diesem Raum (ohne pausierte). */
  open: number;
  level: RoomLevel;
  /** In Worten, nie nur über Farbe: „1 überfällig“, „2 heute“, „in 3 Tagen“, „nichts fällig“. */
  text: string;
}

/** Räume mit offenen Aufgaben, dringendste zuerst (bei Gleichstand nach Name). */
export function roomStates(tasks: readonly TaskDto[], today: Date = new Date()): RoomState[] {
  const result: RoomState[] = [];
  for (const r of ROOMS) {
    if (r.value === 'alle') continue;
    const inRoom = tasks.filter((t) => t.room === r.value && !t.is_done && !t.is_paused);
    if (!inRoom.length) continue;
    const days = inRoom.filter((t) => t.due_date).map((t) => daysUntil(t.due_date!, today));
    const overdue = days.filter((d) => d < 0).length;
    const dueToday = days.filter((d) => d === 0).length;
    const soon = days.filter((d) => d > 0).sort((a, b) => a - b)[0];
    const level: RoomLevel = overdue ? 3 : dueToday ? 2 : soon !== undefined && soon <= 3 ? 1 : 0;
    const text = overdue
      ? `${overdue} überfällig`
      : dueToday
        ? `${dueToday} heute`
        : soon === 1
          ? 'morgen'
          : soon !== undefined
            ? `in ${soon} Tagen`
            : 'nichts fällig';
    result.push({ room: r.value, label: r.label, icon: r.icon, open: inRoom.length, level, text });
  }
  return result.sort((a, b) => b.level - a.level || a.label.localeCompare(b.label, 'de'));
}

/** Aufgaben, die heute anstehen (überfällig oder heute fällig, nicht pausiert). */
export function dueNow(tasks: readonly TaskDto[], today: Date = new Date()): TaskDto[] {
  return tasks.filter((t) => !t.is_done && !t.is_paused && !!t.due_date && daysUntil(t.due_date, today) <= 0);
}

/** Geschätzte Zeit für das, was heute ansteht — nur aus eingetragenen Dauern; „“ wenn keine eingetragen ist. */
export function minutesLabel(tasks: readonly TaskDto[]): string {
  const total = tasks.reduce((sum, t) => sum + (t.duration_minutes ?? 0), 0);
  return total ? `ca. ${durationLabel(total)}` : '';
}

/** Heute schon Erledigtes: einmalige erledigte Aufgaben und Serien, die heute abgehakt wurden (last_done_at).
 * last_done_at ist ein Zeitstempel (UTC) — verglichen wird der lokale Kalendertag, sonst fiele eine Erledigung
 * kurz nach Mitternacht auf „gestern“. */
export function doneToday(tasks: readonly TaskDto[], today: Date = new Date()): number {
  const day = isoDate(today);
  const localDay = (stamp: string) => {
    const date = new Date(stamp);
    return Number.isNaN(date.getTime()) ? '' : isoDate(date);
  };
  return new Set(tasks.filter((t) => t.last_done_at && localDay(t.last_done_at) === day).map((t) => t.id)).size;
}

/** Wer hat diesen Monat wie viel erledigt — nur bei mehreren Personen, sonst null (allein kein Familien-Ton). */
export function fairness(members: readonly MemberLoadDto[]): { text: string; parts: { name: string; count: number; share: number }[] } | null {
  if (members.length < 2) return null;
  const total = members.reduce((sum, m) => sum + m.count, 0);
  if (!total) return null;
  const parts = members.map((m) => ({ name: m.name, count: m.count, share: Math.round((m.count / total) * 100) }));
  return { text: parts.map((p) => `${p.name} ${p.count}`).join(' · '), parts };
}

/** Gruppen der Aufgabenliste „nach Tag“. */
export type DayGroupKey = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none';
const DAY_LABEL: Record<DayGroupKey, string> = {
  overdue: 'Überfällig',
  today: 'Heute',
  tomorrow: 'Morgen',
  week: 'Diese Woche',
  later: 'Später',
  none: 'Ohne Datum',
};
export function dayGroupKey(task: TaskDto, today: Date = new Date()): DayGroupKey {
  if (!task.due_date) return 'none';
  const days = daysUntil(task.due_date, today);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  // bis einschließlich Sonntag dieser Woche
  const toSunday = (7 - ((today.getDay() + 6) % 7)) - 1;
  return days <= toSunday ? 'week' : 'later';
}

export interface TaskGroup {
  key: string;
  label: string;
  icon?: IconName;
  tasks: TaskDto[];
}

/** Gruppiert die (schon sortierte) Liste; leere Gruppen fallen weg, Reihenfolge fest. */
export function groupTasks(tasks: readonly TaskDto[], by: 'tag' | 'raum' | 'person', today: Date = new Date()): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  const add = (key: string, label: string, task: TaskDto, icon?: IconName) => {
    if (!groups.has(key)) groups.set(key, { key, label, icon, tasks: [] });
    groups.get(key)!.tasks.push(task);
  };
  for (const t of tasks) {
    if (by === 'tag') {
      const key = dayGroupKey(t, today);
      add(key, DAY_LABEL[key], t);
    } else if (by === 'raum') {
      const r = ROOMS.find((x) => x.value === t.room);
      add(r ? r.value : 'ohne', r ? r.label : 'Ohne Raum', t, r?.icon);
    } else {
      add(t.assigned_to_name ? `p-${t.assigned_to ?? t.assigned_to_name}` : 'p-offen', t.assigned_to_name ?? 'Noch niemand zuständig', t);
    }
  }
  const order: string[] =
    by === 'tag' ? (['overdue', 'today', 'tomorrow', 'week', 'later', 'none'] as DayGroupKey[]) : by === 'raum' ? [...ROOMS.map((r) => r.value as string), 'ohne'] : [];
  const list = [...groups.values()];
  if (order.length) return list.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  // Personen alphabetisch, „Noch niemand zuständig“ zuletzt
  return list.sort((a, b) => (a.key === 'p-offen' ? 1 : b.key === 'p-offen' ? -1 : a.label.localeCompare(b.label, 'de')));
}

// ---------------------------------------------------------------------------
// Zuhause (Geräte und Verträge)
// ---------------------------------------------------------------------------

export interface NextDeadline {
  entry: FolderEntryDto;
  art: DeadlineDto['art'];
  date: string;
  /** „Wartung“, „Garantie endet“, „Kündigen bis“ */
  label: string;
  days: number;
}
const DEADLINE_WORD: Record<DeadlineDto['art'], string> = { wartung: 'Wartung', garantie: 'Garantie endet', kuendigung: 'Kündigen bis' };

/** „Als Nächstes“: die nächsten Fristen (heute oder später) der laufenden Einträge, früheste zuerst. */
export function nextDeadlines(entries: readonly FolderEntryDto[], limit = 4, today: Date = new Date()): NextDeadline[] {
  const list: NextDeadline[] = [];
  for (const entry of entries) {
    if (entry.status === 'RETIRED' || entry.effective_status === 'ENDED' || entry.effective_status === 'CANCELLED') continue;
    for (const d of entry.deadlines ?? []) {
      const days = daysUntil(d.datum, today);
      if (days >= 0) list.push({ entry, art: d.art, date: d.datum, label: DEADLINE_WORD[d.art], days });
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date) || a.entry.name.localeCompare(b.entry.name, 'de')).slice(0, limit);
}

/** Geräte nach Raum gruppiert (Reihenfolge wie ROOMS, dann „Ohne Raum“); außer Betrieb gesetzte stehen wie bisher
 * am Ende — in einer eigenen Gruppe „Außer Betrieb“. Nur sinnvoll ab zwei Gruppen. */
export function devicesByRoom(devices: readonly FolderEntryDto[]): { key: string; label: string; icon?: IconName; items: FolderEntryDto[] }[] {
  const groups = new Map<string, { key: string; label: string; icon?: IconName; items: FolderEntryDto[] }>();
  for (const d of devices) {
    const r = d.status === 'RETIRED' ? undefined : ROOMS.find((x) => x.value === d.room && x.value !== 'alle');
    const key = d.status === 'RETIRED' ? 'retired' : r ? r.value : 'ohne';
    const label = d.status === 'RETIRED' ? 'Außer Betrieb' : r ? r.label : 'Ohne Raum';
    if (!groups.has(key)) groups.set(key, { key, label, icon: r?.icon, items: [] });
    groups.get(key)!.items.push(d);
  }
  const order = [...ROOMS.map((r) => r.value as string), 'ohne', 'retired'];
  return [...groups.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}
