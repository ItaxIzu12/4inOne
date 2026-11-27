/**
 * Bordkarte (Schritt 1, docs/BORDKARTE_KONZEPT.md): Typen und das Lesen des IATA-Codes (BCBP) – dieselben Regeln wie
 * backend/reisen/boarding.py. Veyora erzeugt nie einen eigenen Code, es zeigt den echten der Airline.
 */
export type BarcodeFormat = 'QR' | 'AZTEC' | 'PDF417' | 'CODE128';

export interface BoardingPass {
  id: number;
  trip: number;
  format: BarcodeFormat;
  /** Inhalt des Airline-Codes (nur für die eigene Person; der Server speichert ihn verschlüsselt). */
  message: string | null;
  source: 'pkpass' | 'image';
  passenger_name: string;
  pnr_hint: string;
  airline_name: string;
  flight_number: string;
  from_code: string;
  from_name: string;
  to_code: string;
  to_name: string;
  flight_date: string | null;
  boarding_time: string;
  departure_time: string;
  gate: string;
  seat: string;
  group: string;
  sequence: string;
}

/** Formate von BarcodeDetector (Browser) → Veyora. */
export const DETECTOR_FORMATS: Record<string, BarcodeFormat> = { qr_code: 'QR', aztec: 'AZTEC', pdf417: 'PDF417', code_128: 'CODE128' };
/** Formate → bwip-js. */
export const BWIP_FORMATS: Record<BarcodeFormat, string> = { QR: 'qrcode', AZTEC: 'azteccode', PDF417: 'pdf417', CODE128: 'code128' };

/** Tag im Jahr → Datum, das Jahr so gewählt, dass der Tag am nächsten an heute liegt. */
export function julianToDate(day: number, today = new Date()): string | null {
  if (day < 1 || day > 366) return null;
  const options = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((y) => new Date(y, 0, day));
  const best = options.reduce((a, b) => (Math.abs(b.getTime() - today.getTime()) < Math.abs(a.getTime() - today.getTime()) ? b : a));
  return `${best.getFullYear()}-${String(best.getMonth() + 1).padStart(2, '0')}-${String(best.getDate()).padStart(2, '0')}`;
}

function personName(raw: string): string {
  const title = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
  const clean = raw.trim();
  if (!clean.includes('/')) return title(clean);
  const [last, first] = clean.split('/', 2);
  return `${title(first.replace(/\s+(MR|MRS|MS|MISS|MSTR|DR)$/, '').trim())} ${title(last.trim())}`.trim();
}

export interface BcbpData {
  passenger_name: string;
  pnr: string;
  from_code: string;
  to_code: string;
  flight_number: string;
  flight_date: string | null;
  seat: string;
  sequence: string;
}

/** Pflichtteil eines BCBP-Codes; null, wenn es keiner ist. */
export function parseBcbp(message: string, today = new Date()): BcbpData | null {
  if (!message || message.length < 58 || message[0] !== 'M' || !/\d/.test(message[1])) return null;
  const from = message.slice(30, 33).trim();
  const to = message.slice(33, 36).trim();
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) return null;
  const carrier = message.slice(36, 39).trim();
  const digits = message.slice(39, 44).trim().replace(/^0+/, '') || '0';
  const day = Number(message.slice(44, 47));
  return {
    passenger_name: personName(message.slice(2, 22)),
    pnr: message.slice(23, 30).trim(),
    from_code: from,
    to_code: to,
    flight_number: `${carrier} ${digits}`.trim(),
    flight_date: Number.isFinite(day) && day > 0 ? julianToDate(day, today) : null,
    seat: message.slice(48, 52).trim().replace(/^0+/, ''),
    sequence: message.slice(52, 57).trim().replace(/^0+/, ''),
  };
}

export function maskedPnr(pnr: string): string {
  return pnr ? `${pnr.slice(0, 2)}••••` : '';
}

/** Lesbares Datum der Bordkarte: „Fr 04.12.“ */
export function passDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00`);
  return `${d.toLocaleDateString('de-DE', { weekday: 'short' })} ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`;
}
