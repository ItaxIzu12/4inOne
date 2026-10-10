import { CURRENCY_OPTIONS, currencyForDestination, formatAmount } from './currencies';

describe('currencies', () => {
  it('lists every currency as "ISO code – name"', () => {
    expect(CURRENCY_OPTIONS.find((o) => o.value === 'JPY')?.label).toBe('JPY – Japanischer Yen');
    expect(CURRENCY_OPTIONS.find((o) => o.value === 'GBP')?.label).toBe('GBP – Britisches Pfund');
    expect(CURRENCY_OPTIONS.length).toBe(30);
  });

  it('suggests the official currency only when the destination clearly names one country', () => {
    expect(currencyForDestination('Tokio, Japan')).toEqual({ code: 'JPY', country: 'Japan' });
    expect(currencyForDestination('Davos, Schweiz')).toEqual({ code: 'CHF', country: 'die Schweiz' });
    expect(currencyForDestination('New York, USA')?.code).toBe('USD');
    expect(currencyForDestination('London, Großbritannien')?.code).toBe('GBP');
    expect(currencyForDestination('Lissabon, Portugal')?.code).toBe('EUR');
    // Nur eine Stadt, unbekanntes Land oder zwei Länder mit verschiedenen Währungen: kein Vorschlag.
    expect(currencyForDestination('Berlin')).toBeNull();
    expect(currencyForDestination('Atlantis')).toBeNull();
    expect(currencyForDestination('Basel, Schweiz / Frankreich')).toBeNull();
  });

  it('formats in German with € or the ISO code and the right number of decimals', () => {
    expect(formatAmount(1430.2, 'EUR')).toBe('1.430,20 €');
    expect(formatAmount(8500, 'JPY')).toBe('8.500 JPY');
    expect(formatAmount(48.7, 'CHF')).toBe('48,70 CHF');
    expect(formatAmount(1500, 'CHF', true)).toBe('1.500 CHF');
  });
});
