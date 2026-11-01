import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { AppIcon } from '../icons/app-icon';

export type FeedbackTone = 'success' | 'warning' | 'error';

/** Lesezeit: 5 s Grundzeit, bei langen Meldungen etwas länger (höchstens 9 s). */
export function feedbackDuration(message: string): number {
  return Math.min(9000, 5000 + Math.max(0, message.length - 60) * 40);
}

/** Ton aus dem Text, wenn der Aufrufer keinen angibt: Fehler („konnte nicht“), Warnung („Achtung“), sonst Erfolg. */
export function feedbackTone(message: string): FeedbackTone {
  if (/konnte nicht|nicht geklappt|fehlgeschlagen|Fehler/i.test(message)) return 'error';
  if (/Achtung|Hinweis:/i.test(message)) return 'warning';
  return 'success';
}

/**
 * Kurze Rückmeldung nach Speichern, Löschen usw. (01.11.2026): helle, schwebende Karte mit Symbol, Text, ×-Knopf und
 * einer dünnen Zeitleiste. Schließt sich nach ~5 s selbst (lange Texte länger); Zeiger darüber oder Tastaturfokus
 * hält sie an (WCAG 2.2.1). Der Text steht immer in einer Live-Region, damit Screenreader ihn ansagen.
 * Rechner: oben in der Mitte (520 px). Handy: oben über die ganze Breite (16 px Rand), unter der Statusleiste.
 */
@Component({
  selector: 'app-save-feedback',
  standalone: true,
  imports: [AppIcon],
  template: `
    <div
      class="toast"
      [class.is-visible]="!!message()"
      [attr.data-tone]="tone()"
      (mouseenter)="pause()"
      (mouseleave)="resume()"
      (focusin)="pause()"
      (focusout)="resume()"
    >
      @if (message()) {
        <span class="toast__icon" aria-hidden="true"><app-icon [name]="tone() === 'success' ? 'check' : 'info'" /></span>
      }
      <p class="toast__text" role="status" aria-live="polite" aria-atomic="true">{{ message() }}</p>
      @if (message()) {
        <button type="button" class="toast__close" aria-label="Meldung schließen" (click)="dismissed.emit()">
          <app-icon name="close" aria-hidden="true" />
        </button>
        <span class="toast__time" aria-hidden="true">
          <!-- je Meldung ein neues Element: die Leiste startet wieder voll -->
          @for (r of [run()]; track r) {
            <i [style.animation-duration.ms]="duration()" [class.is-paused]="paused()"></i>
          }
        </span>
      }
    </div>
  `,
  styleUrl: './save-feedback.scss',
})
export class SaveFeedback {
  readonly message = input('');
  /** Optional: hochzählen, damit dieselbe Meldung ein zweites Mal neu startet. */
  readonly stamp = input(0);
  /** Optional festlegen; sonst aus dem Text abgeleitet (feedbackTone). */
  readonly toneOverride = input<FeedbackTone | undefined>(undefined, { alias: 'tone' });
  protected readonly tone = computed(() => this.toneOverride() ?? feedbackTone(this.message()));
  readonly dismissed = output<void>();

  protected readonly paused = signal(false);
  /** Wechselt bei jeder neuen Meldung, damit die Zeitleiste neu startet. */
  protected readonly run = signal(0);
  protected readonly duration = computed(() => feedbackDuration(this.message()));

  private timer?: ReturnType<typeof setTimeout>;
  private endsAt = 0;
  private remaining = 0;

  constructor() {
    effect(() => {
      const text = this.message();
      this.stamp();
      untracked(() => this.start(text));
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  private start(text: string): void {
    clearTimeout(this.timer);
    this.paused.set(false);
    if (!text) return;
    this.run.update((n) => n + 1);
    this.schedule(feedbackDuration(text));
  }

  private schedule(ms: number): void {
    this.remaining = ms;
    this.endsAt = Date.now() + ms;
    this.timer = setTimeout(() => this.dismissed.emit(), ms);
  }

  protected pause(): void {
    if (!this.message() || this.paused()) return;
    clearTimeout(this.timer);
    this.remaining = Math.max(800, this.endsAt - Date.now());
    this.paused.set(true);
  }

  protected resume(): void {
    if (!this.message() || !this.paused()) return;
    this.paused.set(false);
    this.schedule(this.remaining);
  }
}
