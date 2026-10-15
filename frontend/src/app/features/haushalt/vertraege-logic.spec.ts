import { FolderEntryDto } from './haushalt-api.service';
import {
  cancellationDeadline,
  computeContractStatus,
  contractState,
  contractStats,
  costLabel,
  filterContracts,
  monthlyEquivalent,
  noticeLabel,
  sortContracts,
} from './vertraege-logic';
import { deviceState, deviceStats, filterDevices, nextDeviceDeadline } from './geraete-logic';

const today = new Date(2026, 9, 6);
const c = (id: number, over: Partial<FolderEntryDto> = {}): FolderEntryDto =>
  ({
    id, kind: 'vertrag', name: `V${id}`, provider: '', category: '', status: 'ACTIVE', effective_status: 'ACTIVE', notes: '',
    cost: null, billing_cycle: 'MONTHLY', monthly_equivalent: null, start_date: null, end_date: null, notice_period_days: null,
    cancellation_deadline: null, auto_renewal: false, purchase_date: null, warranty_end_date: null, maintenance_interval_months: null,
    maintenance_due_date: null, last_maintenance: null, model: '', room: '', deadlines: [], ...over,
  }) as FolderEntryDto;

describe('Verträge: Regeln wie im Backend', () => {
  it('computes the last day to cancel from the end date and notice days', () => {
    expect(cancellationDeadline('2026-12-31', 30)).toBe('2026-12-01');
    expect(cancellationDeadline('2026-03-31', 31)).toBe('2026-02-28');
    expect(cancellationDeadline('2026-12-31', null)).toBe('2026-12-31');
    expect(cancellationDeadline(null, 30)).toBeNull();
  });

  it('derives the effective status', () => {
    const base = { status: 'ACTIVE', auto_renewal: false };
    expect(computeContractStatus({ ...base, end_date: '2026-12-31', notice_period_days: 70 }, today)).toBe('EXPIRING');
    expect(computeContractStatus({ ...base, end_date: '2027-12-31', notice_period_days: 30 }, today)).toBe('ACTIVE');
    expect(computeContractStatus({ ...base, end_date: '2026-09-30', notice_period_days: null }, today)).toBe('ENDED');
    expect(computeContractStatus({ ...base, auto_renewal: true, end_date: '2026-09-30', notice_period_days: null }, today)).toBe('ACTIVE');
    expect(computeContractStatus({ ...base, status: 'CANCELLED', end_date: '2026-12-31', notice_period_days: 70 }, today)).toBe('CANCELLED');
  });

  it('shows money per billing cycle and a monthly share', () => {
    expect(monthlyEquivalent('120.00', 'YEARLY')).toBe(10);
    expect(monthlyEquivalent('30.00', 'QUARTERLY')).toBe(10);
    expect(monthlyEquivalent('49.00', 'ONE_TIME')).toBeNull();
    expect(costLabel({ cost: '39.99', billing_cycle: 'MONTHLY' })).toBe('39,99\u00a0€ / Monat');
    expect(costLabel({ cost: '78.00', billing_cycle: 'YEARLY' })).toBe('78,00\u00a0€ / Jahr');
    expect(noticeLabel(30)).toBe('30 Tage');
    expect(noticeLabel(null)).toBe('keine');
  });

  it('labels contracts by their effective status', () => {
    expect(contractState(c(1, { effective_status: 'EXPIRING' }))).toEqual({ status: 'EXPIRING', state: 'bald', label: 'Läuft aus' });
    expect(contractState(c(1, { effective_status: 'CANCELLED' })).label).toBe('Gekündigt');
  });

  it('counts only running contracts', () => {
    const list = [
      c(1, { monthly_equivalent: '84.00', effective_status: 'EXPIRING', cancellation_deadline: '2026-10-20' }),
      c(2, { monthly_equivalent: '39.99', cancellation_deadline: '2027-06-01' }),
      c(3, { monthly_equivalent: '13.99' }),
      c(4, { monthly_equivalent: '50.00', status: 'CANCELLED', effective_status: 'CANCELLED' }),
    ];
    const stats = contractStats(list);
    expect(stats.total).toBe(3);
    expect(stats.monthly).toBeCloseTo(137.98);
    expect(stats.expiring).toBe(1);
    expect(stats.withoutDeadline).toBe(1);
  });

  it('filters by text and status and sorts by deadline, cost or name', () => {
    const list = [
      c(1, { name: 'Strom', provider: 'Stadtwerke', monthly_equivalent: '84.00', cancellation_deadline: '2026-11-01' }),
      c(2, { name: 'Internet', monthly_equivalent: '39.99', cancellation_deadline: '2027-06-01' }),
      c(3, { name: 'Abo', monthly_equivalent: '99.00' }),
      c(4, { name: 'Alt', effective_status: 'ENDED', cancellation_deadline: '2026-01-01' }),
    ];
    expect(filterContracts(list, 'stadt', '').map((x) => x.id)).toEqual([1]);
    expect(filterContracts(list, '', 'ohne-frist').map((x) => x.id)).toEqual([3]);
    expect(filterContracts(list, '', 'ENDED').map((x) => x.id)).toEqual([4]);
    expect(sortContracts(list, 'frist').map((x) => x.id)).toEqual([1, 2, 3, 4]);
    expect(sortContracts(list, 'kosten').map((x) => x.id)).toEqual([3, 1, 2, 4]);
    expect(sortContracts(list, 'name').map((x) => x.id)).toEqual([3, 4, 2, 1]);
  });
});

