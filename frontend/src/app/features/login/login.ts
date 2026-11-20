import { AppIcon } from '../../shared/icons/app-icon';
import { Brand } from '../../shared/brand/brand';
import { HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Component, DOCUMENT, ElementRef, PLATFORM_ID, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, SocialProvider } from '../../core/auth/auth.service';
import { DEMO_ONLY } from '../../core/demo-only';
import { IconArrowLeft } from '../../shared/icons/icon-arrow-left';
import { passwordPolicy, personalParts } from '../../shared/password-policy';
import { PasswordStrength } from '../../shared/password-strength/password-strength';

type Mode = 'login' | 'register';
/** form = E-Mail/Passwort · mfa = Code nach Passwort · link = Google/Apple mit bestehendem Konto verbinden ·
 * social-mfa = Code nach Google/Apple · finishing = Rückkehr vom Anbieter wird abgeschlossen */
type View = 'form' | 'mfa' | 'link' | 'social-mfa' | 'finishing';

const PROVIDER_NAME: Record<SocialProvider, string> = { google: 'Google', apple: 'Apple' };

/** Kurzwörter vom Backend (core/social_views.py) → verständliche Sätze, ohne technische Details. */
const SOCIAL_ERRORS: Record<string, string> = {
  abgebrochen: 'Die Anmeldung wurde abgebrochen. Du kannst es jederzeit noch einmal versuchen.',
  abgelaufen: 'Die Anmeldung hat zu lange gedauert. Bitte versuche es noch einmal.',
  email: 'Dein Konto beim Anbieter hat keine bestätigte E-Mail-Adresse. Bitte bestätige sie dort oder nutze E-Mail und Passwort.',
  gesperrt: 'Dieses Konto ist gesperrt.',
  token: 'Die Anmeldung konnte nicht bestätigt werden. Bitte versuche es noch einmal.',
  anbieter: 'Der Anbieter ist gerade nicht erreichbar. Bitte versuche es später noch einmal.',
};

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password && confirmPassword && password !== confirmPassword ? { mismatch: true } : null;
}

