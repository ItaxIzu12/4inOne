import { FinanceTransaction } from '../data/private-finance-api.service';

/**
 * F1 – Erfassung, die mitlernt: Aus den eigenen früheren Buchungen die Kategorie vorschlagen, die zu einem Text
 * („REWE“, „Netflix“, „REWE Markt GmbH · Kartenzahlung“) zuletzt am häufigsten gewählt wurde.
 * Rein im Browser aus den bereits geladenen Buchungen – keine neue API, nichts wird gespeichert.
 */
export interface CategorySuggestion {
  category: number;
  /** Wie viele frühere Buchungen mit diesem Text in dieser Kategorie liegen. */
  matches: number;
}

/** Wörter, die in Kontoauszügen vor dem eigentlichen Empfänger stehen und nichts über die Kategorie sagen. */
const NOISE = new Set([
  'der', 'die', 'das', 'und', 'für', 'von', 'bei', 'gmbh', 'co', 'kg', 'sepa', 'lastschrift', 'basislastschrift',
  'kartenzahlung', 'überweisung', 'ueberweisung', 'dauerauftrag', 'gutschrift', 'zahlung', 'paypal', 'europe',
]);

function normal(text: string): string {
  return text.toLocaleLowerCase('de').replace(/\s+/g, ' ').trim();
}
/** Das erste aussagekräftige Wort (mindestens 3 Zeichen, kein Füllwort) – bei Auszügen meist der Empfänger. */
export function keyWord(text: string): string {
  return (
    normal(text)
      .split(/[^\p{L}\p{N}]+/u)
      .find((word) => word.length >= 3 && !NOISE.has(word) && !/^\d+$/.test(word)) ?? ''
  );
}

/**
 * Vorschlag für eine neue Buchung. Zuerst zählen Buchungen mit genau demselben Text, sonst solche mit demselben
 * Schlüsselwort. Gewinnt die häufigste Kategorie, bei Gleichstand die zuletzt benutzte.
 * @param skip Kategorien, die nie vorgeschlagen werden (z. B. „Sonstiges“, wohin unbekannte Importe fallen).
 */
export function suggestCategory(
  note: string,
  type: FinanceTransaction['type'],
  history: readonly FinanceTransaction[],
  options: { exclude?: number | null; skip?: ReadonlySet<number> } = {},
): CategorySuggestion | null {
  const text = normal(note);
  if (text.length < 3) return null;
  const pool = history.filter((t) => t.type === type && t.id !== options.exclude && t.note && !options.skip?.has(t.category));
  let matches = pool.filter((t) => normal(t.note) === text);
  const word = keyWord(note);
  if (!matches.length && word) matches = pool.filter((t) => keyWord(t.note) === word);
  if (!matches.length) return null;
  const byCategory = new Map<number, { count: number; latest: string }>();
  for (const t of matches) {
    const entry = byCategory.get(t.category) ?? { count: 0, latest: '' };
    entry.count++;
    if (t.date > entry.latest) entry.latest = t.date;
    byCategory.set(t.category, entry);
  }
  const [category, best] = [...byCategory].sort((a, b) => b[1].count - a[1].count || b[1].latest.localeCompare(a[1].latest))[0];
  return { category, matches: best.count };
}

/**
 * CSV-Import: Zeilen ohne Kategorie bekommen den Namen der Kategorie, die zum Text passt. Das Backend ordnet Namen
 * ohne Rücksicht auf Groß-/Kleinschreibung zu; eine vorhandene Kategoriespalte der Bank hat Vorrang.
 */
export function prefillImportCategories<T extends { note: string; type: FinanceTransaction['type']; category: string }>(
  rows: readonly T[],
  history: readonly FinanceTransaction[],
  categoryName: (id: number) => string | undefined,
  skip?: ReadonlySet<number>,
): T[] {
  return rows.map((row) => {
    if (row.category) return row;
    const suggestion = suggestCategory(row.note, row.type, history, { skip });
    const name = suggestion ? categoryName(suggestion.category) : undefined;
    return name ? { ...row, category: name } : row;
  });
}
