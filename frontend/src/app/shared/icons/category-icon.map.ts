import { Type } from '@angular/core';
import { IconFixkosten } from './icon-fixkosten';
import { IconHaushalt } from './icon-haushalt';
import { IconSonstiges } from './icon-sonstiges';

/**
 * Zuordnung Category.icon_key (Backend, finanzen/models.py) → Icon-
 * Komponente. Bewusst eine Record-Map statt eines @switch-Statements
 * (siehe Aufgabenstellung) — eine neue Kategorie-Art braucht nur einen
 * neuen Eintrag hier plus die passende Icon-Komponente, keine Änderung an
 * jeder Stelle, die Icons anhand von icon_key rendert (siehe resolveCategoryIcon).
 */
export const CATEGORY_ICON_MAP: Record<string, Type<unknown>> = {
  fixkosten: IconFixkosten,
  haushalt: IconHaushalt,
  sonstiges: IconSonstiges,
};

export const DEFAULT_CATEGORY_ICON_KEY = 'sonstiges';

/** Fällt auf das "Sonstiges"-Icon zurück, falls icon_key unbekannt/leer ist
 * (z. B. weil eine neue Kategorie-Art im Backend existiert, für die das
 * Frontend noch keinen Eintrag in CATEGORY_ICON_MAP bekommen hat). */
export function resolveCategoryIcon(iconKey: string | undefined | null): Type<unknown> {
  return (iconKey && CATEGORY_ICON_MAP[iconKey]) || CATEGORY_ICON_MAP[DEFAULT_CATEGORY_ICON_KEY];
}
