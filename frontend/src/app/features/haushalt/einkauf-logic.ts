import { IconName } from '../../shared/icons/app-icon';
import { SectionDto, SectionKey, ShoppingItemDto, ShoppingListIcon } from './haushalt-api.service';

/**
 * Anzeigeregeln der Einkaufslisten — reine Funktionen, einzeln testbar.
 * Mengen bleiben im Backend ein freier Text („500 g“); hier wird er nur für
 * die Spalten Menge und Einheit aufgeteilt.
 */

export const SECTION_ICONS: Record<SectionKey, { icon: IconName; tone: string }> = {
  obst_gemuese: { icon: 'apple', tone: 'red' },
  backwaren: { icon: 'bread', tone: 'amber' },
  kuehlregal: { icon: 'milk', tone: 'blue' },
  fleisch_fisch: { icon: 'meat', tone: 'rose' },
  tiefkuehl: { icon: 'snowflake', tone: 'cyan' },
  vorrat: { icon: 'package', tone: 'amber' },
  getraenke: { icon: 'bottle', tone: 'blue' },
  drogerie: { icon: 'spray', tone: 'violet' },
  haushalt: { icon: 'household', tone: 'green' },
  kleidung: { icon: 'shirt', tone: 'violet' },
  sonstiges: { icon: 'tag', tone: 'gray' },
};

export const LIST_ICONS: { value: ShoppingListIcon; label: string; icon: IconName }[] = [
  { value: 'wagen', label: 'Einkauf', icon: 'cart' },
  { value: 'drogerie', label: 'Drogerie', icon: 'spray' },
  { value: 'baumarkt', label: 'Baumarkt', icon: 'toolbox' },
  { value: 'getraenke', label: 'Getränke', icon: 'bottle' },
  { value: 'party', label: 'Party', icon: 'gift' },
];

export function listIcon(value: ShoppingListIcon): IconName {
  return LIST_ICONS.find((l) => l.value === value)?.icon ?? 'cart';
}

/** „500 g“ → 500 | g, „1,5 l“ → 1,5 | l, „Bio“ → '' | Bio, „“ → '' | ''. */
export function splitQuantity(quantity: string): { amount: string; unit: string } {
  const text = quantity.trim();
  const match = /^(\d+(?:[.,]\d+)?|½|¼)\s*(.*)$/.exec(text);
  if (!match) return { amount: '', unit: text };
  return { amount: match[1], unit: match[2] };
}

export interface ItemGroup {
  section: SectionDto;
  items: ShoppingItemDto[];
  /** Abgehakt / gesamt im Bereich — auch im Einkaufsmodus, der Abgehakte ausblendet. */
  done: number;
  total: number;
}

/** Alle Einträge nach Ladenbereich (Supermarkt-Reihenfolge), abgehakte bleiben
 * durchgestrichen an ihrem Platz. `onlyOpen` (Einkaufsmodus) blendet Abgehakte
 * aus — außer denen, die gerade noch kurz stehen bleiben (`settling`). */
export function groupItems(
  items: ShoppingItemDto[],
  sections: SectionDto[],
  onlyOpen = false,
  settling: ReadonlySet<ShoppingItemDto['id']> = new Set(),
): ItemGroup[] {
  return sections
    .map((section) => {
      const all = items.filter((i) => i.section === section.key);
      const shown = onlyOpen ? all.filter((i) => !i.is_checked || settling.has(i.id)) : all;
      return {
        section,
        items: [...shown].sort((a, b) => a.name.localeCompare(b.name, 'de')),
        done: all.filter((i) => i.is_checked).length,
        total: all.length,
      };
    })
    .filter((group) => group.items.length > 0);
}

/** „gerade eben“, „vor 5 Minuten“, „vor 2 Stunden“, „vor 1 Tag“, „vor 3 Tagen“, sonst Datum. */
export function ago(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return minutes === 1 ? 'vor 1 Minute' : `vor ${minutes} Minuten`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? 'vor 1 Stunde' : `vor ${hours} Stunden`;
  const days = Math.floor(hours / 24);
  if (days < 14) return days === 1 ? 'vor 1 Tag' : `vor ${days} Tagen`;
  return LONG_DATE.format(new Date(iso));
}

const LONG_DATE = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

export function longDate(iso: string): string {
  return LONG_DATE.format(new Date(iso));
}

/** „Heute, 09:41“ / „Gestern, 18:02“ / „12. Apr. 2024“. */
export function editedLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(now) - day(date)) / 86_400_000);
  if (diff === 0) return `Heute, ${TIME.format(date)}`;
  if (diff === 1) return `Gestern, ${TIME.format(date)}`;
  return LONG_DATE.format(date);
}

/** Die zuletzt eingetragenen Artikel, neueste zuerst. */
export function recentItems(items: ShoppingItemDto[], limit = 4): ShoppingItemDto[] {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}
