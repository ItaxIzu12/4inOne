import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ScrollService } from '../../core/scroll/scroll.service';

type Mode = 'login' | 'register';

// Passwort-Richtlinie: Länge statt erzwungener Zeichenvielfalt (NIST SP 800-63B) —
// kein Pflicht-Sonderzeichen/Großbuchstabe, das bringt laut NIST kaum Sicherheitsgewinn
// und ist gerade für die ältere Zielgruppe aus GESAMTKONZEPT.md eine unnötige Hürde.
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_HAS_LETTER = /[a-zA-Zà-öø-ÿÀ-ÖØ-ß]/;
const PASSWORD_HAS_DIGIT = /\d/;
const PASSWORD_POLICY_PATTERN = new RegExp(
  `^(?=.*${PASSWORD_HAS_LETTER.source})(?=.*${PASSWORD_HAS_DIGIT.source}).{${PASSWORD_MIN_LENGTH},}$`,
);

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password && confirmPassword && password !== confirmPassword ? { mismatch: true } : null;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly scroll = inject(ScrollService);
  private readonly auth = inject(AuthService);

  protected readonly mode = signal<Mode>(
    this.route.snapshot.data['mode'] === 'register' ? 'register' : 'login',
  );
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);

  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    // Nur "required": ein bestehendes Konto kann ein Passwort haben, das unter einer
    // früheren Richtlinie vergeben wurde — die Prüfung selbst passiert serverseitig.
    password: ['', [Validators.required]],
    remember: [true],
  });

  protected readonly registerForm = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.pattern(PASSWORD_POLICY_PATTERN)]],
      confirmPassword: ['', [Validators.required]],
      acceptPrivacy: [false, [Validators.requiredTrue]],
    },
    { validators: passwordsMatch },
  );

  private readonly registerPassword = toSignal(this.registerForm.controls.password.valueChanges, {
    initialValue: '',
  });

  protected readonly passwordChecks = computed(() => {
    const value = this.registerPassword();
    return {
      length: value.length >= PASSWORD_MIN_LENGTH,
      letter: PASSWORD_HAS_LETTER.test(value),
      digit: PASSWORD_HAS_DIGIT.test(value),
    };
  });

  protected goHome(): void {
    this.scroll.toTop();
  }

  protected setMode(mode: Mode): void {
    if (this.mode() === mode) {
      return;
    }
    this.mode.set(mode);
    this.submitError.set(null);
    this.router.navigate([mode === 'register' ? '/registrieren' : '/login']);
  }

  protected togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  protected toggleConfirmPassword(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  protected submitLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.submitError.set(null);
    this.submitting.set(true);
    const { email, password } = this.loginForm.getRawValue();

    this.auth.login(email, password).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigateByUrl('/');
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.submitError.set(
          err.status === 0
            ? 'Server nicht erreichbar. Bitte versuche es später erneut.'
            // 401 deckt sowohl falsche Zugangsdaten als auch eine Axes-
            // Sperre nach zu vielen Fehlversuchen ab (ARCHITEKTUR.md §3.1)
            // — bewusst dieselbe Meldung für beides, damit niemand von
            // außen erkennen kann, welcher der beiden Fälle vorliegt.
            : 'E-Mail-Adresse oder Passwort ist falsch.',
        );
      },
    });
  }

  protected submitRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.submitError.set(null);
    this.submitting.set(true);
    const { name, email, password } = this.registerForm.getRawValue();

    this.auth.register(name, email, password).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigateByUrl('/');
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.applyRegisterFieldErrors(err);
      },
    });
  }

  private applyRegisterFieldErrors(err: HttpErrorResponse): void {
    if (err.status === 0) {
      this.submitError.set('Server nicht erreichbar. Bitte versuche es später erneut.');
      return;
    }

    // Serverseitige Validierungsfehler (z. B. Passwort-Policy oder
    // E-Mail bereits vergeben, siehe core/validators.py auf dem Backend)
    // landen als Feldfehler in der Antwort — auf die jeweiligen Controls
    // mappen, damit sie wie normale Formularfehler angezeigt werden.
    const body = err.error as Record<string, string[]> | undefined;
    let mapped = false;
    if (body?.['email']?.length) {
      this.registerForm.controls.email.setErrors({ backend: body['email'][0] });
      this.registerForm.controls.email.markAsTouched();
      mapped = true;
    }
    if (body?.['password']?.length) {
      this.registerForm.controls.password.setErrors({ backend: body['password'][0] });
      this.registerForm.controls.password.markAsTouched();
      mapped = true;
    }

    if (!mapped) {
      this.submitError.set('Registrierung ist fehlgeschlagen. Bitte versuche es erneut.');
    }
  }
}
