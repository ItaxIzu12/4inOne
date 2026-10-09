import { IconName } from '../../shared/icons/app-icon';
import { SelectOption } from '../../shared/form/select';
import { DeadlineDto, DeviceStatus, FolderEntryDto } from './haushalt-api.service';
import { daysUntil } from './haushalt-logic';
import { UPCOMING_DAYS } from './vertraege-logic';

/**
 * Regeln für Geräte (Reiter „Zuhause → Geräte“) — reine Funktionen. Ein Gerät
 * hat einen gespeicherten Status (aktiv, in Reparatur, außer Betrieb); außer
 * Betrieb gesetzte Geräte haben keine Fristen mehr (backend services.folder_deadlines).
 */

export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  ACTIVE: 'Aktiv',
  REPAIR: 'In Reparatur',
  RETIRED: 'Außer Betrieb',
};

export type DeviceTone = 'laeuft' | 'bald' | 'offen';
const DEVICE_TONE: Record<DeviceStatus, DeviceTone> = { ACTIVE: 'laeuft', REPAIR: 'bald', RETIRED: 'offen' };

export function deviceState(entry: { status: string }): { status: DeviceStatus; state: DeviceTone; label: string } {
  const status = (entry.status in DEVICE_TONE ? entry.status : 'ACTIVE') as DeviceStatus;
  return { status, state: DEVICE_TONE[status], label: DEVICE_STATUS_LABEL[status] };
}

export const DEVICE_STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Alle Status' },
  { value: 'ACTIVE', label: 'Aktiv' },
  { value: 'REPAIR', label: 'In Reparatur' },
  { value: 'RETIRED', label: 'Außer Betrieb' },
];
export type DeviceFilter = '' | DeviceStatus;

/** Nächste Frist eines Geräts (Wartung oder Garantieende), früheste zuerst. */
export function nextDeviceDeadline(entry: FolderEntryDto): DeadlineDto | null {
  return [...entry.deadlines].sort((a, b) => a.datum.localeCompare(b.datum))[0] ?? null;
}

/** Liegt eine Frist in den nächsten 30 Tagen (oder schon dahinter)? */
export function deadlineSoon(iso: string | null, today: Date = new Date()): boolean {
  return !!iso && daysUntil(iso, today) <= UPCOMING_DAYS;
}

export interface DeviceStats {
  total: number;
  repair: number;
  maintenanceSoon: number;
  warrantySoon: number;
}

/** Kennzahlen: Geräte in Betrieb, in Reparatur, Wartung bald, Garantie endet bald (je 30 Tage). */
export function deviceStats(devices: FolderEntryDto[], today: Date = new Date()): DeviceStats {
  const inUse = devices.filter((d) => d.status !== 'RETIRED');
  const soon = (iso: string | null) => !!iso && daysUntil(iso, today) >= 0 && daysUntil(iso, today) <= UPCOMING_DAYS;
  return {
    total: inUse.length,
    repair: inUse.filter((d) => d.status === 'REPAIR').length,
    maintenanceSoon: inUse.filter((d) => soon(d.maintenance_due_date)).length,
    warrantySoon: inUse.filter((d) => soon(d.warranty_end_date)).length,
  };
}

export function filterDevices(devices: FolderEntryDto[], query: string, status: DeviceFilter): FolderEntryDto[] {
  const q = query.trim().toLocaleLowerCase('de');
  return devices
    .filter((d) => {
      if (q && ![d.name, d.provider, d.model, d.category, d.notes].some((v) => (v ?? '').toLocaleLowerCase('de').includes(q)))
        return false;
      return !status || d.status === status;
    })
    .sort(
      (a, b) =>
        Number(a.status === 'RETIRED') - Number(b.status === 'RETIRED') ||
        (nextDeviceDeadline(a)?.datum ?? '9999').localeCompare(nextDeviceDeadline(b)?.datum ?? '9999') ||
        a.name.localeCompare(b.name, 'de'),
    );
}

/** Icon eines Geräts nach Name oder Kategorie. */
export function deviceIcon(entry: { name: string; category?: string }): IconName {
  const text = `${entry.name} ${entry.category ?? ''}`.toLocaleLowerCase('de');
  if (/wasch/.test(text)) return 'washer';
  if (/spül/.test(text)) return 'dishwasher';
  if (/kühl|gefrier/.test(text)) return 'fridge';
  if (/sauger|staub/.test(text)) return 'vacuum';
  if (/handy|telefon|smartphone|tablet/.test(text)) return 'smartphone';
  return 'household';
}
