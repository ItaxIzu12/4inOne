import { SelectOption } from '../../shared/form/select';
import { BillingCycle, ContractStatus, FolderEntryDto } from './haushalt-api.service';
import { daysUntil, isoDate } from './haushalt-logic';

/**
 * Regeln für Verträge (Reiter „Zuhause → Verträge“ und „Heute“) — reine
 * Funktionen, einzeln testbar. Dieselben Regeln wie backend haushalt/services.py
 * (cancellation_deadline, contract_status, monthly_equivalent); die Demo
 * rechnet damit, die echte API liefert die Werte fertig.
 */

/** „Demnächst“: Fristen in den nächsten 30 Tagen — wie backend services.UPCOMING_DAYS. */
export const UPCOMING_DAYS = 30;

export type ContractTone = 'laeuft' | 'bald' | 'verpasst' | 'offen';

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  ACTIVE: 'Aktiv',
  EXPIRING: 'Läuft aus',
  CANCELLED: 'Gekündigt',
  ENDED: 'Beendet',
};
const CONTRACT_TONE: Record<ContractStatus, ContractTone> = {
  ACTIVE: 'laeuft',
  EXPIRING: 'bald',
  CANCELLED: 'offen',
  ENDED: 'verpasst',
};

export interface ContractView {
  status: ContractStatus;
  state: ContractTone;
  label: string;
}

/** Anzeige eines Vertrags nach seinem wirksamen Status. */
export function contractState(entry: { effective_status: string }): ContractView {
  const status = (entry.effective_status in CONTRACT_TONE ? entry.effective_status : 'ACTIVE') as ContractStatus;
  return { status, state: CONTRACT_TONE[status], label: CONTRACT_STATUS_LABEL[status] };
}

/** Letzter Kündigungstag: Vertragsende minus Kündigungsfrist in Tagen (31.12.2026 − 30 = 01.12.2026). */
export function cancellationDeadline(endDate: string | null, noticeDays: number | null): string | null {
  if (!endDate) return null;
  const [y, m, d] = endDate.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d - (noticeDays ?? 0)));
}

/** Wirksamer Status wie backend services.contract_status. */
export function computeContractStatus(
  entry: { status: string; end_date: string | null; notice_period_days: number | null; auto_renewal: boolean },
  today: Date = new Date(),
): ContractStatus {
  const now = isoDate(today);
  if (entry.status === 'ENDED') return 'ENDED';
  if (entry.end_date && entry.end_date < now && !(entry.auto_renewal && entry.status === 'ACTIVE')) return 'ENDED';
  if (entry.status === 'CANCELLED') return 'CANCELLED';
  const deadline = cancellationDeadline(entry.end_date, entry.notice_period_days);
  if (deadline) {
    const days = daysUntil(deadline, today);
    if (days >= 0 && days <= UPCOMING_DAYS) return 'EXPIRING';
  }
  return 'ACTIVE';
}

const MONTHS_PER_CYCLE: Partial<Record<BillingCycle, number>> = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 };

/** Monatsanteil der Kosten (einmalige Kosten: keiner). */
export function monthlyEquivalent(cost: string | null, cycle: BillingCycle): number | null {
  const months = MONTHS_PER_CYCLE[cycle];
  if (!cost || !months) return null;
  return Math.round((Number(cost) / months) * 100) / 100;
}

export const BILLING_LABEL: Record<BillingCycle, string> = {
  MONTHLY: 'Monatlich',
  QUARTERLY: 'Vierteljährlich',
  YEARLY: 'Jährlich',
  ONE_TIME: 'Einmalig',
};
const BILLING_SUFFIX: Record<BillingCycle, string> = {
  MONTHLY: ' / Monat',
  QUARTERLY: ' / Quartal',
  YEARLY: ' / Jahr',
  ONE_TIME: ' einmalig',
};

/** „39,99 € / Monat“, „120,00 € / Jahr“, „49,00 € einmalig“ — oder ''. */
export function costLabel(entry: { cost: string | null; billing_cycle: BillingCycle }): string {
  return entry.cost ? euro(Number(entry.cost)) + BILLING_SUFFIX[entry.billing_cycle] : '';
}

export function monthly(entry: { monthly_equivalent: string | null }): number {
  return entry.monthly_equivalent ? Number(entry.monthly_equivalent) : 0;
}

/** Läuft der Vertrag noch (nicht gekündigt, nicht beendet)? */
export function isRunning(entry: { effective_status: string }): boolean {
  return entry.effective_status === 'ACTIVE' || entry.effective_status === 'EXPIRING';
}

export interface ContractStats {
  total: number;
  monthly: number;
  hiddenCosts: number;
  yearly: number;
  expiring: number;
  withoutDeadline: number;
}

/** Kennzahlen über laufende Verträge (gekündigte und beendete zählen nicht mehr mit). */
export function contractStats(contracts: FolderEntryDto[]): ContractStats {
  const running = contracts.filter(isRunning);
  const sum = running.reduce((total, c) => total + monthly(c), 0);
  return {
    total: running.length,
    monthly: sum,
    /** Laufende Verträge, deren Betrag jemand anderes erfasst hat (in der Summe nicht enthalten). */
    hiddenCosts: running.filter((c) => c.cost_visible === false).length,
    yearly: sum * 12,
    expiring: running.filter((c) => c.effective_status === 'EXPIRING').length,
    withoutDeadline: running.filter((c) => !c.cancellation_deadline).length,
  };
}

export type ContractFilter = '' | ContractStatus | 'ohne-frist';

export const CONTRACT_STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Alle Status' },
  { value: 'EXPIRING', label: 'Läuft aus' },
  { value: 'ACTIVE', label: 'Aktiv' },
  { value: 'CANCELLED', label: 'Gekündigt' },
  { value: 'ENDED', label: 'Beendet' },
  { value: 'ohne-frist', label: 'Ohne Frist' },
];

export type ContractSort = 'frist' | 'kosten' | 'name';

export const CONTRACT_SORT_LABEL: Record<ContractSort, string> = {
  frist: 'nach Kündigungsfrist',
  kosten: 'nach Kosten',
  name: 'nach Name',
};

export function filterContracts(contracts: FolderEntryDto[], query: string, status: ContractFilter): FolderEntryDto[] {
  const q = query.trim().toLocaleLowerCase('de');
  return contracts.filter((c) => {
    if (q && ![c.name, c.provider, c.category, c.notes].some((v) => (v ?? '').toLocaleLowerCase('de').includes(q))) return false;
    if (status === 'ohne-frist') return isRunning(c) && !c.cancellation_deadline;
    return !status || c.effective_status === status;
  });
}

export function sortContracts(contracts: FolderEntryDto[], sort: ContractSort): FolderEntryDto[] {
  const sorted = [...contracts];
  if (sort === 'name') return sorted.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  if (sort === 'kosten') return sorted.sort((a, b) => monthly(b) - monthly(a) || a.name.localeCompare(b.name, 'de'));
  // Laufende zuerst nach Frist, gekündigte und beendete ans Ende.
  return sorted.sort(
    (a, b) =>
      Number(!isRunning(a)) - Number(!isRunning(b)) ||
      (a.cancellation_deadline ?? '9999').localeCompare(b.cancellation_deadline ?? '9999') ||
      a.name.localeCompare(b.name, 'de'),
  );
}

const EURO = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function euro(value: number): string {
  return EURO.format(value);
}

/** „30 Tage“ / „1 Tag“ / „keine“. */
export function noticeLabel(days: number | null): string {
  if (!days) return 'keine';
  return days === 1 ? '1 Tag' : `${days} Tage`;
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
