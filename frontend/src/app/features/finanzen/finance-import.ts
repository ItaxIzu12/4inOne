/**
 * Kontoauszug (CSV) lesen — so, wie deutsche Banken exportieren: Semikolon, Komma oder Tab als Trenner, Werte in
 * Anführungszeichen, „1.234,56“ oder „-12,50“, Datum „09.10.2026“, „09.10.26“ oder „2026-10-09“, oft ein paar
 * Kopfzeilen vor der eigentlichen Tabelle und manchmal getrennte Spalten „Soll“/„Haben“.
 *
 * Das Ergebnis sind Zeilen für den Import-Endpunkt; das Backend prüft jede Zeile noch einmal selbst.
 */

export interface ImportRow {
  date: string;
  amount: string;
  type: 'INCOME' | 'EXPENSE';
  note: string;
  category: string;
}
export interface ParsedCsv {
  rows: ImportRow[];
  /** Zeilen der Datei, die sich nicht lesen ließen (1-basiert, wie im Tabellenprogramm). */
  skipped: { line: number; reason: string }[];
}
export class CsvFormatError extends Error {}

export const IMPORT_MAX_ROWS = 1000;
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;

const DATE_COLUMNS = ['buchungstag', 'buchungsdatum', 'datum', 'date', 'valuta', 'wertstellung', 'wertstellungsdatum'];
const AMOUNT_COLUMNS = ['betrag', 'betrag (eur)', 'betrag in eur', 'umsatz', 'umsatz in eur', 'amount', 'betrag (€)'];
const DEBIT_COLUMNS = ['soll', 'ausgang', 'belastung'];
const CREDIT_COLUMNS = ['haben', 'eingang', 'gutschrift'];
const NAME_COLUMNS = ['auftraggeber/empfänger', 'auftraggeber / empfänger', 'empfänger/auftraggeber', 'zahlungspflichtiger/empfänger', 'beguenstigter/zahlungspflichtiger', 'begünstigter / zahlungspflichtiger', 'empfänger', 'empfaenger', 'zahlungsempfänger', 'auftraggeber', 'name', 'gegenkonto name', 'payee'];
const PURPOSE_COLUMNS = ['verwendungszweck', 'buchungstext', 'beschreibung', 'text', 'vorgang', 'note', 'description'];
const CATEGORY_COLUMNS = ['kategorie', 'category'];

/** Datei lesen: zuerst UTF-8, sonst Windows-1252 (viele Banken exportieren noch so). */
export function decodeCsv(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

export function parseCsv(text: string): ParsedCsv {
  const lines = text.split(/\r\n|\n|\r/);
  const delimiter = detectDelimiter(lines);
  const headerIndex = lines.findIndex((line) => {
    const cells = splitLine(line, delimiter).map(normalize);
    return cells.some((c) => DATE_COLUMNS.includes(c)) && cells.some((c) => [...AMOUNT_COLUMNS, ...DEBIT_COLUMNS, ...CREDIT_COLUMNS].includes(c));
  });
  if (headerIndex === -1) {
    throw new CsvFormatError('In der Datei fehlt eine Kopfzeile mit „Datum“ und „Betrag“. Exportiere den Kontoauszug bitte als CSV aus dem Online-Banking.');
  }
  const header = splitLine(lines[headerIndex], delimiter).map(normalize);
  const col = (names: string[]) => header.findIndex((h) => names.includes(h));
  const at = { date: col(DATE_COLUMNS), amount: col(AMOUNT_COLUMNS), debit: col(DEBIT_COLUMNS), credit: col(CREDIT_COLUMNS), category: col(CATEGORY_COLUMNS) };
  const names = header.map((h, i) => (NAME_COLUMNS.includes(h) ? i : -1)).filter((i) => i >= 0);
  const purposes = header.map((h, i) => (PURPOSE_COLUMNS.includes(h) ? i : -1)).filter((i) => i >= 0);

  const rows: ImportRow[] = [];
  const skipped: ParsedCsv['skipped'] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = splitLine(lines[i], delimiter);
    if (cells.every((c) => !c.trim())) continue;
    const date = parseDate(cells[at.date] ?? '');
    let amount = at.amount >= 0 ? parseAmount(cells[at.amount] ?? '') : null;
    if (amount === null && (at.debit >= 0 || at.credit >= 0)) {
      const debit = at.debit >= 0 ? parseAmount(cells[at.debit] ?? '') : null;
      const credit = at.credit >= 0 ? parseAmount(cells[at.credit] ?? '') : null;
      amount = credit ? Math.abs(credit) : debit ? -Math.abs(debit) : null;
    }
    if (!date) {
      skipped.push({ line: i + 1, reason: 'Datum nicht lesbar' });
      continue;
    }
    if (amount === null || amount === 0) {
      skipped.push({ line: i + 1, reason: 'Betrag fehlt oder ist 0' });
      continue;
    }
    const note = [...names, ...purposes]
      .map((index) => withoutAccountNumbers(cells[index] ?? '').replace(/\s+/g, ' ').trim())
      .filter((part, index, all) => part && all.indexOf(part) === index)
      .join(' · ')
      .slice(0, 255);
    rows.push({
      date,
      amount: Math.abs(amount).toFixed(2),
      type: amount < 0 ? 'EXPENSE' : 'INCOME',
      note,
      category: at.category >= 0 ? (cells[at.category] ?? '').trim().slice(0, 40) : '',
    });
  }
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new CsvFormatError(`Die Datei enthält ${rows.length} Buchungen. Bitte importiere höchstens ${IMPORT_MAX_ROWS} auf einmal, z. B. einen kürzeren Zeitraum.`);
  }
  return { rows, skipped };
}

