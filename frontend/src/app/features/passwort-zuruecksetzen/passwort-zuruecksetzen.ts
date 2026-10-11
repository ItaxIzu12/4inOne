import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Brand } from '../../shared/brand/brand';

// Gleiche Richtlinie wie bei der Registrierung (login.ts); das Backend prüft zusätzlich.
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_POLICY_PATTERN = new RegExp(`^(?=.*[a-zA-Zà-öø-ÿÀ-ÖØ-ß])(?=.*\\d).{${PASSWORD_MIN_LENGTH},}$`);

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const { password, confirmPassword } = control.value as { password: string; confirmPassword: string };
  return password && confirmPassword && password !== confirmPassword ? { mismatch: true } : null;
}

type State = 'form' | 'done' | 'invalid-link';

/**
 * Zweiter Schritt des Passwort-Resets: Ziel des Links aus der E-Mail (/passwort-zuruecksetzen?token=…).
 * Das Token wird nur im Speicher gehalten und sofort aus der Adresszeile entfernt — so landet es weder
 * im Verlauf noch in Lesezeichen. Prüfung, Einmal-Nutzung und Abmeldung aller Geräte macht das Backend.
 */
@Component({
  selector: 'app-passwort-zuruecksetzen',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Brand],
  templateUrl: './passwort-zuruecksetzen.html',
  styleUrl: '../passwort-vergessen/passwort-vergessen.css',
})
export class PasswortZuruecksetzen {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';

  protected readonly state = signal<State>(this.token ? 'form' : 'invalid-link');
  protected readonly submitting = signal(false);
  protected readonly tried = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.pattern(PASSWORD_POLICY_PATTERN)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  constructor() {
    if (this.token) {
      inject(Router).navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  protected passwordError(): string | null {
    const errors = this.form.controls.password.errors;
    if (!this.tried() || !errors) return null;
    return errors['required'] ? 'Bitte gib ein neues Passwort ein.' : 'Mindestens 10 Zeichen, mit mindestens einem Buchstaben und einer Zahl.';
  }

  protected confirmError(): string | null {
    if (!this.tried()) return null;
    if (this.form.controls.confirmPassword.errors?.['required']) return 'Bitte wiederhole das neue Passwort.';
    return this.form.errors?.['mismatch'] ? 'Die Passwörter stimmen nicht überein.' : null;
  }

  protected submit(): void {
    this.tried.set(true);
    this.error.set(null);
    if (this.form.invalid) return;

    this.submitting.set(true);
    this.auth.confirmPasswordReset(this.token, this.form.controls.password.value).subscribe({
      next: () => {
        this.submitting.set(false);
        this.state.set('done');
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        if (err.status === 400 && err.error?.password) {
          this.error.set('Dieses Passwort ist zu leicht zu erraten. Bitte wähle ein anderes.');
        } else if (err.status === 400) {
          this.state.set('invalid-link');
        } else if (err.status === 429) {
          this.error.set('Zu viele Versuche. Bitte versuche es in einer Stunde erneut.');
        } else {
          this.error.set('Das hat gerade nicht geklappt. Bitte versuche es gleich noch einmal.');
        }
      },
    });
  }
}
