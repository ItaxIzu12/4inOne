import { describe, expect, it } from 'vitest';
import { CategoryDraft, draftProblem, parseLimit } from './category-manager';

const row = (name: string, extra: Partial<CategoryDraft> = {}): CategoryDraft => ({
  key: name,
  id: 1,
  original: name,
  name,
  limit: '',
  color: '#8a93a3',
  remove: false,
  ...extra,
});

describe('parseLimit', () => {
  it('reads German and English decimals, empty means no limit', () => {
    expect(parseLimit('400')).toBe('400.00');
    expect(parseLimit(' 400,5 ')).toBe('400.50');
    expect(parseLimit('12.34')).toBe('12.34');
    expect(parseLimit('')).toBeNull();
    expect(parseLimit('   ')).toBeNull();
  });
  it('rejects anything that is not an amount', () => {
    expect(parseLimit('abc')).toBeUndefined();
    expect(parseLimit('-5')).toBeUndefined();
    expect(parseLimit('1,234')).toBeUndefined();
  });
});

describe('draftProblem', () => {
  it('accepts a clean draft', () => {
    expect(draftProblem([row('Wohnen', { limit: '800' }), row('Haustier', { id: null, original: '' })])).toBeNull();
  });
  it('needs a name for every kept row', () => {
    expect(draftProblem([row('', { id: null, original: '' })])).toBe('Gib jeder Kategorie einen Namen.');
  });
  it('finds duplicates regardless of case and spacing', () => {
    expect(draftProblem([row('Hund'), row('  hund ', { key: 'x', id: null })])).toContain('gibt es doppelt');
  });
  it('ignores rows marked for deletion', () => {
    expect(draftProblem([row('Hund', { remove: true }), row('Hund', { key: 'x', id: null })])).toBeNull();
  });
  it('names the category with an invalid limit', () => {
    expect(draftProblem([row('Freizeit', { limit: 'viel' })])).toBe('Bitte ein gültiges Limit für „Freizeit“ eingeben, z. B. 400.');
  });
  it('limits the name length', () => {
    expect(draftProblem([row('x'.repeat(41))])).toContain('höchstens 40 Zeichen');
  });
});