/**
 * Anmelden und Konto erstellen (Neubau 19.11.2026, 4inOne-Stil): links ein Band in Deep Forest mit Leitsatz, den vier
 * Bereichen und dem Datenschutz-Versprechen, rechts eine Formularspalte. Oben „Weiter mit Google/Apple“, nur wenn
 * eingerichtet; darunter E-Mail und Passwort. Dieselbe Seite übernimmt die Folgeschritte: Zwei-Faktor-Code,
 * Verknüpfen eines bestehenden Kontos (nur mit dessen Passwort) und den Abschluss nach der Rückkehr vom Anbieter.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [AppIcon, Brand, ReactiveFormsModule, RouterLink, IconArrowLeft, PasswordStrength],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly doc = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly errorBox = viewChild<ElementRef<HTMLElement>>('errorBox');
  private readonly stepHeading = viewChild<ElementRef<HTMLElement>>('stepHeading');

  protected readonly mode = signal<Mode>(this.route.snapshot.data['mode'] === 'register' ? 'register' : 'login');
  protected readonly view = signal<View>('form');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);
  protected readonly code = signal('');
  protected readonly providers = signal<SocialProvider[]>([]);
  protected readonly redirectingTo = signal<SocialProvider | null>(null);
  protected readonly pendingProvider = signal<SocialProvider>('google');
  protected readonly pendingEmail = signal('');
  protected readonly pendingHasPassword = signal(true);
  protected readonly linkNeedsCode = signal(false);
  protected readonly providerName = PROVIDER_NAME;

  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    // Nur Pflicht: ältere Passwörter können unter einer früheren Richtlinie entstanden sein — geprüft wird serverseitig.
    password: ['', [Validators.required]],
    remember: [true],
  });

  protected readonly registerForm = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      email: ['', [Validators.required, Validators.email]],
      // Richtlinie nach LKA NRW / BSI (shared/password-policy.ts); Name und E-Mail aus demselben Formular
      password: ['', [Validators.required, passwordPolicy(() => this.personal())]],
      confirmPassword: ['', [Validators.required]],
      acceptPrivacy: [false, [Validators.requiredTrue]],
    },
    { validators: passwordsMatch },
  );

  protected readonly linkForm = this.fb.nonNullable.group({ password: ['', [Validators.required]] });

  protected readonly registerValue = toSignal(this.registerForm.valueChanges, { initialValue: this.registerForm.getRawValue() });
  protected readonly personalNow = computed(() => personalParts(this.registerValue().name, this.registerValue().email));
  /** Name/E-Mail-Teile für die Regel „nicht dein Name oder deine E-Mail“ (Validator und Anzeige). */
  protected personal(): string[] {
    const form = this.registerForm as typeof this.registerForm | undefined; // beim Aufbau des Formulars noch leer
    return form ? personalParts(form.controls.name.value, form.controls.email.value) : [];
  }

  /** Feldfehler erst nach dem ersten Absenden zeigen (4inOne-Regel), danach live. */
  protected readonly loginTried = signal(false);
  protected readonly registerTried = signal(false);
  protected readonly linkTried = signal(false);

  constructor() {
    const clear = () => this.submitError.set(null);
    this.loginForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(clear);
    this.registerForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(clear);
    // Name/E-Mail ändern die Regel „nicht dein Name oder deine E-Mail“ — Passwort neu prüfen
    for (const c of [this.registerForm.controls.name, this.registerForm.controls.email]) {
      c.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.registerForm.controls.password.updateValueAndValidity({ emitEvent: false }));
    }
    this.linkForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(clear);
    if (this.browser && !DEMO_ONLY) {
      this.auth.socialProviders().pipe(takeUntilDestroyed()).subscribe({
        next: (p) => this.providers.set((Object.keys(p) as SocialProvider[]).filter((k) => p[k])),
        error: () => this.providers.set([]), // ohne Backend einfach ohne Google/Apple
      });
      this.handleReturn();
    }
  }

  // ---------- Rückkehr von Google/Apple ----------
  private handleReturn(): void {
    const params = this.route.snapshot.queryParamMap;
    const social = params.get('social');
    const error = params.get('fehler');
    if (error) {
      this.showError(SOCIAL_ERRORS[error] ?? SOCIAL_ERRORS['token']);
      this.cleanUrl();
      return;
    }
    if (social === 'ok' || social === 'neu') {
      this.view.set('finishing');
      this.auth.refresh().subscribe({
        next: () => this.router.navigateByUrl(social === 'neu' ? '/onboarding' : '/', { replaceUrl: true }),
        error: () => {
          this.view.set('form');
          this.showError(SOCIAL_ERRORS['abgelaufen']);
          this.cleanUrl();
        },
      });
      return;
    }
    if (social === 'verknuepfen' || social === 'zwei-faktor') {
      this.view.set('finishing');
      this.auth.socialPending().subscribe({
        next: (pending) => {
          if (!pending.step || !pending.provider) {
            this.view.set('form');
            this.showError(SOCIAL_ERRORS['abgelaufen']);
            this.cleanUrl();
            return;
          }
          this.pendingProvider.set(pending.provider);
          this.pendingEmail.set(pending.email ?? '');
          this.pendingHasPassword.set(pending.has_password !== false);
          this.setView(pending.step === 'link' ? 'link' : 'social-mfa');
        },
        error: () => {
          this.view.set('form');
          this.showError(SOCIAL_ERRORS['abgelaufen']);
        },
      });
    }
  }

  private cleanUrl(): void {
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected startSocial(provider: SocialProvider): void {
    if (this.redirectingTo()) return;
    this.redirectingTo.set(provider);
    this.leaveTo(this.auth.socialStartUrl(provider));
  }

  /** Ganze Seite zum Backend (das leitet zum Anbieter weiter) — eigene Methode, damit Tests sie beobachten können. */
  protected leaveTo(url: string): void {
    this.doc.location.assign(url);
  }

  protected cancelSocial(): void {
    this.auth.socialCancel().subscribe({ complete: () => undefined, error: () => undefined });
    this.code.set('');
    this.linkForm.reset();
    this.linkTried.set(false);
    this.linkNeedsCode.set(false);
    this.submitError.set(null);
    this.setView('form');
    this.cleanUrl();
  }

  // ---------- Allgemein ----------
  private setView(view: View): void {
    this.view.set(view);
    setTimeout(() => this.stepHeading()?.nativeElement.focus());
  }

  private showError(message: string): void {
    this.submitError.set(message);
    setTimeout(() => this.errorBox()?.nativeElement.focus());
  }

  protected setCode(value: string): void {
    // Nur Ziffern; Einfügen aus dem Passwort-Manager oder per SMS-Vorschlag bleibt erlaubt (WCAG 3.3.8)
    this.code.set(value.replace(/\D/g, '').slice(0, 8));
    this.submitError.set(null);
  }

  protected togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  protected toggleConfirmPassword(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  protected backToForm(): void {
    this.code.set('');
    this.submitError.set(null);
    this.setView('form');
  }

  // ---------- E-Mail und Passwort ----------
  protected submitLogin(): void {
    if (this.submitting()) return;
    this.loginTried.set(true);
    this.submitError.set(null);
    if (this.view() === 'mfa' && !this.code()) {
      this.showError('Bitte gib den Code aus deiner Authenticator-App ein.');
      return;
    }
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const { email, password, remember } = this.loginForm.getRawValue();
    this.auth.login(email.trim(), password, remember, this.code()).subscribe({
      next: (response) => {
        this.submitting.set(false);
        if ('mfa_required' in response) {
          this.setView('mfa');
          return;
        }
        this.router.navigateByUrl('/');
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.showError(
          err.status === 0
            ? 'Der Server ist nicht erreichbar. Bitte versuche es später noch einmal.'
            : err.status === 429
              ? 'Zu viele Anmeldeversuche. Bitte warte einen Moment und versuche es dann noch einmal.'
              : this.view() === 'mfa'
                ? 'Der Code stimmt nicht oder ist abgelaufen.'
                : // Falsche Zugangsdaten und axes-Sperre bewusst gleich, damit niemand die Fälle unterscheiden kann
                  'E-Mail-Adresse oder Passwort ist falsch.',
        );
      },
    });
  }

  protected submitRegister(): void {
    if (this.submitting()) return;
    this.registerTried.set(true);
    this.submitError.set(null);
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const { name, email, password, confirmPassword, acceptPrivacy } = this.registerForm.getRawValue();
    this.auth.register(name.trim(), email.trim(), password, confirmPassword, acceptPrivacy).subscribe({
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
      this.showError('Der Server ist nicht erreichbar. Bitte versuche es später noch einmal.');
      return;
    }
    if (err.status === 429) {
      this.showError('Zu viele Versuche. Bitte warte einen Moment und versuche es dann noch einmal.');
      return;
    }
    // Serverseitige Feldfehler (Passwort-Richtlinie, E-Mail vergeben …) wie normale Formularfehler am Feld zeigen
    const body = err.error as Record<string, string[]> | undefined;
    let mapped = false;
    for (const [key, control] of [
      ['email', this.registerForm.controls.email],
      ['password', this.registerForm.controls.password],
      ['name', this.registerForm.controls.name],
      ['confirm_password', this.registerForm.controls.confirmPassword],
      ['accept_privacy', this.registerForm.controls.acceptPrivacy],
    ] as const) {
      if (body?.[key]?.length) {
        control.setErrors({ backend: body[key][0] });
        control.markAsTouched();
        mapped = true;
      }
    }
    if (!mapped) this.showError('Das Konto konnte nicht erstellt werden. Bitte versuche es noch einmal.');
  }

  // ---------- Google/Apple: bestehendes Konto verknüpfen / Zwei-Faktor ----------
  protected submitLink(): void {
    if (this.submitting()) return;
    this.linkTried.set(true);
    this.submitError.set(null);
    if (this.linkForm.invalid) return;
    if (this.linkNeedsCode() && !this.code()) {
      this.showError('Bitte gib den Code aus deiner Authenticator-App ein.');
      return;
    }
    this.submitting.set(true);
    this.auth.socialLink(this.linkForm.getRawValue().password, this.code()).subscribe({
      next: (response) => {
        this.submitting.set(false);
        if ('mfa_required' in response) {
          this.linkNeedsCode.set(true);
          setTimeout(() => this.doc.getElementById('link-code')?.focus());
          return;
        }
        this.router.navigateByUrl('/', { replaceUrl: true });
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.showError(
          err.status === 401
            ? this.linkNeedsCode()
              ? 'Passwort oder Code stimmt nicht.'
              : 'Das Passwort stimmt nicht.'
            : err.status === 409
              ? `Dieser ${this.providerName[this.pendingProvider()]}-Zugang ist schon mit einem anderen Konto verbunden.`
              : err.status === 429
                ? 'Zu viele Versuche. Bitte warte einen Moment und versuche es dann noch einmal.'
                : 'Die Verknüpfung ist abgelaufen. Bitte melde dich noch einmal an.',
        );
      },
    });
  }

  protected submitSocialMfa(): void {
    if (this.submitting()) return;
    if (!this.code()) {
      this.showError('Bitte gib den Code aus deiner Authenticator-App ein.');
      return;
    }
    this.submitting.set(true);
    this.auth.socialMfa(this.code()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigateByUrl('/', { replaceUrl: true });
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.showError(
          err.status === 401
            ? 'Der Code stimmt nicht oder ist abgelaufen.'
            : err.status === 429
              ? 'Zu viele Versuche. Bitte warte einen Moment und versuche es dann noch einmal.'
              : 'Die Anmeldung ist abgelaufen. Bitte melde dich noch einmal an.',
        );
      },
    });
  }
}
