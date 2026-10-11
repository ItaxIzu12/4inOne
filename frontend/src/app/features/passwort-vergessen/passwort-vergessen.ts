import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ScrollService } from '../../core/scroll/scroll.service';
import { Brand } from '../../shared/brand/brand';

@Component({
  selector: 'app-passwort-vergessen',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Brand],
  templateUrl: './passwort-vergessen.html',
  styleUrl: './passwort-vergessen.css',
})
export class PasswortVergessen {
  private readonly fb = inject(FormBuilder);
  private readonly scroll = inject(ScrollService);
  private readonly auth = inject(AuthService);

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected goHome(): void {
    this.scroll.toTop();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Die Antwort ist absichtlich gleich, ob es ein Konto gibt oder nicht (keine Account-Enumeration).
    this.submitting.set(true);
    this.submitted.set(false);
    this.error.set(null);
    this.auth.requestPasswordReset(this.form.controls.email.value.trim()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.error.set(
          err.status === 429
            ? 'Zu viele Anfragen. Bitte versuche es in einer Stunde erneut.'
            : 'Das hat gerade nicht geklappt. Bitte versuche es gleich noch einmal.',
        );
      },
    });
  }
}
