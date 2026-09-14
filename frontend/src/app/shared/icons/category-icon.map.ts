import { Type } from '@angular/core';
import { IconBildung } from './icon-bildung';
import { IconFixkosten } from './icon-fixkosten';
import { IconFreizeit } from './icon-freizeit';
import { IconGeschenke } from './icon-geschenke';
import { IconGesundheit } from './icon-gesundheit';
import { IconHaushalt } from './icon-haushalt';
import { IconSonstiges } from './icon-sonstiges';
import { IconTransport } from './icon-transport';

/**
 * Zuordnung Category.icon_key (Backend, finanzen/models.py) → Icon-
 * Komponente. Bewusst eine Record-Map statt eines @switch-Statements
 * (siehe Aufgabenstellung) — eine neue Kategorie-Art braucht nur einen
 * neuen Eintrag hier plus die passende Icon-Komponente, keine Änderung an
 * jeder Stelle, die Icons anhand von icon_key rendert (siehe resolveCategoryIcon).
 *
 * MUSS synchron mit ALLOWED_CATEGORY_ICON_KEYS (backend/finanzen/
 * serializers.py) gehalten werden — das Backend lehnt einen icon_key beim
 * Anlegen/Bearbeiten einer Kategorie ab, für den es hier keinen Eintrag
 * gibt, damit nie ein icon_key gespeichert werden kann, für den das
 * Frontend keine passende Icon-Komponente hat.
 */
export const CATEGORY_ICON_MAP: Record<string, Type<unknown>> = {
  fixkosten: IconFixkosten,
  haushalt: IconHaushalt,
  sonstiges: IconSonstiges,
  freizeit: IconFreizeit,
  gesundheit: IconGesundheit,
  bildung: IconBildung,
  transport: IconTransport,
  geschenke: IconGeschenke,
};

// Für die Icon-Kachel-Auswahl im "Kategorie hinzufügen"-Sheet (siehe
// features/finanzen/finanzen.ts) — feste Reihenfolge statt Object.keys()
// direkt zu iterieren, damit sich die Anzeige-Reihenfolge nicht zufällig
// mit der Deklarationsreihenfolge oben verschiebt.
export const CATEGORY_ICON_KEYS: readonly string[] = [
  'fixkosten',
  'haushalt',
  'sonstiges',
  'freizeit',
  'gesundheit',
  'bildung',
  'transport',
  'geschenke',
];

export const DEFAULT_CATEGORY_ICON_KEY = 'sonstiges';

/** Fällt auf das "Sonstiges"-Icon zurück, falls icon_key unbekannt/leer ist
 * (z. B. weil eine neue Kategorie-Art im Backend existiert, für die das
 * Frontend noch keinen Eintrag in CATEGORY_ICON_MAP bekommen hat). */
export function resolveCategoryIcon(iconKey: string | undefined | null): Type<unknown> {
  return (iconKey && CATEGORY_ICON_MAP[iconKey]) || CATEGORY_ICON_MAP[DEFAULT_CATEGORY_ICON_KEY];
}
