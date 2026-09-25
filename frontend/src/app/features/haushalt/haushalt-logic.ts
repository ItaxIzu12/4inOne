import { SectionDto, SectionKey, ShoppingItemDto } from './haushalt-api.service';

// Reihenfolge und Beschriftung wie backend/haushalt/models.py Section — die
// echte API liefert sie zusätzlich mit (ShoppingOverviewDto.sections), die
// Demo nutzt diese Liste direkt.
export const SECTIONS: SectionDto[] = [
  { key: 'obst_gemuese', label: 'Obst & Gemüse' },
  { key: 'backwaren', label: 'Brot & Backwaren' },
  { key: 'kuehlregal', label: 'Kühlregal' },
  { key: 'fleisch_fisch', label: 'Fleisch & Fisch' },
  { key: 'tiefkuehl', label: 'Tiefkühl' },
  { key: 'vorrat', label: 'Vorrat' },
  { key: 'getraenke', label: 'Getränke' },
  { key: 'drogerie', label: 'Drogerie' },
  { key: 'haushalt', label: 'Haushalt' },
  { key: 'sonstiges', label: 'Sonstiges' },
];

/** Vorschlag für den Einkaufsbetrag: Artikelzahl × Durchschnittspreis, auf
 * 50 Cent gerundet — ein runder Wert, den man per Schieberegler bestätigt
 * ("War es ungefähr 64 €?"), keine Scheingenauigkeit. */
export function estimateAmount(pricePerItem: number, itemCount: number): number {
  if (itemCount <= 0 || !Number.isFinite(pricePerItem)) return 0;
  return Math.round(pricePerItem * itemCount * 2) / 2;
}

/** Obergrenze des Schiebereglers: großzügig über der Schätzung, damit auch
 * ein deutlich teurerer Einkauf ohne Tippen einstellbar ist. */
export function sliderMax(estimate: number): number {
  return Math.max(50, Math.ceil((estimate * 2.5) / 10) * 10);
}

export interface SectionGroup {
  section: SectionDto;
  items: ShoppingItemDto[];
}

/** Offene Einträge nach Ladenbereich gruppiert, in Supermarkt-Reihenfolge.
 * `settling`: gerade abgehakte Einträge, die noch kurz an ihrem Platz
 * bleiben (siehe EinkaufTab.toggle). */
export function groupOpenItems(
  items: ShoppingItemDto[],
  sections: SectionDto[],
  settling: ReadonlySet<ShoppingItemDto['id']> = new Set(),
): SectionGroup[] {
  return sections
    .map((section) => ({
      section,
      items: items
        .filter((item) => (!item.is_checked || settling.has(item.id)) && item.section === section.key)
        .sort((a, b) => a.name.localeCompare(b.name, 'de')),
    }))
    .filter((group) => group.items.length > 0);
}

/** "YYYY-MM-DD" in lokaler Zeit — toISOString() wäre UTC und kippt abends
 * auf den Folgetag. */
export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayIso(): string {
  return isoDate(new Date());
}

export function addDaysIso(days: number, from: Date = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return isoDate(date);
}

/** Wie backend haushalt/services.py add_months: Tag wird aufs Monatsende
 * begrenzt (31.01. + 1 Monat = 28./29.02.). */
export function addMonthsIso(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return isoDate(target);
}

/** Ganze Tage von heute bis zum Datum (negativ = vergangen). */
export function daysUntil(iso: string, today: Date = new Date()): number {
  const [year, month, day] = iso.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / 86_400_000);
}

/** Kurze, gut lesbare Fälligkeit: "heute", "morgen", "in 5 Tagen",
 * "seit 2 Tagen überfällig", sonst das Datum. */
export function relativeDay(iso: string, today: Date = new Date()): string {
  const days = daysUntil(iso, today);
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  if (days === -1) return 'seit gestern überfällig';
  if (days < 0) return `seit ${-days} Tagen überfällig`;
  if (days < 14) return `in ${days} Tagen`;
  const [year, month, day] = iso.split('-');
  return `am ${day}.${month}.${year}`;
}

export function recurrenceLabel(days: number | null, months: number | null = null): string {
  if (months) return months === 1 ? 'monatlich' : `alle ${months} Monate`;
  if (!days) return 'einmalig';
  if (days === 1) return 'täglich';
  if (days === 7) return 'wöchentlich';
  if (days === 14) return 'alle 2 Wochen';
  if (days === 30 || days === 31) return 'monatlich';
  return `alle ${days} Tage`;
}

// Nur für die Demo (die echte Einordnung macht backend haushalt/services.py
// guess_section): eine kleine Auswahl häufiger Begriffe, damit neue
// Demo-Einträge nicht alle unter "Sonstiges" landen.
const DEMO_KEYWORDS: [SectionKey, string[]][] = [
  ['obst_gemuese', ['apfel', 'äpfel', 'banane', 'tomate', 'gurke', 'salat', 'kartoffel', 'zwiebel', 'paprika', 'obst', 'gemüse']],
  ['backwaren', ['brot', 'brötchen', 'toast', 'croissant']],
  ['kuehlregal', ['milch', 'joghurt', 'käse', 'butter', 'quark', 'sahne', 'eier']],
  ['fleisch_fisch', ['fleisch', 'hähnchen', 'hack', 'wurst', 'fisch', 'lachs']],
  ['tiefkuehl', ['pizza', 'pommes', 'tiefkühl']],
  ['vorrat', ['nudel', 'reis', 'mehl', 'zucker', 'kaffee', 'tee', 'müsli', 'öl']],
  ['getraenke', ['wasser', 'saft', 'bier', 'wein', 'cola']],
  ['drogerie', ['shampoo', 'duschgel', 'seife', 'zahnpasta', 'deo']],
  ['haushalt', ['klopapier', 'toilettenpapier', 'spülmittel', 'waschmittel', 'müllbeutel', 'küchenrolle']],
];

export function guessSectionDemo(name: string): SectionKey {
  const lowered = name.toLowerCase();
  for (const [section, keywords] of DEMO_KEYWORDS) {
    if (keywords.some((keyword) => lowered.includes(keyword))) return section;
  }
  return 'sonstiges';
}
