/**
 * Kalenderdatei (ICS, RFC 5545) lesen — Export aus Google Kalender, Apple Kalender oder Outlook. Nur Termine
 * (VEVENT); Aufgaben, Alarme und Zeitzonen-Definitionen werden übergangen.
 *
 * Wiederholungen: 4inOne kennt täglich/wöchentlich/monatlich/jährlich ohne Ende. Eine Regel, die mehr verlangt
 * (Ende, Anzahl, Intervall, bestimmte Wochentage …), wird NICHT stillschweigend verändert — der Termin kommt dann
 * einmalig und zählt unter `simplified`, damit die Vorschau das ehrlich sagt.
 */

export type ImportRecurrence = '' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export interface EventImportRow {
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  recurrence: ImportRecurrence;
  location: string;
  description: string;
}
export interface ParsedIcs {
  rows: EventImportRow[];
  /** Termine, deren Wiederholung zu komplex war und die deshalb einmalig übernommen werden. */
  simplified: number;
  /** Abgesagte Termine und Ausnahmen einzelner Wiederholungen — nicht übernommen. */
  skipped: number;
}
export class IcsFormatError extends Error {}

export const ICS_MAX_EVENTS = 1000;
export const ICS_MAX_BYTES = 5 * 1024 * 1024;

const FREQ: Record<string, ImportRecurrence> = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' };
/** Outlook schreibt Windows-Zonennamen; die häufigsten im deutschsprachigen Raum. */
const WINDOWS_ZONES: Record<string, string> = {
  'W. Europe Standard Time': 'Europe/Berlin',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'Romance Standard Time': 'Europe/Paris',
  'GMT Standard Time': 'Europe/London',
  'UTC': 'UTC',
};

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

export function parseIcs(text: string, localZone = Intl.DateTimeFormat().resolvedOptions().timeZone): ParsedIcs {
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw new IcsFormatError('Das ist keine Kalenderdatei (.ics). Exportiere den Kalender bitte als ICS-Datei.');
  }
  // Fortsetzungszeilen beginnen mit Leerzeichen oder Tab und gehören zur Zeile davor.
  const lines = text.replace(/\r\n[ \t]|\n[ \t]|\r[ \t]/g, '').split(/\r\n|\n|\r/);
  const result: ParsedIcs = { rows: [], simplified: 0, skipped: 0 };
  let current: Prop[] | null = null;
  let depth = 0;
  for (const line of lines) {
    if (/^BEGIN:VEVENT$/i.test(line)) {
      current = [];
      depth = 0;
      continue;
    }
    if (!current) continue;
    if (/^BEGIN:/i.test(line)) depth++;
    else if (/^END:VEVENT$/i.test(line)) {
      const row = toRow(current, localZone, result);
      if (row) result.rows.push(row);
      current = null;
    } else if (/^END:/i.test(line)) depth--;
    else if (depth === 0) {
      const prop = parseProp(line);
      if (prop) current.push(prop);
    }
  }
  if (result.rows.length > ICS_MAX_EVENTS) {
    throw new IcsFormatError(`Die Datei enthält ${result.rows.length} Termine. Bitte importiere höchstens ${ICS_MAX_EVENTS} auf einmal.`);
  }
  return result;
}

function parseProp(line: string): Prop | null {
  // Name und Parameter bis zum ersten Doppelpunkt außerhalb von Anführungszeichen.
  let quoted = false;
  let split = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ':' && !quoted) {
      split = i;
      break;
    }
  }
  if (split < 0) return null;
  const [name, ...rawParams] = line.slice(0, split).split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(split + 1) };
}

