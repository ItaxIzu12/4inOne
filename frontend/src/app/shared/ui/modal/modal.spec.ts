import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Modal } from './modal';

@Component({
  standalone: true,
  imports: [Modal],
  template: `
    <button type="button" id="trigger" (click)="modalOpen.set(true)">Öffnen</button>
    <app-modal [open]="modalOpen()" labelledBy="host-heading" (closed)="modalOpen.set(false)">
      <h2 id="host-heading">Testdialog</h2>
      <input id="first-field" type="text" />
      <button type="button" id="last-field">Letztes Element</button>
    </app-modal>
  `,
})
class HostComponent {
  protected readonly modalOpen = signal(false);
}

/** Ein Formular-Dialog: Klick auf den Hintergrund schließt ihn NICHT. */
@Component({
  standalone: true,
  imports: [Modal],
  template: `
    <app-modal [open]="open()" [dismissOnBackdrop]="false" labelledBy="form-heading" (closed)="closes = closes + 1; open.set(false)">
      <h2 id="form-heading">Formular</h2>
      <input id="typed" type="text" />
    </app-modal>
  `,
})
class FormHostComponent {
  protected readonly open = signal(true);
  closes = 0;
}

describe('Modal', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  });

  it('renders nothing when closed, and the dialog with correct ARIA wiring when open', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[role="dialog"]')).toBeNull();

    (compiled.querySelector('#trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const dialog = compiled.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('host-heading');
  });

  it('moves focus into the modal on open and back to the trigger on close', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const trigger = compiled.querySelector('#trigger') as HTMLButtonElement;

    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    // Der Fokuswechsel passiert in einem Mikrotask (siehe modal.ts) — auf
    // den nächsten Tick warten, bevor geprüft wird.
    await Promise.resolve();
    fixture.detectChanges();

    expect(document.activeElement?.id).toBe('first-field');

    const closeButton = compiled.querySelector('.modal-close') as HTMLButtonElement;
    closeButton.click();
    fixture.detectChanges();

    expect(document.activeElement?.id).toBe('trigger');
  });

  it('closes on Escape', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('#trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[role="dialog"]')).toBeTruthy();

    const dialog = compiled.querySelector('[role="dialog"]') as HTMLElement;
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[role="dialog"]')).toBeNull();
  });

  it('closes on backdrop click', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('#trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('.modal-backdrop') as HTMLElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[role="dialog"]')).toBeNull();
  });

  it('traps Tab at the last focusable element (the modal\'s own close button) back to the first', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('#trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    // Der Schließen-Button steht im DOM NACH dem projizierten Inhalt (siehe
    // modal.html) — er ist damit selbst das letzte fokussierbare Element
    // im Dialog, nicht #last-field aus dem projizierten Inhalt.
    const closeButton = compiled.querySelector('.modal-close') as HTMLButtonElement;
    const firstField = compiled.querySelector('#first-field') as HTMLInputElement;
    closeButton.focus();

    const dialog = compiled.querySelector('[role="dialog"]') as HTMLElement;
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    dialog.dispatchEvent(tabEvent);

    expect(document.activeElement).toBe(firstField);
  });

  describe('with dismissOnBackdrop = false (form dialogs)', () => {
    function setup() {
      const fixture = TestBed.createComponent(FormHostComponent);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      return { fixture, el, host: fixture.componentInstance };
    }

    it('a click on the backdrop keeps the dialog open and the typed input intact', () => {
      const { fixture, el, host } = setup();
      const input = el.querySelector('#typed') as HTMLInputElement;
      input.value = 'wichtige Eingabe';
      (el.querySelector('.modal-backdrop') as HTMLElement).click();
      fixture.detectChanges();
      expect(el.querySelector('[role="dialog"]')).not.toBeNull();
      expect(host.closes).toBe(0);
      expect((el.querySelector('#typed') as HTMLInputElement).value).toBe('wichtige Eingabe');
    });

    it('gives a short visual nudge instead, which fades again', async () => {
      vi.useFakeTimers();
      try {
        const { fixture, el } = setup();
        (el.querySelector('.modal-backdrop') as HTMLElement).click();
        fixture.detectChanges();
        expect(el.querySelector('.modal-panel')?.classList).toContain('modal-panel--nudge');
        vi.advanceTimersByTime(450);
        fixture.detectChanges();
        expect(el.querySelector('.modal-panel')?.classList).not.toContain('modal-panel--nudge');
      } finally {
        vi.useRealTimers();
      }
    });

    it('can still be closed deliberately: with the close button and with Escape', () => {
      const first = setup();
      (first.el.querySelector('.modal-close') as HTMLButtonElement).click();
      first.fixture.detectChanges();
      expect(first.host.closes).toBe(1);
      expect(first.el.querySelector('[role="dialog"]')).toBeNull();

      const second = setup();
      (second.el.querySelector('[role="dialog"]') as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      second.fixture.detectChanges();
      expect(second.host.closes).toBe(1);
    });
  });
});
