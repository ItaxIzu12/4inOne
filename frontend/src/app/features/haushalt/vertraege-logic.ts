import { SelectOption } from '../../shared/form/select';
import { FolderEntryDto } from './haushalt-api.service';
import { daysUntil } from './haushalt-logic';

/**
 * Anzeigeregeln für Verträge (Reiter „Verträge“ und Übersicht) — reine
 * Funktionen, einzeln testbar. Maßgeblich ist der letzte Kündigungstag
 * (cancel_by = Vertragsende minus Kündigungsfrist, backend services.cancel_by).
 */

/** Kündigung in den nächsten 90 Tagen → „Kündigung bald“. */
export const CANCEL_SOON_DAYS = 90;

export type ContractState = 'laeuft' | 'bald' | 'verpasst' | 'offen';

export interface ContractStatus {
  state: ContractState;
  label: string;
}

export function contractState(entry: { cancel_by: string | null }, today: Date = new Date()): ContractStatus {
  if (!entry.cancel_by) return { state: 'offen', label: 'Ohne Frist' };
  const days = daysUntil(entry.cancel_by, today);
  if (days < 0) return { state: 'verpasst', label: 'Frist verpasst' };
  if (days <= CANCEL_SOON_DAYS) return { state: 'bald', label: 'Kündigung bald' };
  return { state: 'laeuft', label: 'Läuft' };
}

export function monthly(entry: { monthly_cost: string | null }): number {
  return entry.monthly_cost ? Number(entry.monthly_cost) : 0;
}

export interface ContractStats {
  total: number;
  monthly: number;
  yearly: number;
  soon: number;
  withoutDeadline: number;
}

export function contractStats(contracts: FolderEntryDto[], today: Date = new Date()): ContractStats {
  const sum = contracts.reduce((total, c) => total + monthly(c), 0);
  return {
    total: contracts.length,
    monthly: sum,
    yearly: sum * 12,
    soon: contracts.filter((c) => contractState(c, today).state === 'bald').length,
    withoutDeadline: contracts.filter((c) => !c.cancel_by).length,
  };
}

export type ContractFilter = '' | ContractState;

export const CONTRACT_STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Alle Status' },
  { value: 'bald', label: 'Kündigung bald' },
  { value: 'laeuft', label: 'Läuft' },
  { value: 'verpasst', label: 'Frist verpasst' },
  { value: 'offen', label: 'Ohne Frist' },
];

export type ContractSort = 'frist' | 'kosten' | 'name';

export const CONTRACT_SORT_LABEL: Record<ContractSort, string> = {
  frist: 'nach Kündigungsfrist',
  kosten: 'nach Kosten',
  name: 'nach Name',
};

export function filterContracts(
  contracts: FolderEntryDto[],
  query: string,
  status: ContractFilter,
  today: Date = new Date(),
): FolderEntryDto[] {
  const q = query.trim().toLocaleLowerCase('de');
  return contracts.filter((c) => {
    if (q && ![c.name, c.provider, c.notes].some((v) => v.toLocaleLowerCase('de').includes(q))) return false;
    return !status || contractState(c, today).state === status;
  });
}

export function sortContracts(contracts: FolderEntryDto[], sort: ContractSort): FolderEntryDto[] {
  const sorted = [...contracts];
  if (sort === 'name') return sorted.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  if (sort === 'kosten') return sorted.sort((a, b) => monthly(b) - monthly(a) || a.name.localeCompare(b.name, 'de'));
  return sorted.sort(
    (a, b) => (a.cancel_by ?? '9999').localeCompare(b.cancel_by ?? '9999') || a.name.localeCompare(b.name, 'de'),
  );
}

const EURO = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function euro(value: number): string {
  return EURO.format(value);
}

/** „1 Monat“ / „3 Monate“ / „keine“. */
export function noticeLabel(months: number | null): string {
  if (!months) return 'keine';
  return months === 1 ? '1 Monat' : `${months} Monate`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

/** „heute“, „in 5 Tagen“, „in 2 Wochen“, „in 3 Monaten“, „in 2 Jahren“ — und rückwärts mit „vor …“. */
export function fromNow(iso: string, today: Date = new Date()): string {
  const days = daysUntil(iso, today);
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  if (days === -1) return 'gestern';
  const n = Math.abs(days);
  const months = Math.round(n / 30.4);
  const years = Math.round(n / 365);
  const [amount, unit] =
    n < 14 ? [n, 'Tagen']
    : n < 60 ? [Math.round(n / 7), 'Wochen']
    : n < 365 ? [months, months === 1 ? 'Monat' : 'Monaten']
    : [years, years === 1 ? 'Jahr' : 'Jahren'];
  return days > 0 ? `in ${amount} ${unit}` : `vor ${amount} ${unit}`;
}