function toRow(props: Prop[], localZone: string, result: ParsedIcs): EventImportRow | null {
  const get = (name: string) => props.find((p) => p.name === name);
  if (get('STATUS')?.value.toUpperCase() === 'CANCELLED' || get('RECURRENCE-ID')) {
    result.skipped++;
    return null;
  }
  const start = get('DTSTART');
  if (!start) {
    result.skipped++;
    return null;
  }
  const allDay = start.params['VALUE'] === 'DATE' || /^\d{8}$/.test(start.value);
  const startAt = toInstant(start, localZone);
  if (!startAt) {
    result.skipped++;
    return null;
  }
  let endAt: Date | null = null;
  const end = get('DTEND');
  if (end) endAt = toInstant(end, localZone);
  else if (get('DURATION')) endAt = addDuration(startAt, get('DURATION')!.value);
  if (allDay) {
    // DTEND ist bei ganztägigen Terminen exklusiv; 4inOne speichert den letzten Tag (Mitternacht). Über das
    // Kalenderdatum gerechnet, nicht „minus 24 Stunden“ — sonst verrutscht es an Tagen der Zeitumstellung.
    const lastDay = end && /^\d{8}/.test(end.value) ? toInstant({ params: {}, value: previousDay(end.value.slice(0, 8)) }, localZone) : null;
    endAt = lastDay && lastDay.getTime() >= startAt.getTime() ? lastDay : startAt;
  }
  let recurrence: ImportRecurrence = '';
  const rule = get('RRULE');
  if (rule) {
    const parts = Object.fromEntries(rule.value.split(';').map((kv) => kv.split('=').map((s) => s.toUpperCase()) as [string, string]));
    const extra = Object.keys(parts).filter((k) => k !== 'FREQ' && k !== 'WKST' && !(k === 'INTERVAL' && parts[k] === '1'));
    if (FREQ[parts['FREQ']] && !extra.length) recurrence = FREQ[parts['FREQ']];
    else result.simplified++;
  }
  return {
    title: unescape(get('SUMMARY')?.value ?? '').trim().slice(0, 120) || 'Ohne Titel',
    starts_at: startAt.toISOString(),
    ends_at: endAt ? endAt.toISOString() : null,
    all_day: allDay,
    recurrence,
    location: unescape(get('LOCATION')?.value ?? '').trim().slice(0, 240),
    description: unescape(get('DESCRIPTION')?.value ?? '').trim().slice(0, 5000),
  };
}

/** Zeitpunkt aus DTSTART/DTEND: „…Z“ = UTC, TZID = Wanduhrzeit in dieser Zone, sonst Wanduhrzeit der Person.
 * Ganztägige Daten werden Mitternacht in der Zone der Person. */
export function toInstant(prop: Pick<Prop, 'params' | 'value'>, localZone: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(prop.value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4] ?? '0', m[5] ?? '0', m[6] ?? '0'].map(Number);
  if (m[7]) return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const tzid = prop.params['TZID'];
  const zone = !m[4] ? localZone : tzid ? (WINDOWS_ZONES[tzid] ?? tzid) : localZone;
  return zonedTime(y, mo, d, h, mi, s, isZone(zone) ? zone : localZone);
}

function isZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
/** Wanduhrzeit in `zone` → echter Zeitpunkt (zweimal korrigiert, damit auch Sommerzeit-Wechsel stimmen). */
function zonedTime(y: number, mo: number, d: number, h: number, mi: number, s: number, zone: string): Date {
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  let guess = wall - offset(wall, zone);
  guess = wall - offset(guess, zone);
  return new Date(guess);
}
function offset(at: number, zone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(at))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(Number(parts['year']), Number(parts['month']) - 1, Number(parts['day']), Number(parts['hour']), Number(parts['minute']), Number(parts['second']));
  return asUtc - Math.floor(at / 1000) * 1000;
}
/** „20261026“ → „20261025“ */
function previousDay(yyyymmdd: string): string {
  const d = new Date(Date.UTC(Number(yyyymmdd.slice(0, 4)), Number(yyyymmdd.slice(4, 6)) - 1, Number(yyyymmdd.slice(6, 8)) - 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}
/** „PT1H30M“, „P1D“ … → Ende. */
function addDuration(start: Date, value: string): Date | null {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m) return null;
  const [w, d, h, mi, s] = m.slice(1).map((v) => Number(v ?? 0));
  return new Date(start.getTime() + ((((w * 7 + d) * 24 + h) * 60 + mi) * 60 + s) * 1000);
}
function unescape(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}
