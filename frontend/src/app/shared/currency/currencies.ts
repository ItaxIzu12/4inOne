import { SelectOption } from '../form/select';

/** Unterstützte Währungen = die mit EZB-Referenzkurs (dieselbe Liste wie backend/core/currencies.py). Anzeige immer
 * „ISO-Code – Name“: Währungen gelten oft in mehreren Ländern, ein Code ist eindeutig. */
export const CURRENCIES = {
  EUR: 'Euro',
  USD: 'US-Dollar',
  CHF: 'Schweizer Franken',
  GBP: 'Britisches Pfund',
  JPY: 'Japanischer Yen',
  AUD: 'Australischer Dollar',
  BRL: 'Brasilianischer Real',
  CAD: 'Kanadischer Dollar',
  CNY: 'Chinesischer Yuan',
  CZK: 'Tschechische Krone',
  DKK: 'Dänische Krone',
  HKD: 'Hongkong-Dollar',
  HUF: 'Ungarischer Forint',
  IDR: 'Indonesische Rupiah',
  ILS: 'Israelischer Schekel',
  INR: 'Indische Rupie',
  ISK: 'Isländische Krone',
  KRW: 'Südkoreanischer Won',
  MXN: 'Mexikanischer Peso',
  MYR: 'Malaysischer Ringgit',
  NOK: 'Norwegische Krone',
  NZD: 'Neuseeland-Dollar',
  PHP: 'Philippinischer Peso',
  PLN: 'Polnischer Złoty',
  RON: 'Rumänischer Leu',
  SEK: 'Schwedische Krone',
  SGD: 'Singapur-Dollar',
  THB: 'Thailändischer Baht',
  TRY: 'Türkische Lira',
  ZAR: 'Südafrikanischer Rand',
} as const;
export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_OPTIONS: SelectOption[] = (Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => ({
  value: code,
  label: `${code} – ${CURRENCIES[code]}`,
}));
export function currencyLabel(code: string): string {
  return code in CURRENCIES ? `${code} – ${CURRENCIES[code as CurrencyCode]}` : code;
}

/** Geldbetrag auf Deutsch: „1.430,20 €“, sonst mit ISO-Code „250.000 JPY“ (¥ wäre zwischen JPY und CNY mehrdeutig).
 * Nachkommastellen nach Währung (Yen ohne Cent). `compact` lässt „,00“ weg. */
