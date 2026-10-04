import { FolderEntryDto } from './haushalt-api.service';
import { contractState, contractStats, filterContracts, noticeLabel, sortContracts } from './vertraege-logic';

const today = new Date(2026, 9, 4);
const c = (id: number, over: Partial<FolderEntryDto> = {}): FolderEntryDto =>
  ({
    id, kind: 'vertrag', name: `V${id}`, provider: '', model: '', room: '', notes: '', monthly_cost: null, contract_end: null,
    notice_period_months: null, cancel_by: null, purchase_date: null, warranty_until: null, maintenance_interval_months: null,
    next_maintenance: null, last_maintenance: null, deadlines: [], ...over,
  }) as FolderEntryDto;

describe('Verträge: Anzeigeregeln', () => {
  it('derives the status from the last day to cancel', () => {
    expect(contractState(c(1, { cancel_by: '2026-11-01' }), today)).toEqual({ state: 'bald', label: 'Kündigung bald' });
    expect(contractState(c(1, { cancel_by: '2027-06-01' }), today).state).toBe('laeuft');
    expect(contractState(c(1, { cancel_by: '2026-09-01' }), today).label).toBe('Frist verpasst');
    expect(contractState(c(1), today).label).toBe('Ohne Frist');
  });

  it('sums costs and counts upcoming deadlines', () => {
    const list = [
      c(1, { monthly_cost: '84.00', cancel_by: '2026-11-01' }),
      c(2, { monthly_cost: '39.99', cancel_by: '2027-06-01' }),
      c(3, { monthly_cost: '13.99' }),
    ];
    const stats = contractStats(list, today);
    expect(stats.total).toBe(3);
    expect(stats.monthly).toBeCloseTo(137.98);
    expect(stats.yearly).toBeCloseTo(1655.76);
    expect(stats.soon).toBe(1);
    expect(stats.withoutDeadline).toBe(1);
  });

  it('filters by text and status and sorts by deadline, cost or name', () => {
    const list = [
      c(1, { name: 'Strom', provider: 'Stadtwerke', monthly_cost: '84.00', cancel_by: '2026-11-01' }),
      c(2, { name: 'Internet', monthly_cost: '39.99', cancel_by: '2027-06-01' }),
      c(3, { name: 'Abo', monthly_cost: '99.00' }),
    ];
    expect(filterContracts(list, 'stadt', '', today).map((x) => x.id)).toEqual([1]);
    expect(filterContracts(list, '', 'offen', today).map((x) => x.id)).toEqual([3]);
    expect(sortContracts(list, 'frist').map((x) => x.id)).toEqual([1, 2, 3]);
    expect(sortContracts(list, 'kosten').map((x) => x.id)).toEqual([3, 1, 2]);
    expect(sortContracts(list, 'name').map((x) => x.id)).toEqual([3, 2, 1]);
    expect(noticeLabel(3)).toBe('3 Monate');
    expect(noticeLabel(null)).toBe('keine');
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
