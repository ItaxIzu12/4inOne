import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ErrorNotice, ErrorNoticeDirective, ErrorNoticeService } from './error-notice';

describe('global error notices', () => {
  it('does not let a previous form clear a newer error', () => {
    const notices = TestBed.inject(ErrorNoticeService);
    const first = {}, second = {};
    notices.show('Erster Fehler', first);
    notices.show('Zweiter Fehler', second);
    notices.clear(first);
    expect(notices.message()).toBe('Zweiter Fehler');
    notices.clear(second);
    expect(notices.message()).toBe('');
  });

  it('pauses dismissal while reading and restarts five seconds after leaving', () => {
    vi.useFakeTimers();
    try {
      const notices = TestBed.inject(ErrorNoticeService);
      notices.show('Bitte Betrag prüfen.', {});
      vi.advanceTimersByTime(3000);
      notices.pause();
      vi.advanceTimersByTime(10000);
      expect(notices.message()).toBe('Bitte Betrag prüfen.');
      notices.resume();
      vi.advanceTimersByTime(4999);
      expect(notices.message()).toBe('Bitte Betrag prüfen.');
      vi.advanceTimersByTime(1);
      expect(notices.message()).toBe('');
    } finally { vi.useRealTimers(); }
  });
});

@Component({
  standalone: true,
  imports: [ErrorNoticeDirective, ErrorNotice],
  template: `
    <form (submit)="$event.preventDefault(); validate()">
      <input [value]="value" (input)="value = $any($event.target).value" />
      <p [appErrorNotice]="error()">{{ error() }}</p>
      <button type="submit">Speichern</button>
    </form>
    <app-error-notice />
  `,
})
class PlainFormHost {
  value = '';
  error = signal('Name fehlt');
  validate() { this.error.set(this.value.trim() ? '' : 'Name fehlt'); }
}

describe('global errors in ordinary forms', () => {
  it('repeats a still valid error but never replays it after correction', async () => {
    const fixture = TestBed.createComponent(PlainFormHost);
    fixture.detectChanges();
    const notices = TestBed.inject(ErrorNoticeService);
    notices.dismiss();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(notices.message()).toBe('Name fehlt');

    const show = vi.spyOn(notices, 'show');
    fixture.componentInstance.value = 'Korrigiert';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(notices.message()).toBe('');
    expect(show).not.toHaveBeenCalled();
  });
});
