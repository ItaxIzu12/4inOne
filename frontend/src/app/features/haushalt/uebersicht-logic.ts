import { IconName } from '../../shared/icons/app-icon';

/**
 * Gemeinsame Anzeigeregeln für wiederkehrende Aufgaben (routinen-logic.ts) — reine Funktionen, damit sie einzeln
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
