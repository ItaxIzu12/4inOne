import { CsvFormatError, decodeCsv, parseAmount, parseCsv, parseDate, splitLine, withoutAccountNumbers } from './finance-import';

describe('Kontoauszug-Import (CSV)', () => {
  it('reads a typical German export with preamble, semicolons, quotes and payee + purpose', () => {
    const csv = [
      '"Umsätze Girokonto";"Zeitraum: 01.10.2026 - 09.10.2026"',
      '',
      '"Buchungstag";"Valuta";"Auftraggeber/Empfänger";"Buchungstext";"Verwendungszweck";"Betrag"',
      '"08.10.2026";"08.10.2026";"REWE Markt";"Lastschrift";"Einkauf; Filiale 12";"-23,45"',
      '"01.10.2026";"01.10.2026";"Arbeitgeber GmbH";"Gutschrift";"Gehalt Oktober";"3.100,00"',
    ].join('\r\n');
    const { rows, skipped } = parseCsv(csv);
    expect(skipped).toEqual([]);
    expect(rows).toEqual([
      { date: '2026-10-08', amount: '23.45', type: 'EXPENSE', note: 'REWE Markt · Lastschrift · Einkauf; Filiale 12', category: '' },
      { date: '2026-10-01', amount: '3100.00', type: 'INCOME', note: 'Arbeitgeber GmbH · Gutschrift · Gehalt Oktober', category: '' },
    ]);
  });

  it('understands comma-separated files with ISO dates, a category column and debit/credit columns', () => {
    const csv = 'Date,Description,Category,Soll,Haben\n2026-10-02,Bakery,Lebensmittel,"4,20",\n2026-10-03,Refund,,,"10,00"\n';
    expect(parseCsv(csv).rows).toEqual([
      { date: '2026-10-02', amount: '4.20', type: 'EXPENSE', note: 'Bakery', category: 'Lebensmittel' },
      { date: '2026-10-03', amount: '10.00', type: 'INCOME', note: 'Refund', category: '' },
    ]);
  });

  it('skips unreadable lines with a reason instead of guessing', () => {
    const csv = 'Datum;Betrag;Verwendungszweck\n31.02.2026;-5,00;kaputt\n02.10.2026;;leer\n03.10.2026;-1,00;ok\n';
    const result = parseCsv(csv);
    expect(result.rows.map((r) => r.note)).toEqual(['ok']);
    expect(result.skipped).toEqual([
      { line: 2, reason: 'Datum nicht lesbar' },
      { line: 3, reason: 'Betrag fehlt oder ist 0' },
    ]);
  });

  it('rejects a file without a recognisable header, and too many rows', () => {
    expect(() => parseCsv('a;b\n1;2')).toThrow(CsvFormatError);
    const many = ['Datum;Betrag', ...Array.from({ length: 1001 }, () => '01.10.2026;-1,00')].join('\n');
    expect(() => parseCsv(many)).toThrow(/höchstens 1000/);
  });

  it('never keeps IBANs or account numbers from the purpose text', () => {
    expect(withoutAccountNumbers('Miete Oktober IBAN: DE89 3704 0044 0532 0130 00 danke')).toBe('Miete Oktober  danke');
    expect(withoutAccountNumbers('Überweisung DE89370400440532013000')).toBe('Überweisung ');
    expect(withoutAccountNumbers('Kto 1234567890 Erstattung')).toBe(' Erstattung');
    expect(withoutAccountNumbers('Rechnung 2026-10 Nr. 4711')).toBe('Rechnung 2026-10 Nr. 4711');
    const csv = 'Datum;Betrag;IBAN;Verwendungszweck\n01.10.2026;-850,00;DE89370400440532013000;Miete IBAN DE89 3704 0044 0532 0130 00\n';
    expect(parseCsv(csv).rows[0].note).toBe('Miete');
  });

  it('parses German and international amounts', () => {
    expect(parseAmount('-1.234,56 €')).toBe(-1234.56);
    expect(parseAmount('12,50')).toBe(12.5);
    expect(parseAmount('+3100.00')).toBe(3100);
    expect(parseAmount('(45,00)')).toBe(-45);
    expect(parseAmount('45,00-')).toBe(-45);
    expect(parseAmount('1.234.567')).toBe(1234567);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });

  it('parses dates and rejects impossible ones', () => {
    expect(parseDate('09.10.2026')).toBe('2026-10-09');
    expect(parseDate('9.10.26')).toBe('2026-10-09');
    expect(parseDate('2026-10-09')).toBe('2026-10-09');
    expect(parseDate('31.02.2026')).toBeNull();
    expect(parseDate('heute')).toBeNull();
  });

  it('keeps delimiters inside quotes and unescapes doubled quotes', () => {
    expect(splitLine('"a;b";"c ""d""";e', ';')).toEqual(['a;b', 'c "d"', 'e']);
  });

  it('decodes UTF-8 and falls back to Windows-1252 for umlauts', () => {
    expect(decodeCsv(new TextEncoder().encode('Empfänger').buffer as ArrayBuffer)).toBe('Empfänger');
    const latin1 = new Uint8Array([0x45, 0x6d, 0x70, 0x66, 0xe4, 0x6e, 0x67, 0x65, 0x72]); // „Empfänger“ in Windows-1252
    expect(decodeCsv(latin1.buffer)).toBe('Empfänger');
  });
});