describe('Geräte: Regeln', () => {
  const d = (id: number, over: Partial<FolderEntryDto> = {}) => c(id, { kind: 'geraet', ...over });

  it('labels the stored status', () => {
    expect(deviceState({ status: 'REPAIR' })).toEqual({ status: 'REPAIR', state: 'bald', label: 'In Reparatur' });
    expect(deviceState({ status: 'RETIRED' }).label).toBe('Außer Betrieb');
  });

  it('counts devices in use and deadlines within 30 days', () => {
    const list = [
      d(1, { maintenance_due_date: '2026-10-20' }),
      d(2, { status: 'REPAIR', warranty_end_date: '2026-11-05' }),
      d(3, { warranty_end_date: '2026-11-06' }),
      d(4, { status: 'RETIRED', maintenance_due_date: '2026-10-07' }),
    ];
    expect(deviceStats(list, today)).toEqual({ total: 3, repair: 1, maintenanceSoon: 1, warrantySoon: 1 });
  });

  it('puts retired devices last and finds the next deadline', () => {
    const list = [
      d(1, { name: 'Alt', status: 'RETIRED' }),
      d(2, { name: 'Heizung', deadlines: [{ art: 'wartung', datum: '2026-10-27', titel: 'Wartung: Heizung' }] }),
      d(3, { name: 'Backofen' }),
    ];
    expect(filterDevices(list, '', '').map((x) => x.id)).toEqual([2, 3, 1]);
    expect(filterDevices(list, '', 'RETIRED').map((x) => x.id)).toEqual([1]);
    expect(nextDeviceDeadline(list[1])?.datum).toBe('2026-10-27');
  });
});

describe('Verträge: Datumsangaben', () => {
  it('formats dates and distances the way people say them', async () => {
    const { formatDate, fromNow } = await import('./vertraege-logic');
    const today = new Date(2026, 9, 4);
    expect(formatDate('2026-11-04')).toBe('04.11.2026');
    expect(fromNow('2026-11-01', today)).toBe('in 4 Wochen');
    expect(fromNow('2027-01-04', today)).toBe('in 3 Monaten');
    expect(fromNow('2024-10-04', today)).toBe('vor 2 Jahren');
    expect(fromNow('2026-10-07', today)).toBe('in 3 Tagen');
  });
});

describe('Vertragskosten privat', () => {
  it('sums only visible amounts and counts contracts whose amount someone else entered', () => {
    const list = [
      c(1, { monthly_equivalent: '20.00', cost: '20.00', cost_visible: true }),
      c(2, { monthly_equivalent: null, cost: null, cost_visible: false }),
    ];
    const stats = contractStats(list);
    expect(stats.monthly).toBe(20);
    expect(stats.hiddenCosts).toBe(1);
  });
});
