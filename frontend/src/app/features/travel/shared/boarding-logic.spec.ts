import { julianToDate, maskedPnr, parseBcbp, passDate } from './boarding-logic';
import { offlinePasses, saveOfflinePasses } from './boarding-offline';
import { OFFLINE_BOARDING_KEY, clearOfflineData } from '../../../core/offline/offline-keys';
import { BoardingPass } from './boarding-logic';

/** Pflichtteil eines IATA-BCBP-Codes (60 Zeichen) mit erfundenen Beispieldaten – wie backend/reisen/test_boarding.py. */
function bcbp(day = 338, name = 'MUSTER/SOPHIE MS'): string {
  return `M1${name.padEnd(20)}EK7X2PQ DUSLISXY 1234 ${String(day).padStart(3, '0')}Y014C00067100`;
}

function pass(id: number, flight_date: string | null, message: string | null = 'x'): BoardingPass {
  return {
    id, trip: 1, format: 'QR', message, source: 'image', passenger_name: '', pnr_hint: '', airline_name: '', flight_number: '',
    from_code: 'DUS', from_name: '', to_code: 'LIS', to_name: '', flight_date, boarding_time: '', departure_time: '', gate: '',
    seat: '', group: '', sequence: '',
  };
}

describe('Bordkarte: BCBP lesen', () => {
  it('liest den Pflichtteil wie das Backend', () => {
    expect(bcbp()).toHaveLength(60);
    const data = parseBcbp(bcbp(), new Date(2026, 10, 22))!;
    expect(data.passenger_name).toBe('Sophie Muster');
    expect([data.from_code, data.to_code, data.flight_number, data.seat, data.sequence, data.pnr]).toEqual(['DUS', 'LIS', 'XY 1234', '14C', '67', 'K7X2PQ']);
    expect(data.flight_date).toBe('2026-12-04');
  });

  it('erkennt Nicht-Codes und wählt das Jahr nahe an heute', () => {
    expect(parseBcbp('kein Code')).toBeNull();
    expect(parseBcbp(bcbp().replace('DUS', 'D1S'))).toBeNull();
    expect(julianToDate(5, new Date(2026, 11, 28))).toBe('2027-01-05');
    expect(julianToDate(360, new Date(2027, 0, 3))).toBe('2026-12-26');
    expect(maskedPnr('K7X2PQ')).toBe('K7••••');
    expect(passDate(null)).toBe('');
  });
});

describe('Bordkarte: offline auf dem Gerät', () => {
  beforeEach(() => localStorage.clear());

  it('merkt aktuelle Karten, lässt vergangene weg und wird beim Abmelden gelöscht', () => {
    const now = new Date('2026-11-22T10:00:00Z');
    saveOfflinePasses(1, 'Lissabon', [pass(1, '2026-12-04'), pass(2, '2026-11-01'), pass(3, '2026-12-05', null)], now);
    expect(offlinePasses(now).map((e) => [e.title, e.pass.id])).toEqual([['Lissabon', 1]]);
    saveOfflinePasses(1, 'Lissabon', [], now);
    expect(localStorage.getItem(OFFLINE_BOARDING_KEY)).toBeNull();
    saveOfflinePasses(1, 'Lissabon', [pass(1, '2026-12-04')], now);
    clearOfflineData();
    expect(offlinePasses(now)).toEqual([]);
  });
});
