import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Field } from '../form/field';
import { ModalForm } from '../form/modal-form';
import { AppSelect, SelectOption } from '../form/select';
import { BetaAnswer, BetaChoice, BetaFeedbackService } from './beta-feedback.service';

const SCALE = [1, 2, 3, 4, 5];
const ANSWERS: { value: BetaAnswer; label: string }[] = [
  { value: 'YES', label: 'Ja' },
  { value: 'NO', label: 'Nein' },
  { value: 'UNSURE', label: 'Weiß nicht' },
];

/**
 * „Feedback geben“ im Beta-Test (Entwicklungsplan Phase 5): kurze Fragen aus dem Beobachtungsbogen
 * (docs/beta/BEOBACHTUNGSBOGEN.md) plus Freitext. Alles optional, mindestens eine Antwort. Nach dem Senden ein Dank
 * im selben Dialog; gesendet wird nur, was hier steht, und der Pfad der Seite.
 */
@Component({
  selector: 'app-beta-feedback-dialog',
  standalone: true,
  imports: [AppSelect, Field, ModalForm, RouterLink],
  templateUrl: './beta-feedback-dialog.html',
  styleUrl: './beta-feedback-dialog.scss',
})
export class BetaFeedbackDialog {
  readonly open = input.required<boolean>();
  readonly areas = input<BetaChoice[]>([]);
  readonly tasks = input<BetaChoice[]>([]);
  /** Bereich, aus dem der Dialog geöffnet wurde (Vorauswahl). */
  readonly area = input('GENERAL');
  readonly closed = output<void>();

  private readonly api = inject(BetaFeedbackService);
  protected readonly scale = SCALE;
  protected readonly answers = ANSWERS;
  protected readonly areaOptions = computed<SelectOption[]>(() => this.areas().map((a) => ({ value: a.value, label: a.label })));
  protected readonly taskOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Keine bestimmte Aufgabe' },
    ...this.tasks().map((t) => ({ value: t.value, label: `${t.value.slice(1)}. ${t.label}` })),
  ]);

  protected readonly chosenArea = signal('');
  protected readonly task = signal('');
  protected readonly understood = signal<number | null>(null);
  protected readonly inControl = signal<number | null>(null);
  protected readonly savesTime = signal<BetaAnswer>('');
  protected readonly wouldContinue = signal<BetaAnswer>('');
  protected readonly message = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly sent = signal(false);

  /** Beim Öffnen zurücksetzen (Bereich vorausgewählt). */
  reset(): void {
    this.chosenArea.set(this.area());
    this.task.set('');
    this.understood.set(null);
    this.inControl.set(null);
    this.savesTime.set('');
    this.wouldContinue.set('');
    this.message.set('');
    this.error.set('');
    this.sent.set(false);
  }

  protected toggle<T>(target: { (): T; set(value: T): void }, value: T, empty: T): void {
    target.set(target() === value ? empty : value);
  }

  protected submit(): void {
    if (this.sent()) {
      this.closed.emit();
      return;
    }
    const message = this.message().trim();
    const answered = this.understood() || this.inControl() || this.savesTime() || this.wouldContinue() || message;
    if (!answered) {
      this.error.set('Bitte mindestens eine Frage beantworten oder etwas schreiben.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.api
      .send({
        area: this.chosenArea() || 'GENERAL',
        task: this.task(),
        understood: this.understood(),
        in_control: this.inControl(),
        saves_time: this.savesTime(),
        would_continue: this.wouldContinue(),
        message,
        page: typeof location === 'undefined' ? '' : location.pathname,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.sent.set(true);
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Senden hat nicht geklappt. Bitte noch einmal versuchen – deine Angaben sind noch da.');
        },
      });
  }
}
