import { formatMoneyInput, normalizeMoneyInput, parseMoneyInput } from './money-input';

describe('money input', () => {
  it('reads amounts the way people type them in German', () => {
    const cases: [string, string | null][] = [
      ['700', '700'], ['700,5', '700.50'], ['700,50', '700.50'], ['1.500', '1500'], ['1.500,50', '1500.50'],
      ['250.000', '250000'], ['1.000.000', '1000000'], ['1500.5', '1500.50'], ['1.5', '1.50'], ['2 000 €', '2000'],
      ['100 EUR', '100'], ['0,99', '0.99'], ['007', '7'],
    ];
    for (const [raw, expected] of cases) expect(normalizeMoneyInput(raw), raw).toBe(expected);
  });

  it('refuses anything ambiguous instead of guessing', () => {
    for (const raw of ['1,2,3', '1.2.3', '12,345', '1.50,5', '1e3', '-5', 'abc', '12.', ',5x']) expect(normalizeMoneyInput(raw), raw).toBeNull();
    expect(parseMoneyInput('')).toBe(0);
    expect(parseMoneyInput('abc')).toBeNull();
    expect(parseMoneyInput('1.500,50')).toBe(1500.5);
  });

  it('formats for the field after leaving it', () => {
    expect(formatMoneyInput('250000')).toBe('250.000');
    expect(formatMoneyInput('1500.5')).toBe('1.500,50');
    expect(formatMoneyInput('8500')).toBe('8.500');
    expect(formatMoneyInput('1,2,3')).toBe('1,2,3');
  });
});
