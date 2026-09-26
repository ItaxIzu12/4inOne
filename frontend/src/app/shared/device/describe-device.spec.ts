import { describeDevice } from './describe-device';

describe('describeDevice', () => {
  it.each([
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'Safari auf Mac'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', 'Chrome auf Windows'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0', 'Edge auf Windows'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', 'Safari auf iPhone'],
    ['Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0', 'Firefox auf Android'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0', 'Firefox auf Linux'],
  ])('%s', (agent, expected) => expect(describeDevice(agent)).toBe(expected));

  it('falls back gracefully', () => {
    expect(describeDevice('')).toBe('Unbekanntes Gerät');
    expect(describeDevice('curl/8.0')).toBe('Browser');
  });
});
