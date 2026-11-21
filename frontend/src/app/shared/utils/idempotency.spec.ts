import { SubmissionKey } from './idempotency';

describe('SubmissionKey', () => {
  it('gives the same key for the same content until reset, and a new one for new content', () => {
    const key = new SubmissionKey();
    const first = key.for({ amount: '12.30' });
    expect(key.for({ amount: '12.30' })).toBe(first);
    expect(key.for({ amount: '12.31' })).not.toBe(first);
    expect(first).toMatch(/^[A-Za-z0-9_.:-]{8,100}$/);
    key.reset();
    expect(key.for({ amount: '12.30' })).not.toBe(first);
  });
});
