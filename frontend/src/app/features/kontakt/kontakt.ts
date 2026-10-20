import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { API_BASE_URL } from '../../core/api.config';
import { PublicShell } from '../../shared/public-shell/public-shell';

/** Grenzen wie im Backend (website/views.py › ContactSerializer) — dort werden sie durchgesetzt. */
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 4000;

/**
 * Öffentliches Kontaktformular. Nach dem Absenden geht es auf /kontakt/danke. Das Feld „website“ ist ein für Menschen
 * unsichtbares Honeypot-Feld: Bots füllen es aus, das Backend verwirft solche Nachrichten still.
 */
@Component({
  selector: 'app-kontakt',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PublicShell],
  templateUrl: './kontakt.html',
  styleUrl: './kontakt.scss',
})
export class Kontakt {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly max = MESSAGE_MAX;
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    message: ['', [Validators.required, Validators.minLength(MESSAGE_MIN), Validators.maxLength(MESSAGE_MAX)]],
    website: [''],
  });

  protected invalid(name: 'name' | 'email' | 'message'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.http
      .post(`${API_BASE_URL}/site/contact/`, {
        name: value.name.trim(),
        email: value.email.trim(),
        message: value.message.trim(),
        website: value.website,
      })
      .subscribe({
        next: () => void this.router.navigateByUrl('/kontakt/danke'),
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.error.set(
            err.status === 429
              ? 'Du hast gerade schon mehrere Nachrichten geschickt. Bitte versuche es in einer Stunde erneut.'
              : err.status === 400
                ? 'Bitte prüfe deine Angaben.'
                : 'Das hat gerade nicht geklappt. Bitte versuche es gleich noch einmal.',
          );
        },
      });
  }
}
