import { BillingCycle, FolderKind } from '../data/household-api.service';

/**
 * H2 – Vorlagen für Zuhause: ein Tipp füllt im Formular „Neuer Vertrag“ / „Neues Gerät“ nur Name, Kategorie und
 * übliche Fristen vor. Nichts wird ohne „Speichern“ angelegt; alle Werte bleiben änderbar. Die Fristen sind
 * verbreitete Werte, keine Rechtsauskunft – das Formular sagt dazu: „Prüfe sie in deinem Vertrag.“
 */
export interface HomeTemplate {
  key: string;
  kind: FolderKind;
  name: string;
  /** Kurzer Text für die Marke (am Handy passen so mehr in eine Zeile); sonst der Name. */
  label?: string;
  category: string;
  /** Verträge: Kündigungsfrist in Monaten, Abrechnung, automatische Verlängerung. */
  noticeMonths?: number;
  billing?: BillingCycle;
  autoRenewal?: boolean;
  /** Geräte: Wartung alle … Monate. */
  maintenanceMonths?: number;
}

export const HOME_TEMPLATES: readonly HomeTemplate[] = [
  { key: 'strom', kind: 'vertrag', name: 'Strom', category: 'Energie', noticeMonths: 1, billing: 'MONTHLY', autoRenewal: true },
  { key: 'gas', kind: 'vertrag', name: 'Gas', category: 'Energie', noticeMonths: 1, billing: 'MONTHLY', autoRenewal: true },
  { key: 'internet', kind: 'vertrag', name: 'Internet', category: 'Telekommunikation', noticeMonths: 1, billing: 'MONTHLY', autoRenewal: true },
  { key: 'handy', kind: 'vertrag', name: 'Handyvertrag', label: 'Handy', category: 'Telekommunikation', noticeMonths: 1, billing: 'MONTHLY', autoRenewal: true },
  { key: 'haftpflicht', kind: 'vertrag', name: 'Haftpflichtversicherung', label: 'Haftpflicht', category: 'Versicherung', noticeMonths: 3, billing: 'YEARLY', autoRenewal: true },
  { key: 'hausrat', kind: 'vertrag', name: 'Hausratversicherung', label: 'Hausrat', category: 'Versicherung', noticeMonths: 3, billing: 'YEARLY', autoRenewal: true },
  { key: 'kfz', kind: 'vertrag', name: 'Kfz-Versicherung', label: 'Kfz', category: 'Versicherung', noticeMonths: 1, billing: 'YEARLY', autoRenewal: true },
  { key: 'waschmaschine', kind: 'geraet', name: 'Waschmaschine', category: 'Haushaltsgerät' },
  { key: 'kuehlschrank', kind: 'geraet', name: 'Kühlschrank', category: 'Küche' },
  { key: 'geschirrspueler', kind: 'geraet', name: 'Geschirrspüler', category: 'Küche' },
  { key: 'heizung', kind: 'geraet', name: 'Heizung', category: 'Haustechnik', maintenanceMonths: 12 },
  { key: 'rauchmelder', kind: 'geraet', name: 'Rauchmelder', category: 'Sicherheit', maintenanceMonths: 12 },
];

export function templatesFor(kind: FolderKind): HomeTemplate[] {
  return HOME_TEMPLATES.filter((t) => t.kind === kind);
}
