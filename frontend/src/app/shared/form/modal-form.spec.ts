import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Field } from './field';
import { ModalForm } from './modal-form';

@Component({
  standalone: true,
  imports: [ModalForm, Field],
  template: `
    <app-modal-form
      title="Sparziel erstellen"
      [open]="open()"
      [saving]="saving()"
      [error]="error()"
      [deleteLabel]="canDelete() ? 'Eintrag löschen' : ''"
      (submitted)="submits = submits + 1"
      (closed)="closes = closes + 1"
      (deleted)="deletes = deletes + 1"
    >
      <app-field label="Titel" hint="Kurz halten" [optional]="optional()">
        <input id="t" />
      </app-field>
    </app-modal-form>
  `,
})
class Host {
  open = signal(true);
  saving = signal(false);
  error = signal('');
  canDelete = signal(false);
  optional = signal(false);
  submits = 0;
  closes = 0;
  deletes = 0;
}

describe('ModalForm', () => {
  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = () => Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
    const click = (label: string) => {
      (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    return { fixture, host: fixture.componentInstance, el, buttons, click };
  }

  it('shows the title as accessible dialog name and renders the fields', () => {
    const { el } = setup();
    const dialog = el.querySelector('[role="dialog"]') as HTMLElement;
    const heading = el.querySelector('h2') as HTMLElement;
    expect(heading.textContent).toBe('Sparziel erstellen');
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(el.querySelector('app-field input')).not.toBeNull();
  });

  it('labels the projected control through a wrapping label and shows hint and optional marker', () => {
    const { fixture, host, el } = setup();
    const label = el.querySelector('label.field__control') as HTMLLabelElement;
    expect(label.contains(el.querySelector('#t'))).toBe(true);
    expect(label.textContent).toContain('Titel');
    expect(el.querySelector('.field__hint')?.textContent).toBe('Kurz halten');
    expect(label.textContent).not.toContain('(optional)');
    host.optional.set(true);
    fixture.detectChanges();
    expect(label.textContent).toContain('(optional)');
    expect(label.textContent).toContain('Titel (optional)'); // echtes Leerzeichen für Screenreader
  });

  it('emits submitted on save and closed on cancel', () => {
    const { fixture, host, click } = setup();
    click('Speichern');
    click('Abbrechen');
    expect(host.submits).toBe(1);
    expect(host.closes).toBe(1);
    fixture.detectChanges();
  });

  it('does not submit while saving and disables the actions', () => {
    const { fixture, host, el } = setup();
    host.saving.set(true);
    fixture.detectChanges();
    const save = el.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(save.textContent?.trim()).toBe('Wird gespeichert …');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    expect(host.submits).toBe(0);
  });

  it('shows the error text as an alert', () => {
    const { fixture, host, el } = setup();
    host.error.set('Bitte Betrag prüfen.');
    fixture.detectChanges();
    expect(el.querySelector('.modal-form__error')?.getAttribute('role')).toBe('alert');
    expect(el.querySelector('.modal-form__error')?.textContent).toBe('Bitte Betrag prüfen.');
  });

  it('offers no delete button unless a delete label is given', () => {
    const { buttons } = setup();
    expect(buttons()).not.toContain('Eintrag löschen');
  });

  it('asks before deleting: only the confirmation emits deleted, keeping cancels it', () => {
    const { fixture, host, buttons, click } = setup();
    host.canDelete.set(true);
    fixture.detectChanges();

    click('Eintrag löschen');
    expect(host.deletes).toBe(0);
    expect(buttons()).toEqual(expect.arrayContaining(['Ja, löschen', 'Behalten']));

    click('Behalten');
    expect(host.deletes).toBe(0);
    expect(buttons()).toContain('Eintrag löschen');

    click('Eintrag löschen');
    click('Ja, löschen');
    expect(host.deletes).toBe(1);
  });

  it('forgets a pending delete confirmation when the dialog is closed and reopened', () => {
    const { fixture, host, buttons, click } = setup();
    host.canDelete.set(true);
    fixture.detectChanges();
    click('Eintrag löschen');

    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    expect(buttons()).toContain('Eintrag löschen');
    expect(buttons()).not.toContain('Ja, löschen');
  });
});


@Component({
  standalone: true,
  imports: [ModalForm, Field, ReactiveFormsModule],
  template: `
    <app-modal-form [formGroup]="form" title="Reaktiv" [open]="true" (submitted)="saved = form.getRawValue().title">
      <app-field label="Titel"><input id="rt" formControlName="title" /></app-field>
    </app-modal-form>
  `,
})
class ReactiveHost {
  form = new FormGroup({ title: new FormControl('Start', { nonNullable: true, validators: Validators.required }) });
  saved = '';
}

describe('ModalForm with reactive forms', () => {
  it('binds formControlName inside the dialog in both directions and submits with Enter/Save', () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('#rt') as HTMLInputElement;

    expect(input.value).toBe('Start');
    input.value = 'Neu';
    input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.form.getRawValue().title).toBe('Neu');

    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    expect(fixture.componentInstance.saved).toBe('Neu');
  });
});
