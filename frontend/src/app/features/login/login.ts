import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ScrollService } from '../../core/scroll/scroll.service';
import { LogoKompass } from '../../shared/icons/logo-kompass';
import { IconArrowLeft } from '../../shared/icons/icon-arrow-left';

type Mode = 'login' | 'register';

// Passwort-Richtlinie: Länge statt erzwungener Zeichenvielfalt (NIST SP 800-63B) —
// kein Pflicht-Sonderzeichen/Großbuchstabe, das bringt laut NIST kaum Sicherheitsgewinn
// und ist gerade für die ältere Zielgruppe aus GESAMTKONZEPT.md eine unnötige Hürde.
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_HAS_LETTER = /[a-zA-Zà-öø-ÿÀ-ÖØ-ß]/;
const PASSWORD_HAS_DIGIT = /\d/;
// Nur für die optische Stärkeanzeige (nicht Teil der harten Policy oben):
// ein Sonderzeichen ist NICHT Pflicht, hebt die Anzeige aber als drittes,
// zusätzliches Signal an — siehe passwordStrength().
const PASSWORD_HAS_SPECIAL = /[^A-Za-zÀ-ÖØ-öø-ÿ0-9\s]/;
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
  imports: [ReactiveFormsModule, RouterLink, LogoKompass, IconArrowLeft],
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
      password: [
        '',
        [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH), Validators.pattern(PASSWORD_POLICY_PATTERN)],
      ],
      confirmPassword: ['', [Validators.required]],
      // Bewusst kein Validators.required: leer -> Backend-Fallback
      // ("Haushalt von {Vorname}"), siehe auth_views.py RegisterView.
      householdName: [''],
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

  // Rein optische Zusatzanzeige (3 Balken), NICHT die durchgesetzte Policy
  // (die bleibt Länge+Buchstabe+Ziffer, siehe passwordChecks/PASSWORD_POLICY_PATTERN).
  // Bewertet zusätzlich Sonderzeichen als drittes Signal für "wie stark wirkt es".
  protected readonly passwordStrength = computed(() => {
    const value = this.registerPassword();
    if (!value) return 0;
    let score = 0;
    if (value.length >= PASSWORD_MIN_LENGTH) score++;
    if (PASSWORD_HAS_DIGIT.test(value)) score++;
    if (PASSWORD_HAS_SPECIAL.test(value)) score++;
    return score;
  });

  private errorDismissTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    // Serverfehler ("E-Mail-Adresse oder Passwort ist falsch.") soll nicht
    // stehen bleiben, sobald man die Eingabe korrigiert — sonst wirkt eine
    // neu eingetippte E-Mail-Adresse fälschlich weiterhin als falsch.
    const clearSubmitError = () => this.clearSubmitError();
    this.loginForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(clearSubmitError);
    this.registerForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(clearSubmitError);
    inject(DestroyRef).onDestroy(() => clearTimeout(this.errorDismissTimeout));
  }

  private clearSubmitError(): void {
    clearTimeout(this.errorDismissTimeout);
    this.submitError.set(null);
  }

  /** Blendet die allgemeine Fehlermeldung nach ein paar Sekunden von selbst
   * wieder aus, statt dauerhaft stehen zu bleiben. */
  private scheduleErrorDismiss(): void {
    clearTimeout(this.errorDismissTimeout);
    this.errorDismissTimeout = setTimeout(() => this.submitError.set(null), 5000);
  }

  protected goHome(): void {
    this.scroll.toTop();
  }

  protected setMode(mode: Mode): void {
    if (this.mode() === mode) {
      return;
    }
    this.mode.set(mode);
    this.clearSubmitError();
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
    this.clearSubmitError();
    this.submitting.set(true);
    const { email, password, remember } = this.loginForm.getRawValue();

    this.auth.login(email, password, remember).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigateByUrl('/app');
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
        this.scheduleErrorDismiss();
      },
    });
  }

  protected submitRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.clearSubmitError();
    this.submitting.set(true);
    const { name, email, password, householdName } = this.registerForm.getRawValue();

    this.auth.register(name, email, password, householdName).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigateByUrl('/app');
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
      this.scheduleErrorDismiss();
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
