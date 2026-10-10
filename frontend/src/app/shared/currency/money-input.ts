/**
 * Betragseingaben so lesen, wie Menschen sie auf Deutsch tippen — der eine Leser für alle Betragsfelder.
 *
 *   „700“ · „700,5“ · „700,50“ · „1.500“ · „1.500,50“ · „250.000“ · „1500.5“ · „2 000 €“
 *
 * Regeln: Ein Komma ist immer das Dezimalzeichen, Punkte davor gruppieren Tausender (nur in Dreiergruppen). Ohne Komma
 * gruppiert ein Punkt vor genau drei Ziffern Tausender („1.500“ = 1500, Cent haben nie drei Stellen), sonst ist er das
 * Dezimalzeichen („1500.5“). Höchstens zwei Nachkommastellen. Alles andere ist ungültig — nie wird geraten.
 */
export function normalizeMoneyInput(raw: string): string | null {
  const text = raw.replace(/[\s €$£¥]|EUR|CHF|USD|GBP|JPY/gi, '');
  if (!text) return null;
  let whole: string;
  let fraction = '';
  let match: RegExpMatchArray | null;
  if ((match = text.match(/^(\d{1,3}(?:\.\d{3})+|\d+),(\d{0,2})$/))) {
    [whole, fraction] = [match[1].replace(/\./g, ''), match[2]];
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) {
    whole = text.replace(/\./g, '');
  } else if ((match = text.match(/^(\d+)(?:\.(\d{1,2}))?$/))) {
    [whole, fraction] = [match[1], match[2] ?? ''];
  } else {
    return null;
  }
  whole = whole.replace(/^0+(?=\d)/, '');
  return fraction ? `${whole}.${fraction.padEnd(2, '0')}` : whole;
}

/** Wie normalizeMoneyInput, als Zahl (für Anzeige/Vorschau). Leer → 0, ungültig → null. */
export function parseMoneyInput(raw: string): number | null {
  if (!raw.trim()) return 0;
  const normalized = normalizeMoneyInput(raw);
  return normalized === null ? null : Number(normalized);
}

/** Für das Feld nach dem Verlassen: „250000“ → „250.000“, „1500.5“ → „1.500,50“. Ungültiges bleibt, wie es ist. */
export function formatMoneyInput(raw: string): string {
  const normalized = normalizeMoneyInput(raw);
  if (normalized === null) return raw;
  const [whole, fraction] = normalized.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return fraction ? `${grouped},${fraction}` : grouped;
}