/** Datensparsam: IBANs (auch mit Leerzeichen) und „Kto 1234567890“ stehen manchmal im Verwendungszweck — sie werden
 * vor dem Senden entfernt, damit sie nie in 4inOne gespeichert werden. Spalten mit IBAN/Kontonummer liest der Import
 * gar nicht erst aus. */
export function withoutAccountNumbers(text: string): string {
  return text
    .replace(/\b(?:IBAN:?\s*)?[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b/g, '')
    .replace(/\b(?:KTO|Konto(?:nummer|nr\.?)?)\s*:?\s*\d{6,12}\b/gi, '')
    .replace(/\s+([,.;])/g, '$1');
}
function normalize(cell: string): string {
  return cell.trim().toLocaleLowerCase('de').replace(/\s+/g, ' ');
}
function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 30);
  const score = (d: string) => sample.reduce((sum, line) => sum + (splitLine(line, d).length - 1), 0);
  return [';', '\t', ','].reduce((best, d) => (score(d) > score(best) ? d : best), ';');
}
/** Eine Zeile zerlegen; Trenner in Anführungszeichen zählen nicht, "" ist ein Anführungszeichen. */
export function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      cells.push(cell);
      cell = '';
    } else cell += ch;
  }
  cells.push(cell);
  return cells;
}
/** „09.10.2026“, „9.10.26“, „2026-10-09“ → „2026-10-09“; sonst null. */
export function parseDate(raw: string): string | null {
  const text = raw.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(text);
  if (match) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  } else if ((match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else return null;
  const check = new Date(y, m - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
/** „-1.234,56 €“, „12,50“, „+3100.00“, „(45,00)“ → Zahl; sonst null. */
export function parseAmount(raw: string): number | null {
  let text = raw.replace(/[€\s]|EUR/gi, '');
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.endsWith('-')) {
    negative = true;
    text = text.slice(0, -1);
  }
  if (text.startsWith('-')) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.startsWith('+')) text = text.slice(1);
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  // Das letzte Trennzeichen ist das Dezimalzeichen, wenn danach 1–2 Ziffern folgen; das andere gruppiert Tausender.
  if (lastComma > lastDot) text = text.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma && /\.\d{3}$/.test(text) && lastComma === -1 && (text.match(/\./g) ?? []).length > 1) text = text.replace(/\./g, '');
  else text = text.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? (negative ? -value : value) : null;
}
