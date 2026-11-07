import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BetaFeedbackDialog } from './beta-feedback-dialog';

const URL = 'http://localhost:8000/api/v1/feedback/';

@Component({
  standalone: true,
  imports: [BetaFeedbackDialog],
  template: `<app-beta-feedback-dialog [open]="open()" [areas]="areas" [tasks]="tasks" area="HAUSHALT" (closed)="open.set(false)" />`,
})
class Host {
  open = signal(true);
  areas = [{ value: 'HAUSHALT', label: 'Haushalt' }, { value: 'GENERAL', label: 'Allgemein' }];
  tasks = [{ value: 'T1', label: 'Vertrag anlegen und mit Finanzen und Organisation verbinden' }];
  dialog = viewChild.required(BetaFeedbackDialog);
}

describe('BetaFeedbackDialog', () => {
  let http: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    fixture.componentInstance.dialog().reset();
    fixture.detectChanges();
    const root = document.body;
    const form = () => root.querySelector<HTMLFormElement>('form.modal-form')!;
    return { fixture, root, form };
  }

  afterEach(() => {
    http.verify();
    document.querySelectorAll('dialog').forEach((d) => d.remove());
  });

  it('asks for at least one answer and sends nothing when empty', () => {
    const { fixture, root, form } = setup();
    form().dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    // Fehler erscheinen über den gemeinsamen Fehlerhinweis (ErrorNoticeService) — hier am Zustand geprüft
    expect((fixture.componentInstance.dialog() as unknown as { error: () => string }).error()).toContain('Bitte mindestens eine Frage beantworten');
    http.expectNone(URL);
  });

  it('sends the chosen answers with the page path only, then thanks without a cancel button', () => {
    const { fixture, root, form } = setup();
    const options = () => Array.from(root.querySelectorAll<HTMLButtonElement>('.bf-option'));
    options()[3].click(); // verständlich: 4
    fixture.detectChanges();
    expect(options()[3].getAttribute('aria-pressed')).toBe('true');
    options()[3].click(); // erneut = abwählen
    fixture.detectChanges();
    expect(options()[3].getAttribute('aria-pressed')).toBe('false');
    options()[4].click(); // verständlich: 5
    options().find((b) => b.textContent?.trim() === 'Ja')!.click();
    const text = root.querySelector<HTMLTextAreaElement>('#beta-message')!;
    text.value = '  Die Vorschau hat geholfen.  ';
    text.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    form().dispatchEvent(new Event('submit', { cancelable: true }));
    const req = http.expectOne((r) => r.method === 'POST' && r.url === URL);
    expect(req.request.body).toEqual({
      area: 'HAUSHALT', task: '', understood: 5, in_control: null, saves_time: 'YES', would_continue: '',
      message: 'Die Vorschau hat geholfen.', page: location.pathname,
    });
    req.flush({ id: 1 });
    fixture.detectChanges();
    expect(root.textContent).toContain('Deine Rückmeldung ist angekommen');
    const buttons = Array.from(root.querySelectorAll('.modal-form__actions button')).map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['Schließen']);
  });

  it('keeps the answers when sending fails', () => {
    const { fixture, root, form } = setup();
    root.querySelectorAll<HTMLButtonElement>('.bf-option')[1].click();
    fixture.detectChanges();
    form().dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectOne(URL).flush('kaputt', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect((fixture.componentInstance.dialog() as unknown as { error: () => string }).error()).toContain('deine Angaben sind noch da');
    expect(root.querySelectorAll('.bf-option')[1].getAttribute('aria-pressed')).toBe('true');
  });
});
