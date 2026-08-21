import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ScrollService } from '../../core/scroll/scroll.service';

@Component({
  selector: 'app-passwort-vergessen',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './passwort-vergessen.html',
  styleUrl: '../login/login.css',
})
export class PasswortVergessen {
  private readonly fb = inject(FormBuilder);
  private readonly scroll = inject(ScrollService);

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);

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

    // TODO (Backend, siehe ARCHITEKTUR.md §3.6 "Account-Recovery"): Die tatsächliche Antwort muss
    // unabhängig davon, ob zur eingegebenen E-Mail-Adresse ein Konto existiert, textlich und
    // zeitlich identisch sein (keine Account-Enumeration). Reset-Token kryptographisch zufällig,
    // einmalig nutzbar, kurze Ablaufzeit (~30 Min.). Aktuell nur Client-seitige Stub-Bestätigung,
    // kein echter Versand.
    this.submitting.set(true);
    this.submitted.set(false);
    setTimeout(() => {
      this.submitting.set(false);
      this.submitted.set(true);
    }, 500);
  }
}
