import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Landing } from './landing';

describe('Landing sharing example', () => {
  it('describes the actual combination of trip sharing and linking without implying additional access', () => {
    TestBed.configureTestingModule({ imports: [Landing], providers: [provideRouter([])] });
    const c = TestBed.createComponent(Landing).componentInstance;
    const link = c.shares.find(s => s.key === 'verknuepfung')!;
    const trip = c.shares.find(s => s.key === 'reise')!;
    expect(c.shareResult(link)).toContain('Ben sieht keines');
    c.toggle(trip);
    expect(c.shareResult(link)).toContain('dein Sparziel aber nicht');
    c.toggle(link);
    expect(c.shareResult(link)).toBe('Reise und Sparziel stehen für sich.');
    const finance = c.shares.find(s => s.key === 'finanzen')!;
    c.toggle(finance);
    expect(c.isOn(finance)).toBe(false);
  });
});
