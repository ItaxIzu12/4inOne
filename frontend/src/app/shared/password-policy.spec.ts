import { checkPassword, hasSequence, personalParts } from './password-policy';

// Spiegel von backend/core/test_password_policy.py — beide Seiten müssen dieselben Passwörter annehmen/ablehnen.
describe('Passwort-Richtlinie (LKA NRW / BSI)', () => {
  it.each(['Sicher-Wald-27x', 'Mond!Fluss7Rabe', 'grüner fluss trifft 7 berge', 'Lena-Reist-Nach-Porto-2026'])(
    'nimmt %s an',
    (pw) => expect(checkPassword(pw).valid).toBe(true),
  );

  it.each([
    ['Kurz-7!x', 'length'],
    ['sicherwald27!', 'upperLower'],
    ['SicherWald273', 'digitSpecial'],
    ['nurkleinebuchstabenohneallesxyz', 'upperLower'],
    ['Wald-1234-Sicher', 'noSequence'],
    ['Qwertz-Haus-9!', 'noSequence'],
    ['Haus-aaaa-Wald9', 'noSequence'],
    ['Haus-9876-Wald!', 'noSequence'],
  ] as const)('lehnt %s ab (%s)', (pw, rule) => {
    const c = checkPassword(pw);
    expect(c.valid).toBe(false);
    expect(c[rule]).toBe(false);
  });

  it('Name und E-Mail (vor dem @) dürfen nicht vorkommen, die Domain zählt nicht', () => {
    const personal = personalParts('Sophie', 'sophie.weber@example.test');
    expect(checkPassword('Sophie-Wald-27!', personal).notPersonal).toBe(false);
    expect(checkPassword('Mein-weber-Pass9!', personal).notPersonal).toBe(false);
    expect(checkPassword('Testlauf-2026!', personal).valid).toBe(true);
  });

  it('Stärke: leer 0, schwach 1, gültig 4', () => {
    expect(checkPassword('').score).toBe(0);
    expect(checkPassword('abc').score).toBe(1);
    expect(checkPassword('Sicher-Wald-27x').score).toBe(4);
  });

  it('erkennt Folgen vorwärts, rückwärts und auf der Tastatur', () => {
    expect(hasSequence('xx4321yy')).toBe(true);
    expect(hasSequence('asdf')).toBe(true);
    expect(hasSequence('Mond!Fluss7Rabe')).toBe(false);
  });
});
