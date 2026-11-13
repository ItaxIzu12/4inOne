import { ConnectionObjectType } from './connections-api.service';

/**
 * „Passt dieser Eintrag dazu?“ – Spiegel von backend/connections/relevance.py (und den Wortlisten aus
 * link_suggestions.py) für die Demo, damit die Auswahl beim Verknüpfen dort genauso entscheidet wie mit Konto.
 * backend/connections/tests/test_demo_mirror.py prüft, dass Paare und Wortlisten übereinstimmen.
 */

// prettier-ignore
export const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'und', 'oder', 'aber',
  'fuer', 'mit', 'von', 'vom', 'zum', 'zur', 'nach', 'bei', 'aus', 'auf', 'ins', 'im', 'am', 'an', 'in', 'zu',
  'bis', 'ab', 'neu', 'neue', 'neuer', 'neues', 'neuen', 'alt', 'alte', 'alter', 'altes', 'mein', 'meine',
  'unser', 'unsere', 'noch', 'mal', 'mehr', 'fuers', 'ueber', 'unter', 'vor', 'wegen', 'pruefen', 'bestaetigen',
  'erledigen', 'machen', 'kaufen', 'besorgen', 'planen', 'organisieren', 'sparen', 'sparziel', 'geld', 'kosten',
  'reise', 'reisen', 'urlaub', 'trip', 'tour', 'ferien', 'wochenende', 'kurztrip', 'auszeit', 'sommer', 'winter',
  'fruehling', 'herbst', 'sommerurlaub', 'winterurlaub', 'familie', 'freunde', 'termin', 'aufgabe', 'vertrag',
  'geraet', 'haushalt', 'zuhause', 'home', 'privat', 'wichtig', 'dringend', 'todo',
]);
// prettier-ignore
export const TRAVEL_WORDS = new Set([
  'hotel', 'unterkunft', 'ferienwohnung', 'airbnb', 'hostel', 'flug', 'flughafen', 'boarding', 'zug', 'ice',
  'bahn', 'bus', 'faehre', 'mietwagen', 'transfer', 'checkin', 'check', 'koffer', 'packen', 'packliste', 'visum',
  'reisepass', 'pass', 'ausweis', 'esta', 'tickets', 'ticket', 'abflug', 'anreise', 'abreise', 'rueckreise',
  'rueckflug', 'hinflug', 'buchen', 'buchung', 'reservieren', 'reservierung', 'impfung', 'roaming', 'waehrung',
]);
// prettier-ignore
export const TRIP_GOAL_WORDS = new Set([...TRAVEL_WORDS,
  'reise', 'reisen', 'urlaub', 'trip', 'ferien', 'reisekasse', 'reisebudget', 'urlaubskasse', 'urlaubsgeld', 'kurztrip', 'staedtetrip',
]);
// prettier-ignore
export const CONTRACT_WORDS = new Set([
  'hotline', 'kundenservice', 'kundennummer', 'vertragsnummer', 'kundenkonto',
  'vertrag', 'vertraege', 'kuendigen', 'kuendigung', 'tarif', 'verlaengern', 'verlaengerung', 'wechseln',
  'wechsel', 'anbieter', 'rechnung', 'abrechnung', 'zaehlerstand', 'zaehler', 'beitrag', 'police',
  'versicherung', 'laufzeit', 'preiserhoehung', 'widerspruch',
]);

export const GOAL_LEAD_DAYS = 180;
export const TASK_LEAD_DAYS = 30;
export const EVENT_MARGIN_DAYS = 1;

/** Was die Regel über einen Eintrag wissen muss – unabhängig vom Bereich. */
export interface RelevanceFacts {
  type: ConnectionObjectType;
  /** Titel; bei Reisen Titel + Ziel, bei Gerät/Vertrag Name + Anbieter */
  text: string;
  /** „YYYY-MM-DD“: Fälligkeit, Termin-Tag, Zieldatum – sonst null */
  day: string | null;
  /** Nur Reisen */
  start?: string;
  end?: string;
  /** Nur Haushaltsaufgaben: wiederkehrend */
  recurring?: boolean;
}

/** Wie backend `_fold`: klein, Umlaute ausgeschrieben, Akzente weg, nur Buchstaben/Ziffern. */
export function fold(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ');
}
/** Bedeutungstragende Wörter (gefaltet) – wie backend `words(text, min_length)`. */
export function words(text: string, minLength = 4): Set<string> {
  const result = new Set<string>();
  for (const original of (text || '').match(/[\p{L}\p{N}]+/gu) ?? []) {
    const folded = fold(original).trim();
    if (folded.length >= minLength && !STOPWORDS.has(folded) && !/^\d+$/.test(folded)) result.add(folded);
  }
  return result;
}
function flags(text: string, vocabulary: Set<string>): boolean {
  return fold(text).split(' ').some((token) => vocabulary.has(token));
}
/** Gemeinsames Wort: gleich, oder ab fünf Buchstaben Wortanfang des anderen („Berlin“/„Berliner“). */
export function sharesWord(a: string, b: string): boolean {
  const left = words(a, 3);
  const right = words(b, 3);
  for (const w of left) if (right.has(w)) return true;
  for (const w of left) {
    for (const other of right) {
      const [short, long] = w.length <= other.length ? [w, other] : [other, w];
      if (short.length >= 5 && long.startsWith(short)) return true;
    }
  }
  return false;
}
function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tripFit(trip: RelevanceFacts, other: RelevanceFacts): boolean {
  const near = (lead: number, margin = 0) =>
    !!other.day && !!trip.start && !!trip.end && shift(trip.start, -lead) <= other.day && other.day <= shift(trip.end, margin);
  if (sharesWord(trip.text, other.text)) return true;
  switch (other.type) {
    case 'SAVINGS_GOAL':
      return flags(other.text, TRIP_GOAL_WORDS) || near(GOAL_LEAD_DAYS);
    case 'TASK':
      return flags(other.text, TRAVEL_WORDS) || near(TASK_LEAD_DAYS, 1);
    case 'CALENDAR_EVENT':
      return near(EVENT_MARGIN_DAYS, EVENT_MARGIN_DAYS);
    case 'HOUSEHOLD_TASK':
      return !!other.recurring || near(0);
    default:
      return false;
  }
}

/** True, wenn `b` erkennbar zu `a` passt (Reihenfolge egal) – dieselben Regeln wie das Backend. */
export function fits(a: RelevanceFacts, b: RelevanceFacts): boolean {
  if (a.type === 'TRIP') return tripFit(a, b);
  if (b.type === 'TRIP') return tripFit(b, a);
  const pair = new Set([a.type, b.type]);
  if (pair.has('CONTRACT') && pair.has('TASK')) {
    const task = a.type === 'TASK' ? a : b;
    return sharesWord(a.text, b.text) || flags(task.text, CONTRACT_WORDS);
  }
  if (pair.has('CALENDAR_EVENT') && (pair.has('TASK') || pair.has('HOUSEHOLD_TASK'))) {
    return sharesWord(a.text, b.text) || (!!a.day && a.day === b.day);
  }
  return sharesWord(a.text, b.text);
}
