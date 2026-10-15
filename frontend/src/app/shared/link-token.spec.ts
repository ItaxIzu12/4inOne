import { ActivatedRouteSnapshot, convertToParamMap } from '@angular/router';
import { tokenFromLink } from './link-token';

const snap = (fragment: string | null, query: Record<string, string> = {}, params: Record<string, string> = {}) =>
  ({ fragment, queryParamMap: convertToParamMap(query), paramMap: convertToParamMap(params) }) as unknown as ActivatedRouteSnapshot;

describe('tokenFromLink', () => {
  it('reads the token from the fragment (never sent to a server)', () => {
    expect(tokenFromLink(snap('token=abc123'))).toBe('abc123');
    expect(tokenFromLink(snap('rawInviteToken'))).toBe('rawInviteToken');
  });

  it('still understands older links', () => {
    expect(tokenFromLink(snap(null, { token: 'old' }))).toBe('old');
    expect(tokenFromLink(snap(null, {}, { token: 'path' }))).toBe('path');
    expect(tokenFromLink(snap(null))).toBe('');
  });
});