export function formatAmount(value: number | string, currency: string, compact = false): string {
  const number = typeof value === 'number' ? value : Number(value);
  const digits = new Intl.NumberFormat('de-DE', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const whole = compact && Math.round(number * 100) % 100 === 0;
  const amount = number.toLocaleString('de-DE', { minimumFractionDigits: whole ? 0 : digits, maximumFractionDigits: digits });
  return `${amount} ${currency === 'EUR' ? '€' : currency}`;
}

// ---------- Reisewährung aus dem Reiseziel ----------
// Nur die offizielle bzw. primäre Landeswährung — keine Aussage darüber, was sonst „akzeptiert“ wird. Erkannt wird
// ein Land nur, wenn es eindeutig im Ziel steht („Tokio, Japan“, „Davos, Schweiz“); Städte allein reichen nicht.
const COUNTRY_CURRENCY: [string[], string, CurrencyCode][] = [
  [['deutschland', 'germany'], 'Deutschland', 'EUR'],
  [['österreich', 'oesterreich', 'austria'], 'Österreich', 'EUR'],
  [['frankreich', 'france'], 'Frankreich', 'EUR'],
  [['italien', 'italy', 'italia'], 'Italien', 'EUR'],
  [['spanien', 'spain', 'españa'], 'Spanien', 'EUR'],
  [['portugal'], 'Portugal', 'EUR'],
  [['niederlande', 'holland', 'netherlands'], 'Niederlande', 'EUR'],
  [['belgien', 'belgium'], 'Belgien', 'EUR'],
  [['luxemburg', 'luxembourg'], 'Luxemburg', 'EUR'],
  [['irland', 'ireland'], 'Irland', 'EUR'],
  [['griechenland', 'greece'], 'Griechenland', 'EUR'],
  [['finnland', 'finland'], 'Finnland', 'EUR'],
  [['estland', 'estonia'], 'Estland', 'EUR'],
  [['lettland', 'latvia'], 'Lettland', 'EUR'],
  [['litauen', 'lithuania'], 'Litauen', 'EUR'],
  [['slowakei', 'slovakia'], 'Slowakei', 'EUR'],
  [['slowenien', 'slovenia'], 'Slowenien', 'EUR'],
  [['kroatien', 'croatia'], 'Kroatien', 'EUR'],
  [['malta'], 'Malta', 'EUR'],
  [['zypern', 'cyprus'], 'Zypern', 'EUR'],
  [['bulgarien', 'bulgaria'], 'Bulgarien', 'EUR'],
  [['schweiz', 'switzerland', 'suisse', 'svizzera'], 'die Schweiz', 'CHF'],
  [['liechtenstein'], 'Liechtenstein', 'CHF'],
  [['großbritannien', 'grossbritannien', 'england', 'schottland', 'wales', 'vereinigtes königreich', 'united kingdom', 'uk'], 'Großbritannien', 'GBP'],
  [['usa', 'vereinigte staaten', 'united states', 'amerika'], 'die USA', 'USD'],
  [['japan'], 'Japan', 'JPY'],
  [['australien', 'australia'], 'Australien', 'AUD'],
  [['brasilien', 'brazil', 'brasil'], 'Brasilien', 'BRL'],
  [['kanada', 'canada'], 'Kanada', 'CAD'],
  [['china'], 'China', 'CNY'],
  [['tschechien', 'tschechische republik', 'czechia', 'czech republic'], 'Tschechien', 'CZK'],
  [['dänemark', 'daenemark', 'denmark'], 'Dänemark', 'DKK'],
  [['hongkong', 'hong kong'], 'Hongkong', 'HKD'],
  [['ungarn', 'hungary'], 'Ungarn', 'HUF'],
  [['indonesien', 'indonesia', 'bali'], 'Indonesien', 'IDR'],
  [['israel'], 'Israel', 'ILS'],
  [['indien', 'india'], 'Indien', 'INR'],
  [['island', 'iceland'], 'Island', 'ISK'],
  [['südkorea', 'suedkorea', 'korea', 'south korea'], 'Südkorea', 'KRW'],
  [['mexiko', 'mexico'], 'Mexiko', 'MXN'],
  [['malaysia'], 'Malaysia', 'MYR'],
  [['norwegen', 'norway'], 'Norwegen', 'NOK'],
  [['neuseeland', 'new zealand'], 'Neuseeland', 'NZD'],
  [['philippinen', 'philippines'], 'die Philippinen', 'PHP'],
  [['polen', 'poland'], 'Polen', 'PLN'],
  [['rumänien', 'rumaenien', 'romania'], 'Rumänien', 'RON'],
  [['schweden', 'sweden'], 'Schweden', 'SEK'],
  [['singapur', 'singapore'], 'Singapur', 'SGD'],
  [['thailand'], 'Thailand', 'THB'],
  [['türkei', 'tuerkei', 'turkey', 'türkiye'], 'die Türkei', 'TRY'],
  [['südafrika', 'suedafrika', 'south africa'], 'Südafrika', 'ZAR'],
];

/** Landeswährung, wenn das Ziel genau ein bekanntes Land nennt; sonst null (dann bleibt die Wahl beim Nutzer). */
export function currencyForDestination(destination: string): { code: CurrencyCode; country: string } | null {
  const parts = destination
    .toLocaleLowerCase('de')
    .split(/[,/·–-]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const hits = new Map<CurrencyCode, string>();
  for (const [names, country, code] of COUNTRY_CURRENCY) {
    if (parts.some((part) => names.includes(part))) hits.set(code, country);
  }
  if (hits.size !== 1) return null;
  const [[code, country]] = [...hits];
  return { code, country };
}
