import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { OnboardingApiService } from '../../core/onboarding/onboarding-api.service';
import { Brand } from '../../shared/brand/brand';
import { AppIcon, IconName } from '../../shared/icons/app-icon';
@Component({
  selector: 'app-onboarding-page',
  standalone: true,
  imports: [Brand, AppIcon],
  templateUrl: './onboarding-page.html',
  styleUrl: './onboarding-page.scss',
})
export class OnboardingPage {
  private api = inject(OnboardingApiService);
  private router = inject(Router);
  private destroy = inject(DestroyRef);
  private heading = viewChild<ElementRef<HTMLElement>>('heading');
  readonly step = signal(1);
  readonly loading = signal(true);
  readonly allowed = signal(false);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly usage = signal<'personal' | 'shared' | null>(null);
  readonly selected = signal<string[]>([]);
  readonly stages = ['Willkommen', 'Nutzung', 'Interessen', 'Fertig'];
  readonly domains: { key: string; label: string; icon: IconName; description: string }[] = [
    {
      key: 'finanzen',
      label: 'Finanzen',
      icon: 'finance',
      description: 'Budgets, Ausgaben und mehr im Blick behalten.',
    },
    {
      key: 'haushalt',
      label: 'Haushalt',
      icon: 'household',
      description: 'Aufgaben, Einkaufslisten und alles rund um dein Zuhause.',
    },
    {
      key: 'organisation',
      label: 'Organisation',
      icon: 'calendar',
      description: 'Termine, To-dos und wichtige Erinnerungen.',
    },
    {
      key: 'reisen',
      label: 'Reisen',
      icon: 'travel',
      description: 'Reisen planen und Vorfreude sammeln.',
    },
  ];
  constructor() {
    this.load();
  }
  load() {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (status) => {
          this.loading.set(false);
          if (!status.needs_onboarding) {
            this.router.navigateByUrl('/', { replaceUrl: true });
            return;
          }
          this.allowed.set(true);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(
            'Dein Einrichtungsstatus konnte nicht geladen werden. Bitte versuche es erneut.',
          );
        },
      });
  }
  toggle(key: string) {
    this.selected.update((values) =>
      values.includes(key) ? values.filter((x) => x !== key) : [...values, key],
    );
  }
  move(step: number) {
    this.error.set('');
    this.step.set(step);
    setTimeout(() => this.heading()?.nativeElement.focus());
  }
  next() {
    if (this.step() === 2 && !this.usage()) {
      this.error.set('Bitte wähle aus, wie du 4inOne nutzen möchtest.');
      return;
    }
    if (this.step() === 3 && !this.selected().length) {
      this.error.set('Wähle mindestens einen Bereich aus.');
      return;
    }
    this.move(this.step() + 1);
  }
  /** Beide Wege speichern dieselbe Auswahl (needs_onboarding wird serverseitig erst dadurch false, siehe
   * onboarding.guard.ts) — „4inOne entdecken“ führt zur öffentlichen Demo (Beispieldaten, siehe app.routes.ts),
   * „Mit meinen Daten starten“ in den eigenen, leeren Arbeitsbereich.
   *
   * Zielseite danach: bei GENAU einem gewählten Bereich direkt dorthin (kürzester Weg vom Interesse zum
   * Ergebnis) — die Domain-Keys ('finanzen'/'haushalt'/'organisation'/'reisen') sind bereits die Routennamen,
   * keine Übersetzungstabelle nötig. Bei mehreren gewählten Bereichen gibt es keine eindeutige Priorität, daher
   * zum Dashboard, das diese Auswahl selbst wieder ausliest und die gewählten Kacheln hervorhebt (siehe
   * dashboard.ts preferredDomains()) statt sie zu verwerfen. */
  finish(destination: '/demo' | '/') {
    if (this.saving()) return;
    const usage = this.usage();
    const selected = this.selected();
    if (!usage || !selected.length) return;
    this.saving.set(true);
    this.error.set('');
    this.api
      .complete(usage, selected)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.saving.set(false);
          const base = destination === '/' ? '' : destination;
          const target = selected.length === 1 ? `${base}/${selected[0]}` : destination;
          this.router.navigateByUrl(target, { replaceUrl: true });
        },
        error: () => {
          this.saving.set(false);
          this.error.set(
            'Deine Auswahl konnte nicht gespeichert werden. Bitte versuche es erneut.',
          );
        },
      });
  }
}
