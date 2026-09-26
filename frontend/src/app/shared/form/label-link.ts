let nextLabelId = 0;

export interface FieldLabel {
  id: string;
  text: string;
}

/**
 * Findet die Beschriftung des umgebenden <app-field> (vergibt ihre id bei Bedarf).
 * Der Auslöser eines Auswahlfeldes verweist per aria-labelledby darauf — sonst würde das umgebende
 * <label> auch den Text im Auslöser („Ausgabe“, „September 2026“) in den Namen des Feldes ziehen.
 * Der Text dient für Felder aus mehreren Teilen („Beginn – Datum“, „Beginn – Uhrzeit“).
 */
export function fieldLabel(host: HTMLElement): FieldLabel | null {
  const label = host.closest('app-field')?.querySelector<HTMLElement>('.field__label');
  if (!label) return null;
  if (!label.id) label.id = `field-label-${nextLabelId++}`;
  return { id: label.id, text: (label.textContent ?? '').replace(/\s+/g, ' ').trim().replace(/ \(optional\)$/, '') };
}

/** Kurzform: nur die id (bisherige Nutzung). */
export function fieldLabelId(host: HTMLElement): string | null {
  return fieldLabel(host)?.id ?? null;
}
